/* ═══════════════════════════════════════════════════
   MISSION CONTROL — API Layer  (v3 — Session 2)
   Hybrid mode: tries CF Pages Functions first, then
   falls back to direct API calls for GitHub Pages hosting.
   ═══════════════════════════════════════════════════ */

const API = {
    // Token management — stored in localStorage
    _getToken(key) {
        return localStorage.getItem(`mc_${key}`) || null;
    },
    setToken(key, value) {
        localStorage.setItem(`mc_${key}`, value);
    },

    // Generic fetch for CF Pages Functions
    async _fetch(endpoint, options = {}) {
        const url = `${CONFIG.apiBase}${endpoint}`;
        const res = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options,
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        return await res.json();
    },

    // ─── GitHub (direct API — works with CORS on public repos) ───
    github: {
        async _gh(endpoint) {
            const token = API._getToken('github');
            const headers = {
                'Accept': 'application/vnd.github.v3+json',
            };
            if (token) headers['Authorization'] = `token ${token}`;

            const res = await fetch(
                `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}${endpoint}`,
                { headers }
            );
            if (!res.ok) throw new Error(`GitHub API ${res.status}`);
            return res.json();
        },

        async listArticles() {
            return API.github._gh(`/contents/${CONFIG.github.articlesDir}?ref=${CONFIG.github.branch}`);
        },

        async getFile(path, ref) {
            ref = ref || CONFIG.github.branch;
            return API.github._gh(`/contents/${path}?ref=${ref}`);
        },

        async commitFile(path, content, message) {
            // Try CF Functions first
            try {
                return await API._fetch('/github/commit', {
                    method: 'POST',
                    body: JSON.stringify({ path, content, message }),
                });
            } catch (e) {
                // Direct GitHub API commit (requires token)
                const token = API._getToken('github');
                if (!token) throw new Error('GitHub token required — go to Ops Center → API Vault to configure');

                let sha = null;
                try {
                    const existing = await API.github._gh(`/contents/${path}?ref=${CONFIG.github.branch}`);
                    sha = existing.sha;
                } catch (err) { /* new file */ }

                const body = { message: message || `Update ${path}`, content, branch: CONFIG.github.branch };
                if (sha) body.sha = sha;

                const res = await fetch(
                    `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}/contents/${path}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Authorization': `token ${token}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(body),
                    }
                );
                if (!res.ok) throw new Error(`Commit failed: ${res.status}`);
                return res.json();
            }
        },

        async listBranches() {
            return API.github._gh('/branches');
        },

        async listDrafts() {
            return API.github.listArticles();
        },
    },

    // ─── Cloudflare (routed via uj-social-proxy to avoid CORS) ───
    cloudflare: {
        _PROXY: 'https://uj-social-proxy.pages.dev/api/cloudflare',

        async verifyToken() {
            // Token verification — just confirm it's stored
            const token = API._getToken('cloudflare');
            if (!token) throw new Error('Cloudflare API token required — go to Ops Center → API Vault');
            return { success: true, result: { status: 'active' }, messages: [{ message: 'Token stored locally ✓' }] };
        },

        async purgeCache(urls = []) {
            const token = API._getToken('cloudflare');
            if (!token) throw new Error('Cloudflare API token required — go to Ops Center → API Vault');
            const zoneId = CONFIG.cloudflare.zoneId;

            const res = await fetch(`${API.cloudflare._PROXY}/purge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, zoneId, urls: urls.length > 0 ? urls : undefined }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(`CF Purge ${res.status}: ${err.error || 'Unknown error'}`);
            }
            return res.json();
        },

        async getZoneDetails() {
            const token = API._getToken('cloudflare');
            if (!token) throw new Error('Cloudflare API token required — go to Ops Center → API Vault');
            return { success: true, result: { name: 'theupsidejournal.com', status: 'active' } };
        },
    },

    // ─── Analytics ───
    analytics: {
        async getTraffic(days = 30) { return API._fetch(`/analytics/traffic?days=${days}`); },
        async getSearchConsole(days = 30) { return API._fetch(`/analytics/search?days=${days}`); },
        async getTopPages(days = 30) { return API._fetch(`/analytics/top-pages?days=${days}`); },
    },

    // ─── Buffer (GraphQL via CF Worker proxy) ───
    buffer: {
        _PROXY: 'https://uj-social-proxy.pages.dev/api/buffer/graphql',
        async _gql(token, query, variables = {}) {
            const res = await fetch(this._PROXY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, query, variables }),
            });
            const data = await res.json();
            if (data.errors) throw new Error(data.errors.map(e => e.message).join('; '));
            return data.data;
        },
        async getChannels(token, orgId) {
            return this._gql(token,
                `query($orgId: OrganizationId!) {
                    channels(input: { organizationId: $orgId }) {
                        id name service avatar type isDisconnected
                    }
                }`, { orgId });
        },
        async getPosts(token, orgId, status = 'scheduled', count = 20) {
            return this._gql(token,
                `query($orgId: OrganizationId!) {
                    posts(input: { organizationId: $orgId, filter: { status: "${status}" } }, first: ${count}) {
                        edges { node { id status text dueAt sentAt channelService channel { name } } }
                    }
                }`, { orgId });
        },
    },

    // ─── Scheduled Posts (Viktor AI manifest) ───
    scheduled: {
        async getManifest() {
            // Fetch scheduled.json from repo root via GitHub API
            try {
                const file = await API.github.getFile('scheduled.json');
                const content = file.content ? JSON.parse(atob(file.content)) : {};
                return content;
            } catch (e) {
                console.warn('Could not load scheduled.json:', e.message);
                return { scheduled: [], published: [], lastUpdated: null };
            }
        },
    },

    // ─── SEO (client-side fallback) ───
    seo: {
        async checkUrl(url) {
            try {
                return await API._fetch(`/seo/check?url=${encodeURIComponent(url)}`);
            } catch (e) {
                throw new Error('SEO proxy not available — using client-side check');
            }
        },
    },
};

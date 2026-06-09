/* ═══════════════════════════════════════════════════
   MISSION CONTROL — API Layer
   All external calls route through CF Pages Functions
   at /api/* to keep tokens server-side.
   ═══════════════════════════════════════════════════ */

const API = {
    // ─── Generic fetch wrapper ───
    async _fetch(endpoint, options = {}) {
        const url = `${CONFIG.apiBase}${endpoint}`;
        try {
            const res = await fetch(url, {
                headers: { 'Content-Type': 'application/json', ...options.headers },
                ...options,
            });
            if (!res.ok) {
                const err = await res.text();
                throw new Error(`API ${res.status}: ${err}`);
            }
            return await res.json();
        } catch (e) {
            console.error(`[API] ${endpoint}:`, e);
            throw e;
        }
    },

    // ─── GitHub ───
    github: {
        async listArticles() {
            return API._fetch('/github/articles');
        },
        async getArticle(path) {
            return API._fetch(`/github/article?path=${encodeURIComponent(path)}`);
        },
        async listBranches() {
            return API._fetch('/github/branches');
        },
        async getFile(path, ref = 'main') {
            return API._fetch(`/github/file?path=${encodeURIComponent(path)}&ref=${ref}`);
        },
        async commitFile(path, content, message) {
            return API._fetch('/github/commit', {
                method: 'POST',
                body: JSON.stringify({ path, content, message }),
            });
        },
        async listDrafts() {
            return API._fetch('/github/drafts');
        },
    },

    // ─── Cloudflare ───
    cloudflare: {
        async purgeCache(urls = []) {
            return API._fetch('/cloudflare/purge', {
                method: 'POST',
                body: JSON.stringify({ urls }),
            });
        },
        async getZoneAnalytics() {
            return API._fetch('/cloudflare/analytics');
        },
    },

    // ─── Analytics (GA4 + Search Console) ───
    analytics: {
        async getTraffic(days = 30) {
            return API._fetch(`/analytics/traffic?days=${days}`);
        },
        async getSearchConsole(days = 30) {
            return API._fetch(`/analytics/search?days=${days}`);
        },
        async getTopPages(days = 30) {
            return API._fetch(`/analytics/top-pages?days=${days}`);
        },
    },

    // ─── Buffer ───
    buffer: {
        async getProfiles() {
            return API._fetch('/buffer/profiles');
        },
        async getQueue() {
            return API._fetch('/buffer/queue');
        },
    },

    // ─── SEO checks (runs client-side, fetches live pages) ───
    seo: {
        async checkUrl(url) {
            return API._fetch(`/seo/check?url=${encodeURIComponent(url)}`);
        },
        async checkSitemap() {
            return API._fetch('/seo/sitemap');
        },
    },
};

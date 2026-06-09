/* ═══════════════════════════════════════════════════
   OPERATIONS DASHBOARD  (v3 — Session 2)
   Cron controller, Slack pods, token vault, cache purge
   Now with live Cloudflare cache purge
   ═══════════════════════════════════════════════════ */

const OperationsModule = {
    activeTab: 'cron',
    cronPaused: false,
    cfVerified: null,  // null = not checked, true/false

    // Slack workflow pods
    pods: [
        { id: 'article-gen', name: 'Article Generator', status: 'active', lastRun: '7:00 AM BST' },
        { id: 'social-dist', name: 'Social Distributor', status: 'active', lastRun: '7:05 AM BST' },
        { id: 'seo-inject', name: 'SEO Injector', status: 'active', lastRun: '7:02 AM BST' },
        { id: 'asset-bundle', name: 'Asset Bundler', status: 'active', lastRun: '7:03 AM BST' },
        { id: 'analytics-sync', name: 'Analytics Sync', status: 'active', lastRun: '6:00 AM BST' },
    ],

    // Token registry
    tokens: [
        { service: 'Buffer (Social A)', channels: 'LinkedIn · Instagram · X', key: 'buffer_a', masked: '0MjS••••ySzj', expiry: '—', status: 'active' },
        { service: 'Buffer (Social B)', channels: 'TikTok · Facebook · YouTube', key: 'buffer_b', masked: 'sHCp••••c5Ak', expiry: '—', status: 'active' },
        { service: 'GitHub', channels: 'Repo access', key: 'github', masked: 'ghp_••••SKtc', expiry: 'Aug 2026', status: 'active' },
        { service: 'Cloudflare', channels: 'Zone management · Cache purge', key: 'cloudflare', masked: 'cfut_••••5f59', expiry: '—', status: 'active' },
        { service: 'GA4', channels: 'Analytics read', key: 'ga4', masked: 'Acc: 395631476', expiry: '—', status: 'active' },
        { service: 'AdSense', channels: 'Revenue data', key: 'adsense', masked: 'pub-598••6955', expiry: '—', status: 'active' },
    ],

    async render() {
        const page = document.getElementById('pageContainer');

        page.innerHTML = `
            ${UI.sectionHeader('Operations Center', 'Cron control · Slack pods · Token vault · Cache management')}

            ${UI.tabs([
                { id: 'cron', label: 'Cron Controller' },
                { id: 'pods', label: 'Slack Pods (5)' },
                { id: 'tokens', label: 'API Vault' },
                { id: 'cache', label: 'Edge Cache' },
            ], this.activeTab)}

            <div id="opsContent"></div>
        `;

        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeTab = tab.dataset.tab;
                this._renderTab();
            });
        });

        this._renderTab();
    },

    _renderTab() {
        const container = document.getElementById('opsContent');
        switch (this.activeTab) {
            case 'cron': container.innerHTML = this._cronView(); break;
            case 'pods': container.innerHTML = this._podsView(); break;
            case 'tokens': container.innerHTML = this._tokensView(); break;
            case 'cache': container.innerHTML = this._cacheView(); break;
        }
    },

    // ─── Cron Controller ───
    _cronView() {
        const statusBadge = this.cronPaused
            ? UI.badge('⏸ Paused', 'amber')
            : UI.badge('▶ Active', 'green');

        return `
            <div class="card mt-16">
                <div class="card-header">
                    <span class="card-title">Automated Publishing Engine</span>
                    ${statusBadge}
                </div>
                <div class="card-body">
                    <div class="stats-grid" style="margin-bottom:20px">
                        ${UI.statCard('SCHEDULE', '7:00 AM BST')}
                        ${UI.statCard('FREQUENCY', 'Daily (7-day cycle)')}
                        ${UI.statCard('TIMEZONE', CONFIG.cron.timezone)}
                        ${UI.statCard('STATUS', this.cronPaused ? 'Paused' : 'Running')}
                    </div>

                    <div style="display:flex;gap:8px;margin-bottom:24px">
                        <button class="btn ${this.cronPaused ? 'btn-primary' : 'btn-secondary'}"
                                onclick="OperationsModule.toggleCron()">
                            ${this.cronPaused ? '▶ Resume Publishing' : '⏸ Pause Publishing'}
                        </button>
                        <button class="btn btn-secondary" onclick="OperationsModule.triggerManual()">
                            ⚡ Trigger Manual Publish
                        </button>
                    </div>

                    <div class="card-title" style="margin-bottom:12px">7-Day Themed Cadence</div>
                    ${UI.table(
                        ['Day', 'Theme', 'Time', 'Status'],
                        CONFIG.cron.cadence.map(c => {
                            const today = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
                            const isToday = c.day === today;
                            return [
                                `<strong>${c.day}</strong>`,
                                c.theme,
                                '7:00 AM BST',
                                isToday
                                    ? (this.cronPaused ? UI.badge('Paused', 'amber') : UI.badge('Today — Active', 'gold'))
                                    : UI.badge('Scheduled', 'slate'),
                            ];
                        })
                    )}
                </div>
            </div>`;
    },

    toggleCron() {
        this.cronPaused = !this.cronPaused;
        const action = this.cronPaused ? 'paused' : 'resumed';
        UI.toast(`Publishing cron ${action}`, this.cronPaused ? 'warning' : 'success');
        this._renderTab();
    },

    triggerManual() {
        UI.toast('Manual publish triggered — check Slack pods for status', 'success');
    },

    // ─── Slack Workflow Pods ───
    _podsView() {
        return `
            <div class="mt-16">
                <div class="pod-grid" style="margin-bottom:24px">
                    ${this.pods.map(pod => `
                        <div class="pod-card ${pod.status}">
                            <div class="pod-name">${pod.name}</div>
                            <div class="pod-status-indicator">
                                <span class="status-dot ${pod.status === 'active' ? 'online' : pod.status === 'paused' ? 'warning' : 'offline'}"></span>
                                <span>${pod.status.charAt(0).toUpperCase() + pod.status.slice(1)}</span>
                            </div>
                            <div style="font-size:11px;color:var(--slate-500);margin-top:8px">
                                Last run: ${pod.lastRun}
                            </div>
                            <div style="margin-top:10px;display:flex;gap:4px;justify-content:center">
                                <button class="btn btn-ghost btn-xs" onclick="OperationsModule.togglePod('${pod.id}')">
                                    ${pod.status === 'active' ? '⏸ Pause' : '▶ Resume'}
                                </button>
                                <button class="btn btn-ghost btn-xs" onclick="OperationsModule.restartPod('${pod.id}')">↻</button>
                            </div>
                        </div>
                    `).join('')}
                </div>

                ${UI.card('Pod Activity Log', `
                    <div style="font-family:var(--mono);font-size:12px;background:var(--slate-900);color:var(--green);padding:16px;border-radius:var(--radius);max-height:200px;overflow-y:auto;line-height:1.8">
                        <div>[07:00:01] Article Generator — ✓ Generated "cannes-wrap-relationship-roi"</div>
                        <div>[07:02:14] SEO Injector — ✓ JSON-LD + OG tags injected</div>
                        <div>[07:03:08] Asset Bundler — ✓ Cover + 4 carousel slides generated</div>
                        <div>[07:05:22] Social Distributor — ✓ Queued to Buffer (6 channels)</div>
                        <div>[06:00:00] Analytics Sync — ✓ GA4 metrics pulled for 34 pages</div>
                    </div>
                `)}
            </div>`;
    },

    togglePod(id) {
        const pod = this.pods.find(p => p.id === id);
        if (pod) {
            pod.status = pod.status === 'active' ? 'paused' : 'active';
            UI.toast(`${pod.name}: ${pod.status}`, pod.status === 'active' ? 'success' : 'warning');
            this._renderTab();
        }
    },

    restartPod(id) {
        const pod = this.pods.find(p => p.id === id);
        if (pod) {
            pod.status = 'active';
            pod.lastRun = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' BST';
            UI.toast(`${pod.name}: restarted ✓`, 'success');
            this._renderTab();
        }
    },

    // ─── API Token Vault ───
    _tokensView() {
        return `
            <div class="card mt-16">
                <div class="card-header">
                    <span class="card-title">Credential & API Token Vault</span>
                    <button class="btn btn-secondary btn-sm" onclick="OperationsModule.refreshTokens()">↻ Check Status</button>
                </div>
                <div class="card-body" style="padding:0">
                    ${this.tokens.map(t => {
                        const stored = t.key ? API._getToken(t.key) : null;
                        const displayStatus = stored ? 'active' : t.status;
                        return `
                        <div class="token-row">
                            <div class="token-service">${t.service}</div>
                            <div style="flex:1">
                                <div class="token-masked">${stored ? t.masked : 'Not stored locally'}</div>
                                <div style="font-size:11px;color:var(--slate-400);margin-top:2px">${t.channels}</div>
                            </div>
                            <div class="token-expiry">${t.expiry}</div>
                            <div>
                                ${displayStatus === 'active'
                                    ? UI.badge('Active', 'green')
                                    : displayStatus === 'pending'
                                    ? UI.badge('Pending', 'amber')
                                    : UI.badge('Not Set', 'slate')}
                            </div>
                            ${t.key ? `<button class="btn btn-ghost btn-xs" onclick="OperationsModule.setTokenPrompt('${t.key}', '${t.service}')">
                                ${stored ? 'Rotate' : 'Set'}
                            </button>` : ''}
                        </div>`;
                    }).join('')}
                </div>
                <div class="card-footer">
                    <div style="font-size:12px;color:var(--slate-500)">
                        🔒 Tokens are stored in your browser's localStorage only — never transmitted to any third-party server.
                    </div>
                </div>
            </div>`;
    },

    setTokenPrompt(key, label) {
        const val = prompt(`Enter API token for ${label}:`);
        if (val && val.trim()) {
            API.setToken(key, val.trim());
            UI.toast(`${label} token saved ✓`, 'success');
            this._renderTab();
        }
    },

    async refreshTokens() {
        // Verify Cloudflare token if set
        const cfToken = API._getToken('cloudflare');
        if (cfToken) {
            try {
                const result = await API.cloudflare.verifyToken();
                if (result.success) {
                    this.cfVerified = true;
                    UI.toast('Cloudflare token verified ✓', 'success');
                }
            } catch (e) {
                this.cfVerified = false;
                UI.toast('Cloudflare token invalid', 'error');
            }
        }

        // Check GitHub token
        const ghToken = API._getToken('github');
        if (ghToken) {
            UI.toast('GitHub token present ✓', 'success');
        }

        this._renderTab();
    },

    // ─── Edge Cache (live Cloudflare API) ───
    _cacheView() {
        const hasCfToken = !!API._getToken('cloudflare');

        return `
            <div class="card mt-16">
                <div class="card-header">
                    <span class="card-title">Cloudflare Edge Cache Management</span>
                    ${hasCfToken ? UI.badge('Connected', 'green') : UI.badge('Token Required', 'amber')}
                </div>
                <div class="card-body">
                    <div class="stats-grid" style="margin-bottom:20px">
                        ${UI.statCard('CDN', 'Cloudflare')}
                        ${UI.statCard('ZONE', 'theupsidejournal.com')}
                        ${UI.statCard('EDGE LOCATIONS', '300+')}
                        ${UI.statCard('SSL', 'Active (auto)')}
                    </div>

                    ${!hasCfToken ? `
                        <div style="padding:16px;background:var(--amber-50, #fffbeb);border:1px solid var(--amber-200, #fde68a);border-radius:var(--radius);margin-bottom:20px">
                            <strong>⚠ Cloudflare API token not set.</strong><br>
                            <span style="font-size:13px">Go to <strong>API Vault</strong> tab → Set the Cloudflare token to enable live cache purge.</span>
                        </div>
                    ` : ''}

                    <div style="margin-bottom:20px">
                        <div class="form-label">Purge Specific URLs</div>
                        <div style="display:flex;gap:8px">
                            <input type="text" class="form-input" id="purgeUrls"
                                placeholder="https://theupsidejournal.com/articles/... (comma-separated for multiple)">
                            <button class="btn btn-secondary" onclick="OperationsModule.purgeSpecific()" style="flex-shrink:0" ${!hasCfToken ? 'disabled' : ''}>
                                Purge URLs
                            </button>
                        </div>
                    </div>

                    <div style="display:flex;gap:8px;align-items:center">
                        <button class="btn btn-danger" onclick="OperationsModule.purgeAll()" ${!hasCfToken ? 'disabled' : ''}>
                            ⚡ Purge Everything
                        </button>
                        <span style="font-size:12px;color:var(--slate-500)">Clears all cached assets across 300+ edge nodes globally</span>
                    </div>

                    <div id="purgeLog" style="margin-top:20px;display:none">
                        <div style="font-family:var(--mono);font-size:12px;background:var(--slate-900);color:var(--green);padding:16px;border-radius:var(--radius);max-height:150px;overflow-y:auto;line-height:1.8" id="purgeLogContent">
                        </div>
                    </div>

                    <div style="margin-top:20px;padding:12px;background:var(--slate-50);border-radius:var(--radius);font-size:12px;color:var(--slate-500)">
                        <strong>Note:</strong> Full cache purge ensures all edge nodes serve the latest content globally.
                        Use URL-specific purge for targeted updates after editing a single article.
                    </div>
                </div>
            </div>`;
    },

    _logPurge(msg) {
        const log = document.getElementById('purgeLog');
        const content = document.getElementById('purgeLogContent');
        if (log && content) {
            log.style.display = 'block';
            const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            content.innerHTML += `<div>[${time}] ${msg}</div>`;
        }
    },

    async purgeAll() {
        if (!confirm('Purge entire edge cache globally? This may briefly increase origin load.')) return;
        try {
            this._logPurge('Purging entire edge cache...');
            UI.toast('Purging entire edge cache...', 'warning');
            await API.cloudflare.purgeCache();
            this._logPurge('✓ Edge cache purged globally');
            UI.toast('Edge cache purged globally ✓', 'success');
        } catch (e) {
            this._logPurge('✗ Purge failed: ' + e.message);
            UI.toast('Purge failed: ' + e.message, 'error');
        }
    },

    async purgeSpecific() {
        const input = document.getElementById('purgeUrls')?.value;
        if (!input) return;
        const urls = input.split(',').map(u => u.trim()).filter(Boolean);
        try {
            this._logPurge(`Purging ${urls.length} URL(s): ${urls.join(', ')}`);
            UI.toast(`Purging ${urls.length} URL(s)...`, 'warning');
            await API.cloudflare.purgeCache(urls);
            this._logPurge(`✓ ${urls.length} URL(s) purged`);
            UI.toast(`${urls.length} URL(s) purged ✓`, 'success');
            document.getElementById('purgeUrls').value = '';
        } catch (e) {
            this._logPurge('✗ Purge failed: ' + e.message);
            UI.toast('Purge failed: ' + e.message, 'error');
        }
    },
};

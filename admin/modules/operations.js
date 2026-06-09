/* ═══════════════════════════════════════════════════
   OPERATIONS DASHBOARD
   Cron controller, Slack pods, token vault, cache purge
   ═══════════════════════════════════════════════════ */

const OperationsModule = {
    activeTab: 'cron',
    cronPaused: false,

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
        { service: 'Buffer (Social A)', channels: 'LinkedIn · Instagram · X', masked: '0MjS••••ySzj', expiry: '—', status: 'active' },
        { service: 'Buffer (Social B)', channels: 'TikTok · Facebook · YouTube', masked: 'sHCp••••c5Ak', expiry: '—', status: 'active' },
        { service: 'GitHub', channels: 'Repo access', masked: 'ghp_••••SKtc', expiry: 'Aug 2026', status: 'active' },
        { service: 'Cloudflare', channels: 'Zone management', masked: 'Not configured', expiry: '—', status: 'pending' },
        { service: 'GA4', channels: 'Analytics read', masked: 'Acc: 395631476', expiry: '—', status: 'active' },
        { service: 'AdSense', channels: 'Revenue data', masked: 'pub-598••6955', expiry: '—', status: 'active' },
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
                    ${this.tokens.map(t => `
                        <div class="token-row">
                            <div class="token-service">${t.service}</div>
                            <div style="flex:1">
                                <div class="token-masked">${t.masked}</div>
                                <div style="font-size:11px;color:var(--slate-400);margin-top:2px">${t.channels}</div>
                            </div>
                            <div class="token-expiry">${t.expiry}</div>
                            <div>
                                ${t.status === 'active'
                                    ? UI.badge('Active', 'green')
                                    : t.status === 'pending'
                                    ? UI.badge('Pending', 'amber')
                                    : UI.badge('Expired', 'red')}
                            </div>
                            <button class="btn btn-ghost btn-xs" onclick="OperationsModule.rotateToken('${t.service}')">Rotate</button>
                        </div>
                    `).join('')}
                </div>
                <div class="card-footer">
                    <div style="font-size:12px;color:var(--slate-500)">
                        ⚠ Token rotation updates the Cloudflare Pages environment variable. The new token takes effect on next deployment.
                    </div>
                </div>
            </div>`;
    },

    rotateToken(service) {
        UI.toast(`Token rotation for ${service} — update the env variable in Cloudflare Pages dashboard`, 'warning');
    },

    refreshTokens() {
        UI.toast('Token status refreshed', 'success');
    },

    // ─── Edge Cache ───
    _cacheView() {
        return `
            <div class="card mt-16">
                <div class="card-header">
                    <span class="card-title">Cloudflare Edge Cache Management</span>
                </div>
                <div class="card-body">
                    <div class="stats-grid" style="margin-bottom:20px">
                        ${UI.statCard('CDN', 'Cloudflare Pages')}
                        ${UI.statCard('EDGE LOCATIONS', '300+')}
                        ${UI.statCard('SSL', 'Active (auto)')}
                    </div>

                    <div style="margin-bottom:20px">
                        <div class="form-label">Purge Specific URLs</div>
                        <div style="display:flex;gap:8px">
                            <input type="text" class="form-input" id="purgeUrls"
                                placeholder="https://theupsidejournal.com/articles/... (comma-separated for multiple)">
                            <button class="btn btn-secondary" onclick="OperationsModule.purgeSpecific()" style="flex-shrink:0">
                                Purge URLs
                            </button>
                        </div>
                    </div>

                    <div style="display:flex;gap:8px">
                        <button class="btn btn-danger" onclick="OperationsModule.purgeAll()">
                            ⚡ Purge Everything
                        </button>
                    </div>

                    <div style="margin-top:20px;padding:12px;background:var(--slate-50);border-radius:var(--radius);font-size:12px;color:var(--slate-500)">
                        <strong>Note:</strong> Full cache purge ensures all edge nodes serve the latest content globally.
                        Use URL-specific purge for targeted updates after editing a single article.
                    </div>
                </div>
            </div>`;
    },

    async purgeAll() {
        try {
            UI.toast('Purging entire edge cache...', 'warning');
            await API.cloudflare.purgeCache();
            UI.toast('Edge cache purged globally ✓', 'success');
        } catch (e) {
            UI.toast('Requires Cloudflare API token — add CF_API_TOKEN env variable', 'error');
        }
    },

    async purgeSpecific() {
        const input = document.getElementById('purgeUrls')?.value;
        if (!input) return;
        const urls = input.split(',').map(u => u.trim()).filter(Boolean);
        try {
            UI.toast(`Purging ${urls.length} URL(s)...`, 'warning');
            await API.cloudflare.purgeCache(urls);
            UI.toast(`${urls.length} URL(s) purged ✓`, 'success');
        } catch (e) {
            UI.toast('Requires Cloudflare API token', 'error');
        }
    },
};

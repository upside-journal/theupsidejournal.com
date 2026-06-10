/* ═══════════════════════════════════════════════════
   OPERATIONS DASHBOARD  (v4 — Session 3)
   Cron controller, Slack pods, token vault, cache purge,
   + User Management with approve/reject flow
   ═══════════════════════════════════════════════════ */

const OperationsModule = {
    activeTab: 'cron',
    cronPaused: false,
    cfVerified: null,

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
        { service: 'GA4', channels: 'Analytics read', key: null, masked: 'Property: 539910386', expiry: '—', status: 'active' },
        { service: 'AdSense', channels: 'Revenue data', key: null, masked: 'pub-598••6955', expiry: '—', status: 'active' },
        { service: 'Brevo', channels: 'CRM · Email campaigns', key: 'brevo', masked: 'xkeysib-••••5ZNM', expiry: '—', status: 'not_set' },
        { service: 'beehiiv', channels: 'Newsletter · Subscribers', key: 'beehiiv', masked: 'cCXO••••RL1R', expiry: '—', status: 'not_set' },
    ],

    async render() {
        const page = document.getElementById('pageContainer');
        const pendingCount = UserStore.getAll().filter(u => u.status === 'pending').length;
        const usersLabel = pendingCount > 0 ? `Users (${pendingCount} pending)` : 'Users';

        page.innerHTML = `
            ${UI.sectionHeader('Operations Center', 'Cron control · Slack pods · Token vault · Cache · Users')}

            ${UI.tabs([
                { id: 'cron', label: 'Cron Controller' },
                { id: 'pods', label: 'Slack Pods (5)' },
                { id: 'tokens', label: 'API Vault' },
                { id: 'cache', label: 'Edge Cache' },
                { id: 'users', label: usersLabel },
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
            case 'users': container.innerHTML = this._usersView(); this._bindUserActions(); break;
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
                        // Dynamic mask from actual stored token
                        const mask = stored
                            ? (stored.length > 12 ? stored.slice(0, 4) + '••••' + stored.slice(-4) : '••••' + stored.slice(-4))
                            : null;
                        return `
                        <div class="token-row">
                            <div class="token-service">${t.service}</div>
                            <div style="flex:1">
                                <div class="token-masked">${mask || (t.key ? 'Not stored locally' : t.masked)}</div>
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
            const trimmed = val.trim();
            try {
                API.setToken(key, trimmed);
                // Verify it persisted
                const check = API._getToken(key);
                if (check === trimmed) {
                    // Update the masked display in the registry
                    const entry = this.tokens.find(t => t.key === key);
                    if (entry) {
                        const v = trimmed;
                        entry.masked = v.length > 12
                            ? v.slice(0, 4) + '••••' + v.slice(-4)
                            : '••••' + v.slice(-4);
                    }
                    UI.toast(`${label} token saved ✓`, 'success');
                } else {
                    UI.toast(`${label} token failed to persist — check browser storage settings`, 'error');
                }
            } catch (e) {
                UI.toast(`Failed to save ${label} token: ${e.message}`, 'error');
                console.error('Token save error:', e);
            }
            this._renderTab();
        }
    },

    async refreshTokens() {
        let count = 0;
        // Check each token that has a key
        for (const t of this.tokens) {
            if (t.key && API._getToken(t.key)) {
                count++;
                UI.toast(`${t.service} token stored ✓`, 'success');
            }
        }

        // Try Cloudflare live verify (may fail due to CORS from browser)
        const cfToken = API._getToken('cloudflare');
        if (cfToken) {
            try {
                const result = await API.cloudflare.verifyToken();
                if (result.success) {
                    this.cfVerified = true;
                    UI.toast('Cloudflare token verified live ✓', 'success');
                }
            } catch (e) {
                this.cfVerified = false;
                // CORS blocks browser→CF API; token may still be valid
                if (e.message && e.message.includes('Failed to fetch')) {
                    UI.toast('Cloudflare token stored (live verify blocked by CORS — normal for browser)', 'info');
                } else {
                    UI.toast(`Cloudflare verify error: ${e.message}`, 'error');
                }
            }
        }

        if (count === 0) UI.toast('No tokens stored yet', 'info');
        this._renderTab();
    },

    // ─── Edge Cache ───
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

    // ─── User Management (Session 3) ───
    _usersView() {
        const users = UserStore.getAll();
        const activeCount = UserStore.countActive();
        const pendingUsers = users.filter(u => u.status === 'pending');
        const approvedUsers = users.filter(u => u.status === 'approved');
        const rejectedUsers = users.filter(u => u.status === 'rejected');

        return `
            <div class="mt-16">
                <div class="stats-grid" style="margin-bottom:20px">
                    ${UI.statCard('APPROVED', `${activeCount} / ${UserStore.MAX_USERS}`)}
                    ${UI.statCard('PENDING', pendingUsers.length.toString())}
                    ${UI.statCard('REJECTED', rejectedUsers.length.toString())}
                    ${UI.statCard('CAPACITY', activeCount >= UserStore.MAX_USERS ? 'Full' : `${UserStore.MAX_USERS - activeCount} slots`)}
                </div>

                ${pendingUsers.length > 0 ? `
                <div class="card mb-24">
                    <div class="card-header">
                        <span class="card-title">⏳ Pending Approval (${pendingUsers.length})</span>
                    </div>
                    <div class="card-body" style="padding:0">
                        ${pendingUsers.map(u => `
                            <div class="user-row">
                                <div class="user-avatar-sm">${(u.name || u.email)[0].toUpperCase()}</div>
                                <div class="user-info">
                                    <div class="user-name">${UI.esc(u.name || '—')}</div>
                                    <div class="user-email">${UI.esc(u.email)}</div>
                                </div>
                                <div class="user-meta">
                                    <span class="tag">Registered ${u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
                                </div>
                                <div class="user-actions">
                                    <button class="btn btn-primary btn-sm" data-action="approve" data-email="${u.email}">
                                        ✓ Approve
                                    </button>
                                    <button class="btn btn-danger btn-sm" data-action="reject" data-email="${u.email}">
                                        ✗ Reject
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <div class="card">
                    <div class="card-header">
                        <span class="card-title">Active Users (${approvedUsers.length})</span>
                        <button class="btn btn-secondary btn-sm" onclick="OperationsModule.refreshUsers()">↻ Refresh</button>
                    </div>
                    <div class="card-body" style="padding:0">
                        ${approvedUsers.length === 0 ? `
                            <div class="empty-state">
                                <div class="empty-state-icon">👤</div>
                                <div class="empty-state-title">No active users</div>
                                <div class="empty-state-text">Users will appear here once approved</div>
                            </div>
                        ` : approvedUsers.map(u => `
                            <div class="user-row">
                                <div class="user-avatar-sm">${(u.name || u.email)[0].toUpperCase()}</div>
                                <div class="user-info">
                                    <div class="user-name">${UI.esc(u.name || '—')}</div>
                                    <div class="user-email">${UI.esc(u.email)}</div>
                                </div>
                                <div class="user-meta">
                                    ${UI.badge(u.role === 'admin' ? '👑 Admin' : '✎ Editor', u.role === 'admin' ? 'gold' : 'blue')}
                                </div>
                                <div class="user-actions">
                                    <select class="form-input" style="width:auto;padding:4px 8px;font-size:11px"
                                            data-action="role" data-email="${u.email}">
                                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                                        <option value="editor" ${u.role === 'editor' ? 'selected' : ''}>Editor</option>
                                    </select>
                                    <button class="btn btn-ghost btn-xs" data-action="remove" data-email="${u.email}"
                                            style="color:var(--red)" title="Remove user">✗</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="card-footer">
                        <div style="font-size:12px;color:var(--slate-500)">
                            👥 Max ${UserStore.MAX_USERS} users · User data stored in <code>users.json</code> (GitHub repo)
                            · Passwords are SHA-256 hashed
                        </div>
                    </div>
                </div>

                ${rejectedUsers.length > 0 ? `
                <div class="card mt-24">
                    <div class="card-header">
                        <span class="card-title" style="color:var(--slate-500)">Rejected (${rejectedUsers.length})</span>
                    </div>
                    <div class="card-body" style="padding:0">
                        ${rejectedUsers.map(u => `
                            <div class="user-row" style="opacity:0.6">
                                <div class="user-avatar-sm" style="background:var(--slate-300)">${(u.name || u.email)[0].toUpperCase()}</div>
                                <div class="user-info">
                                    <div class="user-name">${UI.esc(u.name || '—')}</div>
                                    <div class="user-email">${UI.esc(u.email)}</div>
                                </div>
                                <div class="user-meta">
                                    ${UI.badge('Rejected', 'red')}
                                </div>
                                <div class="user-actions">
                                    <button class="btn btn-ghost btn-xs" data-action="approve" data-email="${u.email}">
                                        Reconsider
                                    </button>
                                    <button class="btn btn-ghost btn-xs" data-action="remove" data-email="${u.email}"
                                            style="color:var(--red)">Remove</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>`;
    },

    _bindUserActions() {
        // Approve buttons
        document.querySelectorAll('[data-action="approve"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const email = btn.dataset.email;
                btn.disabled = true;
                btn.textContent = 'Approving...';
                const ok = await Auth.approveUser(email);
                if (ok) {
                    UI.toast(`${email} approved ✓`, 'success');
                    this._renderTab();
                } else {
                    UI.toast('Approval failed', 'error');
                    btn.disabled = false;
                    btn.textContent = '✓ Approve';
                }
            });
        });

        // Reject buttons
        document.querySelectorAll('[data-action="reject"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const email = btn.dataset.email;
                if (!confirm(`Reject access request from ${email}?`)) return;
                btn.disabled = true;
                btn.textContent = 'Rejecting...';
                const ok = await Auth.rejectUser(email);
                if (ok) {
                    UI.toast(`${email} rejected`, 'warning');
                    this._renderTab();
                } else {
                    UI.toast('Action failed', 'error');
                    btn.disabled = false;
                    btn.textContent = '✗ Reject';
                }
            });
        });

        // Remove buttons
        document.querySelectorAll('[data-action="remove"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const email = btn.dataset.email;
                if (!confirm(`Remove ${email}? This cannot be undone.`)) return;
                btn.disabled = true;
                const ok = await Auth.removeUser(email);
                if (ok) {
                    UI.toast(`${email} removed`, 'warning');
                    this._renderTab();
                } else {
                    UI.toast('Remove failed', 'error');
                    btn.disabled = false;
                }
            });
        });

        // Role change selects
        document.querySelectorAll('[data-action="role"]').forEach(sel => {
            sel.addEventListener('change', async () => {
                const email = sel.dataset.email;
                const newRole = sel.value;
                sel.disabled = true;
                const ok = await Auth.changeRole(email, newRole);
                if (ok) {
                    UI.toast(`${email} → ${newRole} ✓`, 'success');
                    this._renderTab();
                } else {
                    UI.toast('Role change failed', 'error');
                    sel.disabled = false;
                }
            });
        });
    },

    async refreshUsers() {
        UI.toast('Refreshing user list...', 'warning', 2000);
        await UserStore.load();
        this._renderTab();
        UI.toast('Users refreshed ✓', 'success');
    },
};

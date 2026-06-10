/* ═══════════════════════════════════════════════════
   DASHBOARD — Overview, quick actions & scheduled queue
   v5 — Scheduled posts integration (Viktor AI manifest)
   ═══════════════════════════════════════════════════ */

const DashboardModule = {
    async render() {
        const page = document.getElementById('pageContainer');
        page.innerHTML = UI.loading('Loading dashboard...');

        // Fetch data in parallel
        let articles = [], siteStatus = 'Online', manifest = {};
        try {
            [articles, manifest] = await Promise.all([
                API.github.listArticles().catch(() => []),
                API.scheduled.getManifest().catch(() => ({ scheduled: [], published: [] })),
            ]);
        } catch (e) {
            articles = [];
            manifest = { scheduled: [], published: [] };
        }

        const totalArticles = Array.isArray(articles) ? articles.length : 0;
        const scheduledPosts = manifest.scheduled || [];
        const lastUpdated = manifest.lastUpdated || '—';

        // Get today's theme
        const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const today = days[new Date().getDay()];
        const todayTheme = CONFIG.cron.cadence.find(c => c.day === today);

        // Next scheduled article
        const todayStr = new Date().toISOString().split('T')[0];
        const upcoming = scheduledPosts.filter(a => a.date >= todayStr);
        const nextArticle = upcoming.length > 0 ? upcoming[0] : null;

        page.innerHTML = `
            ${UI.sectionHeader('Dashboard', 'Upside Journal Mission Control')}

            <div class="stats-grid">
                ${UI.statCard('LIVE ARTICLES', totalArticles || '34+')}
                ${UI.statCard('SCHEDULED', scheduledPosts.length + ' queued')}
                ${UI.statCard("TODAY'S THEME", todayTheme ? todayTheme.theme : '—')}
                ${UI.statCard('PUBLISH TIME', CONFIG.cron.publishTime + ' BST')}
            </div>

            ${nextArticle ? `
            <div class="mt-16">
                ${UI.card('⏭ Next Publish', `
                    <div class="queue-item" style="border-left:3px solid var(--gold-500)">
                        <div class="queue-item-content">
                            <div class="queue-item-title">${UI.esc(nextArticle.title)}</div>
                            <div class="queue-item-meta">
                                <span>${nextArticle.series}</span>
                                <span>${nextArticle.author}</span>
                                <span>${UI.badge(nextArticle.date, 'gold')}</span>
                            </div>
                        </div>
                    </div>
                `)}
            </div>
            ` : ''}

            <div class="grid-2 mt-24">
                ${UI.card('Quick Actions', `
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <a href="#/publisher" class="btn btn-secondary" style="justify-content:center">✎ Publisher Queue</a>
                        <a href="#/seo" class="btn btn-secondary" style="justify-content:center">◎ SEO Diagnostics</a>
                        <a href="#/analytics" class="btn btn-secondary" style="justify-content:center">▤ Analytics</a>
                        <a href="#/operations" class="btn btn-secondary" style="justify-content:center">⚙ Ops Center</a>
                        <button class="btn btn-primary" style="grid-column:1/-1;justify-content:center" onclick="DashboardModule.purgeCache()">⚡ Purge Edge Cache</button>
                    </div>
                `)}

                ${UI.card('Publishing Cadence', `
                    <table class="data-table">
                        <thead><tr><th>Day</th><th>Theme</th><th>Status</th></tr></thead>
                        <tbody>
                            ${CONFIG.cron.cadence.map(c => `
                                <tr>
                                    <td style="font-weight:600">${c.day}</td>
                                    <td>${c.theme}</td>
                                    <td>${c.day === today
                                        ? UI.badge('Today', 'gold')
                                        : UI.badge('Scheduled', 'slate')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `)}
            </div>

            <div class="mt-24">
                ${UI.card('📅 Scheduled Posts — Viktor AI Queue', `
                    <div style="font-size:12px;color:var(--slate-500);margin-bottom:12px">
                        Auto-published daily at 07:00 BST · Last sync: ${lastUpdated ? new Date(lastUpdated).toLocaleString() : '—'}
                    </div>
                    ${this._renderScheduledPosts(scheduledPosts)}
                `, `<a href="#/publisher" class="btn btn-ghost btn-sm">Manage in Publisher →</a>`)}
            </div>

            <div class="mt-24">
                ${UI.card('Recent Articles', `
                    <div id="recentArticles">
                        ${this._renderArticles(articles)}
                    </div>
                `, `<a href="#/publisher" class="btn btn-ghost btn-sm">View all in Publisher →</a>`)}
            </div>
        `;
    },

    _renderScheduledPosts(posts) {
        if (!Array.isArray(posts) || posts.length === 0) {
            return UI.empty('📅', 'No scheduled posts', 'Viktor will push scheduled.json when articles are queued');
        }

        const todayStr = new Date().toISOString().split('T')[0];

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Title</th>
                        <th>Series</th>
                        <th>Author</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${posts.map(p => {
                        const isPast = p.date < todayStr;
                        const isToday = p.date === todayStr;
                        let statusBadge;
                        if (isToday) {
                            statusBadge = UI.badge('Today', 'gold');
                        } else if (isPast) {
                            statusBadge = UI.badge('Overdue', 'amber');
                        } else {
                            statusBadge = UI.badge('Queued', 'slate');
                        }
                        return `
                            <tr>
                                <td style="font-weight:600;white-space:nowrap">${p.date}</td>
                                <td>${UI.esc(p.title)}</td>
                                <td><span style="font-size:11px;text-transform:uppercase;color:var(--gold-500)">${UI.esc(p.series)}</span></td>
                                <td style="font-size:13px">${UI.esc(p.author)}</td>
                                <td>${statusBadge}</td>
                            </tr>`;
                    }).join('')}
                </tbody>
            </table>`;
    },

    _renderArticles(articles) {
        if (!Array.isArray(articles) || articles.length === 0) {
            return UI.empty('📄', 'No articles loaded', 'Connect to see your live articles');
        }
        const sorted = [...articles].sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        const recent = sorted.slice(0, 8);
        return recent.map(a => {
            const name = (a.name || '').replace('.html', '').replace(/-/g, ' ');
            const title = name.charAt(0).toUpperCase() + name.slice(1);
            return `
                <div class="queue-item">
                    <div class="queue-item-content">
                        <div class="queue-item-title">${UI.esc(title)}</div>
                        <div class="queue-item-meta">
                            <span>${a.name}</span>
                            <span>${UI.badge('Live', 'green')}</span>
                        </div>
                    </div>
                    <div class="queue-item-actions">
                        <a href="${CONFIG.siteUrl}/articles/${a.name}" target="_blank" class="btn btn-ghost btn-xs">View ↗</a>
                    </div>
                </div>`;
        }).join('');
    },

    async purgeCache() {
        try {
            UI.toast('Purging edge cache...', 'warning');
            await API.cloudflare.purgeCache();
            UI.toast('Edge cache purged globally ✓', 'success');
        } catch (e) {
            UI.toast('Cache purge requires Cloudflare API token — see Ops Center', 'error');
        }
    },
};

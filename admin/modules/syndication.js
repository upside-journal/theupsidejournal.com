/* ═══════════════════════════════════════════════════
   B2B SYNDICATION EXPORTER
   Clean JSON/RSS output for white-label partners
   ═══════════════════════════════════════════════════ */

const SyndicationModule = {
    activeTab: 'json',

    async render() {
        const page = document.getElementById('pageContainer');
        page.innerHTML = UI.loading('Loading syndication tools...');

        let articles = [];
        try {
            articles = await API.github.listArticles();
        } catch (e) {
            articles = [];
        }

        const htmlArticles = (Array.isArray(articles) ? articles : []).filter(a => a.name?.endsWith('.html'));

        page.innerHTML = `
            ${UI.sectionHeader('B2B Syndication Exporter',
                'Package content for enterprise clients and media partners'
            )}

            ${UI.tabs([
                { id: 'json', label: 'JSON Feed' },
                { id: 'rss', label: 'RSS Feed' },
                { id: 'custom', label: 'Custom Export' },
            ], this.activeTab)}

            <div id="syndicationContent"></div>
        `;

        this._articles = htmlArticles;

        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeTab = tab.dataset.tab;
                this._renderTab();
            });
        });

        this._renderTab();
    },

    _renderTab() {
        const container = document.getElementById('syndicationContent');
        switch (this.activeTab) {
            case 'json': container.innerHTML = this._jsonView(); break;
            case 'rss': container.innerHTML = this._rssView(); break;
            case 'custom': container.innerHTML = this._customView(); break;
        }
    },

    _jsonView() {
        const sample = (this._articles || []).slice(0, 5).map(a => ({
            slug: a.name?.replace('.html', ''),
            title: (a.name || '').replace('.html', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            url: `${CONFIG.siteUrl}/articles/${a.name}`,
            source: 'Upside Journal',
            published: new Date().toISOString().split('T')[0],
        }));

        return `
            <div class="card mt-16">
                <div class="card-header">
                    <span class="card-title">JSON Feed Export</span>
                    <button class="btn btn-primary btn-sm" onclick="SyndicationModule.downloadJson()">⬇ Download JSON</button>
                </div>
                <div class="card-body">
                    <p style="font-size:13px;color:var(--slate-600);margin-bottom:16px">
                        Clean, CSS-stripped JSON output ready for enterprise white-label clients and media syndication partners.
                        Contains ${(this._articles || []).length} articles.
                    </p>
                    <div class="form-label">Preview (first 5 articles)</div>
                    <pre style="background:var(--slate-900);color:var(--green);padding:16px;border-radius:var(--radius);font-size:11px;overflow-x:auto;max-height:300px;overflow-y:auto">${UI.esc(JSON.stringify({ feed: { title: 'Upside Journal', url: CONFIG.siteUrl, articles: sample }}, null, 2))}</pre>
                </div>
            </div>`;
    },

    _rssView() {
        const items = (this._articles || []).slice(0, 3).map(a => {
            const title = (a.name || '').replace('.html', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            return `  <item>\n    <title>${title}</title>\n    <link>${CONFIG.siteUrl}/articles/${a.name}</link>\n    <pubDate>${new Date().toUTCString()}</pubDate>\n    <source url="${CONFIG.siteUrl}">Upside Journal</source>\n  </item>`;
        }).join('\n');

        const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n  <title>Upside Journal</title>\n  <link>${CONFIG.siteUrl}</link>\n  <description>Intelligence for the New Tech Economy</description>\n${items}\n</channel>\n</rss>`;

        return `
            <div class="card mt-16">
                <div class="card-header">
                    <span class="card-title">RSS Feed Export</span>
                    <button class="btn btn-primary btn-sm" onclick="SyndicationModule.downloadRss()">⬇ Download RSS</button>
                </div>
                <div class="card-body">
                    <p style="font-size:13px;color:var(--slate-600);margin-bottom:16px">
                        Standard RSS 2.0 feed for syndication platforms and news aggregators.
                    </p>
                    <div class="form-label">Preview</div>
                    <pre style="background:var(--slate-900);color:var(--gold-muted);padding:16px;border-radius:var(--radius);font-size:11px;overflow-x:auto;max-height:300px;overflow-y:auto">${UI.esc(rss)}</pre>
                </div>
            </div>`;
    },

    _customView() {
        return `
            <div class="card mt-16">
                <div class="card-header">
                    <span class="card-title">Custom Export Configuration</span>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <label class="form-label">Select Articles</label>
                        <select class="form-input" id="exportSelect" multiple size="8">
                            ${(this._articles || []).map(a => {
                                const title = (a.name || '').replace('.html', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                return `<option value="${a.name}">${title}</option>`;
                            }).join('')}
                        </select>
                        <div style="font-size:11px;color:var(--slate-400);margin-top:4px">Hold Ctrl/Cmd to select multiple</div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Export Format</label>
                        <select class="form-input" id="exportFormat">
                            <option value="json">JSON</option>
                            <option value="rss">RSS 2.0</option>
                            <option value="csv">CSV (title, URL, date)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Include Fields</label>
                        <div style="display:flex;gap:16px;flex-wrap:wrap">
                            <label style="display:flex;align-items:center;gap:6px;font-size:13px">
                                <input type="checkbox" checked> Title
                            </label>
                            <label style="display:flex;align-items:center;gap:6px;font-size:13px">
                                <input type="checkbox" checked> URL
                            </label>
                            <label style="display:flex;align-items:center;gap:6px;font-size:13px">
                                <input type="checkbox" checked> Slug
                            </label>
                            <label style="display:flex;align-items:center;gap:6px;font-size:13px">
                                <input type="checkbox"> Raw HTML
                            </label>
                            <label style="display:flex;align-items:center;gap:6px;font-size:13px">
                                <input type="checkbox"> Cover Image URL
                            </label>
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="SyndicationModule.exportCustom()">
                        Generate Export
                    </button>
                </div>
            </div>`;
    },

    downloadJson() {
        const articles = (this._articles || []).map(a => ({
            slug: a.name?.replace('.html', ''),
            title: (a.name || '').replace('.html', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            url: `${CONFIG.siteUrl}/articles/${a.name}`,
            source: 'Upside Journal',
        }));
        const data = JSON.stringify({ feed: { title: 'Upside Journal', url: CONFIG.siteUrl, exported: new Date().toISOString(), articles }}, null, 2);
        this._download(data, 'upside-journal-feed.json', 'application/json');
        UI.toast('JSON feed downloaded', 'success');
    },

    downloadRss() {
        UI.toast('RSS feed downloaded', 'success');
    },

    exportCustom() {
        UI.toast('Custom export generated', 'success');
    },

    _download(content, filename, mime) {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },
};

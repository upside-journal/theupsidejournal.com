/* ═══════════════════════════════════════════════════
   UNIFIED ANALYTICS CONSOLE
   GA4, Search Console, AdSense — all in one view.
   ═══════════════════════════════════════════════════ */

const AnalyticsModule = {
    activeTab: 'traffic',
    period: 30,

    async render() {
        const page = document.getElementById('pageContainer');

        page.innerHTML = `
            ${UI.sectionHeader('Unified Analytics Console',
                'GA4 · Google Search Console · AdSense',
                `<select class="form-input" style="width:auto" id="periodSelect" onchange="AnalyticsModule.changePeriod(this.value)">
                    <option value="7" ${this.period === 7 ? 'selected' : ''}>Last 7 days</option>
                    <option value="14" ${this.period === 14 ? 'selected' : ''}>Last 14 days</option>
                    <option value="30" ${this.period === 30 ? 'selected' : ''}>Last 30 days</option>
                    <option value="90" ${this.period === 90 ? 'selected' : ''}>Last 90 days</option>
                </select>`
            )}

            ${UI.tabs([
                { id: 'traffic', label: 'Traffic & Engagement' },
                { id: 'search', label: 'Search Console' },
                { id: 'adsense', label: 'AdSense Revenue' },
            ], this.activeTab)}

            <div id="analyticsContent"></div>
        `;

        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeTab = tab.dataset.tab;
                this._renderTab();
            });
        });

        this._renderTab();
    },

    changePeriod(val) {
        this.period = parseInt(val);
        this._renderTab();
    },

    _renderTab() {
        const container = document.getElementById('analyticsContent');
        switch (this.activeTab) {
            case 'traffic': this._renderTraffic(container); break;
            case 'search': this._renderSearch(container); break;
            case 'adsense': this._renderAdsense(container); break;
        }
    },

    async _renderTraffic(container) {
        container.innerHTML = UI.loading('Fetching GA4 data...');

        try {
            const data = await API.analytics.getTraffic(this.period);
            container.innerHTML = this._trafficView(data);
        } catch (e) {
            // Show placeholder with configuration guidance
            container.innerHTML = this._trafficPlaceholder();
        }
    },

    _trafficPlaceholder() {
        return `
            <div class="stats-grid mt-16">
                ${UI.statCard('SESSIONS', '—', 'Awaiting GA4 connection')}
                ${UI.statCard('PAGE VIEWS', '—', 'Awaiting GA4 connection')}
                ${UI.statCard('AVG DURATION', '—', 'Awaiting GA4 connection')}
                ${UI.statCard('BOUNCE RATE', '—', 'Awaiting GA4 connection')}
            </div>
            <div class="grid-2 mt-16">
                ${UI.card('Sessions Over Time', `
                    <div class="chart-placeholder">
                        <div style="text-align:center">
                            <div style="font-size:24px;margin-bottom:8px">📊</div>
                            <div>GA4 API connection required</div>
                            <div style="font-size:11px;color:var(--slate-400);margin-top:4px">
                                Property ID: ${CONFIG.ga4.propertyId}<br>
                                Measurement ID: ${CONFIG.ga4.measurementId}
                            </div>
                        </div>
                    </div>
                `)}
                ${UI.card('Top Pages', `
                    <div class="chart-placeholder">
                        <div style="text-align:center">
                            <div style="font-size:24px;margin-bottom:8px">📄</div>
                            <div>Connect GA4 API to see top-performing pages</div>
                        </div>
                    </div>
                `)}
            </div>
            <div class="mt-16">
                ${UI.card('⚙ Configuration', `
                    <div style="font-size:13px;color:var(--slate-600);line-height:1.7">
                        <p><strong>To activate live analytics:</strong></p>
                        <ol style="padding-left:20px;margin-top:8px">
                            <li>Create a Google Cloud service account with GA4 read access</li>
                            <li>Add the service account JSON key as a Cloudflare Pages environment variable: <code style="background:var(--slate-100);padding:2px 6px;border-radius:3px">GA4_SERVICE_KEY</code></li>
                            <li>The API proxy at <code>/api/analytics</code> will pick it up automatically</li>
                        </ol>
                        <p style="margin-top:12px;color:var(--slate-500)">GA4 Property ID: <strong>${CONFIG.ga4.propertyId}</strong></p>
                    </div>
                `)}
            </div>`;
    },

    _trafficView(data) {
        return `
            <div class="stats-grid mt-16">
                ${UI.statCard('SESSIONS', UI.num(data.sessions || 0), data.sessionsChange || '')}
                ${UI.statCard('PAGE VIEWS', UI.num(data.pageViews || 0), data.pageViewsChange || '')}
                ${UI.statCard('AVG DURATION', (data.avgDuration || 0) + 's')}
                ${UI.statCard('BOUNCE RATE', (data.bounceRate || 0) + '%')}
            </div>
            <div class="grid-2 mt-16">
                ${UI.card('Sessions Over Time', data.dailySessions
                    ? UI.barChart(data.dailySessions.map(d => ({ label: d.date?.slice(-5) || '', value: d.sessions || 0 })))
                    : '<div class="chart-placeholder">No data</div>'
                )}
                ${UI.card('Top Pages', data.topPages
                    ? UI.table(['Page', 'Views', 'Avg Duration'], data.topPages.slice(0, 10).map(p => [
                        UI.truncate(p.page || '', 50),
                        UI.num(p.views || 0),
                        (p.duration || 0) + 's',
                    ]))
                    : '<div class="chart-placeholder">No data</div>'
                )}
            </div>`;
    },

    async _renderSearch(container) {
        container.innerHTML = UI.loading('Fetching Search Console data...');

        try {
            const data = await API.analytics.getSearchConsole(this.period);
            container.innerHTML = this._searchView(data);
        } catch (e) {
            container.innerHTML = `
                <div class="stats-grid mt-16">
                    ${UI.statCard('TOTAL CLICKS', '—', 'Awaiting GSC connection')}
                    ${UI.statCard('IMPRESSIONS', '—', 'Awaiting GSC connection')}
                    ${UI.statCard('AVG CTR', '—', 'Awaiting GSC connection')}
                    ${UI.statCard('AVG POSITION', '—', 'Awaiting GSC connection')}
                </div>
                ${UI.card('Top Queries', `
                    <div class="chart-placeholder">
                        <div style="text-align:center">
                            <div style="font-size:24px;margin-bottom:8px">🔍</div>
                            <div>Connect Google Search Console API</div>
                            <div style="font-size:11px;color:var(--slate-400);margin-top:4px">
                                Site: ${CONFIG.siteUrl}
                            </div>
                        </div>
                    </div>
                `)}`;
        }
    },

    _searchView(data) {
        return `
            <div class="stats-grid mt-16">
                ${UI.statCard('TOTAL CLICKS', UI.num(data.clicks || 0))}
                ${UI.statCard('IMPRESSIONS', UI.num(data.impressions || 0))}
                ${UI.statCard('AVG CTR', (data.ctr || 0).toFixed(1) + '%')}
                ${UI.statCard('AVG POSITION', (data.position || 0).toFixed(1))}
            </div>
            ${data.queries ? UI.card('Top Search Queries', UI.table(
                ['Query', 'Clicks', 'Impressions', 'CTR', 'Position'],
                data.queries.slice(0, 15).map(q => [
                    UI.esc(q.query || ''),
                    q.clicks || 0,
                    UI.num(q.impressions || 0),
                    (q.ctr || 0).toFixed(1) + '%',
                    (q.position || 0).toFixed(1),
                ])
            )) : ''}`;
    },

    async _renderAdsense(container) {
        container.innerHTML = `
            <div class="stats-grid mt-16">
                ${UI.statCard('PUBLISHER ID', CONFIG.adsense.publisherId)}
                ${UI.statCard('LIVE PAGES', '34+')}
                ${UI.statCard('ESTIMATED RPM', '—', 'Connect AdSense API')}
                ${UI.statCard('EARNINGS (30d)', '—', 'Connect AdSense API')}
            </div>
            ${UI.card('AdSense Performance', `
                <div class="chart-placeholder">
                    <div style="text-align:center">
                        <div style="font-size:24px;margin-bottom:8px">💰</div>
                        <div>AdSense API integration</div>
                        <div style="font-size:11px;color:var(--slate-400);margin-top:4px">
                            Publisher: ${CONFIG.adsense.publisherId}<br>
                            Add <code>ADSENSE_KEY</code> env variable to activate
                        </div>
                    </div>
                </div>
            `)}
            ${UI.card('Revenue by Article', `
                <div style="font-size:13px;color:var(--slate-500)">
                    Once connected, this panel shows per-article AdSense performance including page RPM, impressions, and click-through rates across all 34+ live pages.
                </div>
            `)}`;
    },
};

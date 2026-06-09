/* ═══════════════════════════════════════════════════
   SEO / GEO DIAGNOSTIC SUITE
   Metadata validation + AI search visibility preview
   ═══════════════════════════════════════════════════ */

const SeoModule = {
    activeTab: 'validator',
    lastResults: null,

    async render() {
        const page = document.getElementById('pageContainer');

        // Check if URL was passed via hash params
        const hash = window.location.hash;
        const urlParam = hash.includes('?url=') ? decodeURIComponent(hash.split('?url=')[1]) : '';

        page.innerHTML = `
            ${UI.sectionHeader('SEO / GEO Diagnostic Suite',
                'Validate metadata, test AI search visibility, check sitemap health'
            )}

            ${UI.tabs([
                { id: 'validator', label: 'Metadata Validator' },
                { id: 'geo', label: 'GEO Previewer' },
                { id: 'sitemap', label: 'Sitemap Health' },
            ], this.activeTab)}

            <div id="seoContent"></div>
        `;

        // Bind tabs
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeTab = tab.dataset.tab;
                this._renderTab();
            });
        });

        this._renderTab(urlParam);
    },

    _renderTab(prefillUrl = '') {
        const container = document.getElementById('seoContent');
        switch (this.activeTab) {
            case 'validator': container.innerHTML = this._validatorView(prefillUrl); break;
            case 'geo': container.innerHTML = this._geoView(); break;
            case 'sitemap': container.innerHTML = this._sitemapView(); break;
        }
    },

    // ─── Metadata Validator ───
    _validatorView(prefillUrl = '') {
        return `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Check Page Metadata</span>
                </div>
                <div class="card-body">
                    <div style="display:flex;gap:8px;margin-bottom:20px">
                        <input type="text" class="form-input" id="seoUrl"
                            placeholder="https://theupsidejournal.com/articles/..."
                            value="${prefillUrl || CONFIG.siteUrl}">
                        <button class="btn btn-primary" onclick="SeoModule.runCheck()" style="flex-shrink:0">
                            Run Check
                        </button>
                    </div>
                    <div id="seoResults">
                        ${this.lastResults ? this._renderResults(this.lastResults) : `
                            <div class="empty-state">
                                <div class="empty-state-icon">◎</div>
                                <div class="empty-state-title">Enter a URL to validate</div>
                                <div class="empty-state-text">Checks Open Graph, Twitter Cards, JSON-LD, meta description, and canonical tags</div>
                            </div>
                        `}
                    </div>
                </div>
            </div>`;
    },

    async runCheck() {
        const url = document.getElementById('seoUrl')?.value;
        if (!url) return;

        const results = document.getElementById('seoResults');
        results.innerHTML = UI.loading('Analyzing metadata...');

        try {
            // Use the API proxy to fetch and parse the page
            const data = await API.seo.checkUrl(url);
            this.lastResults = data;
            results.innerHTML = this._renderResults(data);
        } catch (e) {
            // Fallback: try direct client-side fetch
            try {
                const res = await fetch(url);
                const html = await res.text();
                const data = this._parseHtml(html, url);
                this.lastResults = data;
                results.innerHTML = this._renderResults(data);
            } catch (e2) {
                results.innerHTML = `<div class="empty-state">
                    <div class="empty-state-icon">⚠</div>
                    <div class="empty-state-title">Could not fetch URL</div>
                    <div class="empty-state-text">${UI.esc(e2.message)}. API proxy may not be configured yet.</div>
                </div>`;
            }
        }
    },

    _parseHtml(html, url) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const checks = [];
        let score = 0;
        const total = 10;

        // Title
        const title = doc.querySelector('title')?.textContent;
        checks.push({
            label: 'Page Title',
            status: title && title.length > 10 ? 'pass' : 'fail',
            detail: title ? `"${title}" (${title.length} chars)` : 'Missing',
        });
        if (title && title.length > 10) score++;

        // Meta description
        const desc = doc.querySelector('meta[name="description"]')?.getAttribute('content');
        checks.push({
            label: 'Meta Description',
            status: desc && desc.length > 50 ? 'pass' : desc ? 'warn' : 'fail',
            detail: desc ? `${desc.length} chars — "${desc.substring(0, 80)}..."` : 'Missing',
        });
        if (desc && desc.length > 50) score++;

        // OG Title
        const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
        checks.push({
            label: 'Open Graph: Title',
            status: ogTitle ? 'pass' : 'fail',
            detail: ogTitle || 'Missing og:title',
        });
        if (ogTitle) score++;

        // OG Description
        const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
        checks.push({
            label: 'Open Graph: Description',
            status: ogDesc ? 'pass' : 'fail',
            detail: ogDesc ? ogDesc.substring(0, 80) + '...' : 'Missing og:description',
        });
        if (ogDesc) score++;

        // OG Image
        const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
        checks.push({
            label: 'Open Graph: Image',
            status: ogImage ? 'pass' : 'warn',
            detail: ogImage || 'Missing — social shares will lack a preview image',
        });
        if (ogImage) score++;

        // OG URL
        const ogUrl = doc.querySelector('meta[property="og:url"]')?.getAttribute('content');
        checks.push({
            label: 'Open Graph: URL',
            status: ogUrl ? 'pass' : 'warn',
            detail: ogUrl || 'Missing og:url',
        });
        if (ogUrl) score++;

        // Twitter Card
        const twCard = doc.querySelector('meta[name="twitter:card"]')?.getAttribute('content');
        checks.push({
            label: 'Twitter Card',
            status: twCard ? 'pass' : 'warn',
            detail: twCard ? `Type: ${twCard}` : 'Missing twitter:card',
        });
        if (twCard) score++;

        // Canonical
        const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
        checks.push({
            label: 'Canonical URL',
            status: canonical ? 'pass' : 'warn',
            detail: canonical || 'No canonical link — may cause duplicate content issues',
        });
        if (canonical) score++;

        // JSON-LD
        const jsonLd = doc.querySelectorAll('script[type="application/ld+json"]');
        const jsonLdData = [];
        jsonLd.forEach(s => {
            try { jsonLdData.push(JSON.parse(s.textContent)); } catch {}
        });
        checks.push({
            label: 'JSON-LD Structured Data',
            status: jsonLdData.length > 0 ? 'pass' : 'fail',
            detail: jsonLdData.length > 0
                ? `${jsonLdData.length} block(s) — types: ${jsonLdData.map(d => d['@type']).join(', ')}`
                : 'No JSON-LD found — critical for AI search visibility',
        });
        if (jsonLdData.length > 0) score++;

        // H1
        const h1s = doc.querySelectorAll('h1');
        checks.push({
            label: 'H1 Heading',
            status: h1s.length === 1 ? 'pass' : h1s.length > 1 ? 'warn' : 'fail',
            detail: h1s.length === 1 ? h1s[0].textContent.substring(0, 80) : `Found ${h1s.length} H1 tags`,
        });
        if (h1s.length >= 1) score++;

        return { url, score, total, checks, jsonLd: jsonLdData, title, description: desc };
    },

    _renderResults(data) {
        const pct = Math.round((data.score / data.total) * 100);
        const scoreCls = pct >= 80 ? 'good' : pct >= 50 ? 'ok' : 'bad';

        const checksHtml = data.checks.map(c => {
            const icon = c.status === 'pass' ? '✓' : c.status === 'warn' ? '⚠' : '✗';
            return `
                <div class="check-item">
                    <span class="check-icon ${c.status}">${icon}</span>
                    <div class="check-text">
                        <div class="check-label">${c.label}</div>
                        <div class="check-detail">${c.detail}</div>
                    </div>
                </div>`;
        }).join('');

        return `
            <div style="display:flex;gap:24px;align-items:flex-start;margin-bottom:20px">
                <div class="seo-score ${scoreCls}">${pct}</div>
                <div>
                    <div style="font-weight:700;font-size:16px;color:var(--slate-900)">${data.score}/${data.total} checks passed</div>
                    <div style="font-size:13px;color:var(--slate-500);margin-top:2px">${data.url}</div>
                </div>
            </div>
            ${checksHtml}
            ${data.jsonLd && data.jsonLd.length > 0 ? `
                <div class="mt-24">
                    <div class="form-label">JSON-LD Preview</div>
                    <pre style="background:var(--slate-50);padding:12px;border-radius:var(--radius);font-size:11px;overflow-x:auto;border:1px solid var(--slate-200);max-height:200px;overflow-y:auto">${UI.esc(JSON.stringify(data.jsonLd, null, 2))}</pre>
                </div>
            ` : ''}
        `;
    },

    // ─── GEO Previewer ───
    _geoView() {
        return `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Generative Engine Optimization (GEO) Preview</span>
                </div>
                <div class="card-body">
                    <p style="font-size:13px;color:var(--slate-600);margin-bottom:16px">
                        Simulates how AI search platforms (Perplexity, Gemini, ChatGPT Search) parse your structured data to generate answers.
                    </p>
                    <div style="display:flex;gap:8px;margin-bottom:20px">
                        <input type="text" class="form-input" id="geoUrl"
                            placeholder="https://theupsidejournal.com/articles/..."
                            value="${CONFIG.siteUrl}">
                        <button class="btn btn-primary" onclick="SeoModule.runGeoPreview()" style="flex-shrink:0">
                            Generate Preview
                        </button>
                    </div>
                    <div id="geoResults">
                        ${this._geoPlaceholder()}
                    </div>
                </div>
            </div>`;
    },

    _geoPlaceholder() {
        return `
            <div style="background:var(--slate-50);border:1px solid var(--slate-200);border-radius:var(--radius);padding:20px">
                <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px">
                    <div style="width:24px;height:24px;background:var(--slate-300);border-radius:50%"></div>
                    <div style="font-size:13px;font-weight:600;color:var(--slate-500)">AI Search Preview</div>
                </div>
                <div style="color:var(--slate-400);font-size:13px">
                    Enter a URL above to see how AI search engines would summarize this page based on its structured data, headings, and meta tags.
                </div>
            </div>`;
    },

    async runGeoPreview() {
        const url = document.getElementById('geoUrl')?.value;
        if (!url) return;

        const results = document.getElementById('geoResults');
        results.innerHTML = UI.loading('Analyzing page for AI search engines...');

        try {
            const res = await fetch(url);
            const html = await res.text();
            const data = this._parseHtml(html, url);
            results.innerHTML = this._renderGeoPreview(data);
        } catch (e) {
            results.innerHTML = `<div style="color:var(--red);font-size:13px">Could not fetch: ${e.message}</div>`;
        }
    },

    _renderGeoPreview(data) {
        // Build a simulated AI answer based on structured data
        const jsonLd = data.jsonLd?.[0] || {};
        const siteName = 'Upside Journal';

        return `
            <div style="background:var(--slate-50);border:1px solid var(--slate-200);border-radius:var(--radius);padding:20px">
                <!-- Perplexity-style preview -->
                <div style="margin-bottom:24px">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                        <div style="width:20px;height:20px;background:#5436DA;border-radius:4px;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:700">P</div>
                        <span style="font-size:12px;font-weight:600;color:var(--slate-600)">Perplexity-style Answer</span>
                    </div>
                    <div style="font-size:14px;line-height:1.7;color:var(--slate-700)">
                        ${data.description
                            ? `<p>According to ${siteName}, ${data.description}</p>`
                            : `<p style="color:var(--amber)">⚠ No meta description found — AI engines will struggle to generate a coherent summary.</p>`
                        }
                        ${jsonLd['@type'] ? `<p style="font-size:12px;color:var(--slate-500);margin-top:8px">
                            Content type detected: <strong>${jsonLd['@type']}</strong>
                            ${jsonLd.author ? ` · Author: ${typeof jsonLd.author === 'string' ? jsonLd.author : jsonLd.author?.name || 'Unknown'}` : ''}
                            ${jsonLd.datePublished ? ` · Published: ${jsonLd.datePublished}` : ''}
                        </p>` : ''}
                    </div>
                    <div style="margin-top:12px;padding:10px;background:var(--white);border:1px solid var(--slate-200);border-radius:6px;font-size:12px">
                        <strong>Source:</strong> <a href="${data.url}" style="color:var(--blue)">${data.url}</a>
                    </div>
                </div>

                <!-- Signal strength -->
                <div style="border-top:1px solid var(--slate-200);padding-top:16px">
                    <div style="font-size:12px;font-weight:600;color:var(--slate-600);margin-bottom:8px">GEO Signal Strength</div>
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
                        <div style="text-align:center">
                            <div style="font-size:20px;font-weight:700;color:${data.jsonLd?.length ? 'var(--green)' : 'var(--red)'}">${data.jsonLd?.length ? '✓' : '✗'}</div>
                            <div style="font-size:11px;color:var(--slate-500)">JSON-LD</div>
                        </div>
                        <div style="text-align:center">
                            <div style="font-size:20px;font-weight:700;color:${data.description ? 'var(--green)' : 'var(--red)'}">${data.description ? '✓' : '✗'}</div>
                            <div style="font-size:11px;color:var(--slate-500)">Meta Desc</div>
                        </div>
                        <div style="text-align:center">
                            <div style="font-size:20px;font-weight:700;color:${data.checks?.find(c => c.label.includes('H1'))?.status === 'pass' ? 'var(--green)' : 'var(--red)'}">${data.checks?.find(c => c.label.includes('H1'))?.status === 'pass' ? '✓' : '✗'}</div>
                            <div style="font-size:11px;color:var(--slate-500)">Heading Structure</div>
                        </div>
                    </div>
                </div>
            </div>`;
    },

    // ─── Sitemap Health ───
    _sitemapView() {
        return `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">Sitemap Health Check</span>
                    <button class="btn btn-secondary btn-sm" onclick="SeoModule.checkSitemap()">Run Check</button>
                </div>
                <div class="card-body" id="sitemapResults">
                    <div style="display:flex;gap:8px;align-items:center;margin-bottom:16px">
                        <a href="${CONFIG.siteUrl}/sitemap.xml" target="_blank" class="btn btn-ghost btn-sm">View sitemap.xml ↗</a>
                        <a href="${CONFIG.siteUrl}/robots.txt" target="_blank" class="btn btn-ghost btn-sm">View robots.txt ↗</a>
                    </div>
                    ${UI.empty('🗺', 'Click "Run Check" to validate', 'Checks XML sitemap structure, URL count, and robots.txt configuration')}
                </div>
            </div>`;
    },

    async checkSitemap() {
        const container = document.getElementById('sitemapResults');
        container.innerHTML = UI.loading('Fetching sitemap...');

        try {
            const res = await fetch(CONFIG.siteUrl + '/sitemap.xml');
            const text = await res.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');
            const urls = xml.querySelectorAll('url');

            const urlList = Array.from(urls).map(u => ({
                loc: u.querySelector('loc')?.textContent || '',
                lastmod: u.querySelector('lastmod')?.textContent || '',
                changefreq: u.querySelector('changefreq')?.textContent || '',
            }));

            container.innerHTML = `
                <div style="display:flex;gap:16px;margin-bottom:20px">
                    ${UI.statCard('URLS IN SITEMAP', urlList.length)}
                    ${UI.statCard('STATUS', res.ok ? 'Valid ✓' : 'Error')}
                </div>
                ${UI.table(
                    ['URL', 'Last Modified', 'Frequency'],
                    urlList.map(u => [
                        `<a href="${u.loc}" target="_blank" style="color:var(--blue);font-size:12px">${u.loc.replace(CONFIG.siteUrl, '')}</a>`,
                        u.lastmod || '—',
                        u.changefreq || '—',
                    ])
                )}
            `;
        } catch (e) {
            container.innerHTML = `<div style="color:var(--red)">Could not fetch sitemap: ${e.message}</div>`;
        }
    },
};

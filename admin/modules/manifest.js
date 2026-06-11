/* ═══════════════════════════════════════════════════
   MANIFEST MODULE  (v7 — Session 7)
   Reads the Video & Image Manifest from Google Sheets.
   Monthly tabs auto-switch. Provides slug-based lookups.
   ═══════════════════════════════════════════════════ */

const ManifestModule = {
    _cache: null,
    _cacheKey: null,
    _loading: false,

    /* ─── Sheet access via published CSV/JSON ─── */
    _sheetId: '1FQ_R3Kp0f6pE6JtVbiwpvZdyAi8nmcvbMxKbw8FQcB8',

    /**
     * Get current month's tab name: "June 2026", "July 2026" etc.
     */
    getCurrentTabName() {
        const now = new Date();
        const months = ['January','February','March','April','May','June',
                        'July','August','September','October','November','December'];
        return `${months[now.getMonth()]} ${now.getFullYear()}`;
    },

    /**
     * Fetch manifest data from Google Sheets (public).
     * Uses the gviz JSON endpoint — no auth needed if sheet is shared.
     */
    async fetchManifest(tabName) {
        const tab = tabName || this.getCurrentTabName();
        const cacheKey = `manifest_${tab}`;

        // Return cache if fresh (< 5 min)
        if (this._cache && this._cacheKey === cacheKey) {
            return this._cache;
        }

        // Check localStorage cache
        const cached = localStorage.getItem(cacheKey);
        const cacheTime = localStorage.getItem(cacheKey + '_ts');
        if (cached && cacheTime && (Date.now() - parseInt(cacheTime)) < 300000) {
            this._cache = JSON.parse(cached);
            this._cacheKey = cacheKey;
            return this._cache;
        }

        try {
            this._loading = true;
            const encodedTab = encodeURIComponent(tab);
            const url = `https://docs.google.com/spreadsheets/d/${this._sheetId}/gviz/tq?tqx=out:json&sheet=${encodedTab}`;

            const res = await fetch(url);
            const text = await res.text();

            // gviz response is wrapped: google.visualization.Query.setResponse({...})
            const jsonStr = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]+)\);?$/);
            if (!jsonStr) throw new Error('Invalid gviz response');

            const gviz = JSON.parse(jsonStr[1]);
            const cols = gviz.table.cols.map(c => c.label || c.id);
            const rows = (gviz.table.rows || []).map(r => {
                const obj = {};
                r.c.forEach((cell, i) => {
                    if (!cell || cell.v == null) { obj[cols[i]] = ''; return; }
                    let val = cell.f || String(cell.v); // prefer formatted value
                    // Handle gviz Date() format → YYYY-MM-DD
                    const dateMatch = String(cell.v).match(/^Date\((\d+),(\d+),(\d+)\)$/);
                    if (dateMatch) {
                        const [, y, m, d] = dateMatch;
                        val = `${y}-${String(+m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    }
                    obj[cols[i]] = val;
                });
                return obj;
            });

            // Build lookup by slug
            const manifest = {
                tab,
                articles: rows,
                bySlug: {},
                fetchedAt: Date.now(),
            };
            rows.forEach(row => {
                if (row['Slug']) {
                    manifest.bySlug[row['Slug']] = row;
                }
            });

            // Cache it
            this._cache = manifest;
            this._cacheKey = cacheKey;
            localStorage.setItem(cacheKey, JSON.stringify(manifest));
            localStorage.setItem(cacheKey + '_ts', String(Date.now()));

            return manifest;
        } catch (e) {
            console.error('Manifest fetch error:', e);
            // Return empty manifest
            return { tab, articles: [], bySlug: {}, fetchedAt: 0, error: e.message };
        } finally {
            this._loading = false;
        }
    },

    /**
     * Get video + image info for a specific article slug.
     * Returns { videoFilename, videoStatus, imageFilename, imageStatus, ... }
     */
    async getArticleMedia(slug) {
        const manifest = await this.fetchManifest();
        const entry = manifest.bySlug[slug];
        if (!entry) return null;
        return {
            slug: entry['Slug'],
            title: entry['Title'],
            date: entry['Publish Date'],
            series: entry['Series'],
            videoFilename: entry['Video Filename'] || '',
            videoStatus: entry['Video Status'] || '',
            imageFilename: entry['Image Filename'] || '',
            imageStatus: entry['Image Status'] || '',
            articleStatus: entry['Article Status'] || '',
            notes: entry['Notes'] || '',
        };
    },

    /**
     * Get all articles with their media status, grouped by week.
     */
    async getByWeek() {
        const manifest = await this.fetchManifest();
        const weeks = {};

        manifest.articles.forEach(article => {
            if (!article['Publish Date']) return;
            const d = new Date(article['Publish Date']);
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay() + 1); // Monday
            const weekKey = weekStart.toISOString().split('T')[0];
            const weekNum = this._getWeekNumber(d);
            const label = `Week ${weekNum} (${weekStart.toLocaleDateString('en-GB', { day:'numeric', month:'short' })})`;

            if (!weeks[weekKey]) weeks[weekKey] = { label, articles: [] };
            weeks[weekKey].articles.push(article);
        });

        return Object.entries(weeks)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, val]) => val);
    },

    /**
     * Search articles by text in slug/title.
     */
    async search(query) {
        const manifest = await this.fetchManifest();
        const q = query.toLowerCase();
        return manifest.articles.filter(a =>
            (a['Slug'] || '').toLowerCase().includes(q) ||
            (a['Title'] || '').toLowerCase().includes(q)
        );
    },

    /**
     * Build video URL from filename. Falls back to repo /videos/ if no proxy.
     */
    getVideoUrl(filename) {
        if (!filename) return null;
        const baseUrl = CONFIG.video?.baseUrl || CONFIG.siteUrl + '/videos';
        return `${baseUrl}/${filename}`;
    },

    /**
     * Build image URL from filename.
     */
    getImageUrl(filename) {
        if (!filename) return null;
        return `${CONFIG.siteUrl}/images/social/${filename}`;
    },

    /**
     * Invalidate cache (force refresh on next fetch).
     */
    clearCache() {
        this._cache = null;
        this._cacheKey = null;
        const tab = this.getCurrentTabName();
        localStorage.removeItem(`manifest_${tab}`);
        localStorage.removeItem(`manifest_${tab}_ts`);
    },

    /* ─── Helpers ─── */
    _getWeekNumber(d) {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
        const week1 = new Date(date.getFullYear(), 0, 4);
        return 1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    },
};

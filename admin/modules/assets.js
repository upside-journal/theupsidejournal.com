/* ═══════════════════════════════════════════════════
   MULTI-PLATFORM ASSET CATALOG
   Per-article asset library synced with Google Drive
   ═══════════════════════════════════════════════════ */

const AssetsModule = {
    async render() {
        const page = document.getElementById('pageContainer');
        page.innerHTML = UI.loading('Loading asset catalog...');

        let images = [];
        try {
            // Fetch images directory from GitHub
            const res = await API.github.getFile('images');
            images = Array.isArray(res) ? res : [];
        } catch (e) {
            images = [];
        }

        // Group images by article slug
        const articles = {};
        images.forEach(img => {
            if (img.type !== 'file') return;
            const name = img.name || '';
            // Extract article slug from filename pattern: slug-cover.png, slug-incontent.png
            const match = name.match(/^(.+?)-(cover|incontent|social|carousel|inline-?\d*)\./);
            if (match) {
                const slug = match[1];
                if (!articles[slug]) articles[slug] = [];
                articles[slug].push({
                    name: img.name,
                    type: match[2],
                    url: `${CONFIG.siteUrl}/images/${img.name}`,
                    size: img.size,
                });
            }
        });

        const slugs = Object.keys(articles).sort();
        const totalAssets = images.filter(i => i.type === 'file').length;

        page.innerHTML = `
            ${UI.sectionHeader('Multi-Platform Asset Catalog',
                `${totalAssets} assets across ${slugs.length} articles`,
                `<button class="btn btn-secondary btn-sm" onclick="AssetsModule.render()">↻ Refresh</button>`
            )}

            <div class="stats-grid">
                ${UI.statCard('TOTAL ASSETS', totalAssets)}
                ${UI.statCard('ARTICLES WITH ASSETS', slugs.length)}
                ${UI.statCard('ASSET TYPES', 'Cover · In-content · Social · Carousel')}
            </div>

            <div class="mt-24">
                ${slugs.length > 0 ? slugs.map(slug => {
                    const assets = articles[slug];
                    const title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    return UI.card(title, `
                        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">
                            ${assets.map(a => `
                                <div style="text-align:center">
                                    <div style="width:100%;height:100px;background:var(--slate-100);border-radius:var(--radius-sm);overflow:hidden;margin-bottom:6px;display:flex;align-items:center;justify-content:center">
                                        <img src="${a.url}" alt="${a.name}"
                                             style="max-width:100%;max-height:100%;object-fit:cover"
                                             loading="lazy"
                                             onerror="this.parentElement.innerHTML='<span style=color:var(--slate-400)>🖼</span>'">
                                    </div>
                                    <div style="font-size:11px;font-weight:600;color:var(--slate-700)">${UI.badge(a.type, a.type === 'cover' ? 'gold' : 'slate')}</div>
                                    <div style="font-size:10px;color:var(--slate-500);margin-top:2px">${a.name}</div>
                                </div>
                            `).join('')}
                        </div>
                    `);
                }).join('<div style="margin-top:16px"></div>') : UI.card('Asset Catalog', UI.empty('⊞', 'No assets found', 'Image assets from the repo will be cataloged here'))}
            </div>
        `;
    },
};

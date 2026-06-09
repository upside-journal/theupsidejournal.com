/* ═══════════════════════════════════════════════════
   PUBLISHER — Content staging & HITL queue
   ═══════════════════════════════════════════════════ */

const PublisherModule = {
    articles: [],
    activeTab: 'live',
    editingFile: null,

    async render() {
        const page = document.getElementById('pageContainer');
        page.innerHTML = UI.loading('Loading publisher...');

        try {
            this.articles = await API.github.listArticles();
        } catch (e) {
            this.articles = [];
            UI.toast('Could not load articles from GitHub', 'error');
        }

        this._draw();
    },

    _draw() {
        const page = document.getElementById('pageContainer');
        const liveCount = this.articles.filter(a => a.name?.endsWith('.html')).length;

        // Update sidebar badge
        const badge = document.getElementById('draftCount');
        if (badge) badge.textContent = liveCount;

        page.innerHTML = `
            ${UI.sectionHeader('Publisher Engine', 'Review, edit, and publish content',
                `<button class="btn btn-primary" onclick="PublisherModule.showNewDraft()">+ New Draft</button>`
            )}

            ${UI.tabs([
                { id: 'live', label: 'Live Articles (' + liveCount + ')' },
                { id: 'editor', label: 'Editor' },
            ], this.activeTab)}

            <div id="publisherContent">
                ${this.activeTab === 'live' ? this._renderLiveQueue() : this._renderEditor()}
            </div>
        `;

        // Bind tab clicks
        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeTab = tab.dataset.tab;
                this._draw();
            });
        });
    },

    _renderLiveQueue() {
        if (!Array.isArray(this.articles) || this.articles.length === 0) {
            return UI.card('HITL Staging Queue',
                UI.empty('✎', 'No articles found', 'Articles from the GitHub repo will appear here')
            );
        }

        const sorted = [...this.articles]
            .filter(a => a.name?.endsWith('.html'))
            .sort((a, b) => (b.name || '').localeCompare(a.name || ''));

        const rows = sorted.map(a => {
            const slug = a.name.replace('.html', '');
            const title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const sizeKB = a.size ? (a.size / 1024).toFixed(1) + ' KB' : '—';

            return `
                <div class="queue-item">
                    <div class="queue-item-content">
                        <div class="queue-item-title">${UI.esc(title)}</div>
                        <div class="queue-item-meta">
                            <span>articles/${a.name}</span>
                            <span>${sizeKB}</span>
                            ${UI.badge('Live', 'green')}
                        </div>
                    </div>
                    <div class="queue-item-actions">
                        <button class="btn btn-secondary btn-xs" onclick="PublisherModule.editArticle('articles/${a.name}')">Edit</button>
                        <button class="btn btn-ghost btn-xs" onclick="PublisherModule.checkSeo('${slug}')">SEO Check</button>
                        <a href="${CONFIG.siteUrl}/articles/${a.name}" target="_blank" class="btn btn-ghost btn-xs">View ↗</a>
                    </div>
                </div>`;
        }).join('');

        return UI.card(`HITL Staging Queue — ${sorted.length} articles`, rows,
            `<div class="flex-between">
                <span style="font-size:12px;color:var(--slate-500)">Source: ${CONFIG.github.owner}/${CONFIG.github.repo}</span>
                <button class="btn btn-ghost btn-sm" onclick="PublisherModule.render()">↻ Refresh</button>
            </div>`
        );
    },

    _renderEditor() {
        return `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">${this.editingFile ? 'Editing: ' + this.editingFile : 'Markdown Editor'}</span>
                    <div style="display:flex;gap:6px">
                        ${this.editingFile ? `
                            <button class="btn btn-primary btn-sm" onclick="PublisherModule.publishArticle()">⬆ Publish Live</button>
                            <button class="btn btn-secondary btn-sm" onclick="PublisherModule.saveDraft()">💾 Save Draft</button>
                        ` : ''}
                    </div>
                </div>
                <div class="card-body">
                    ${!this.editingFile ? `
                        <div class="empty-state">
                            <div class="empty-state-icon">✎</div>
                            <div class="empty-state-title">No file open</div>
                            <div class="empty-state-text">Select an article from the queue, or create a new draft</div>
                        </div>
                    ` : `
                        <div class="form-group">
                            <label class="form-label">File path</label>
                            <input type="text" class="form-input" id="editorPath" value="${this.editingFile}" readonly>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Content (HTML/Markdown)</label>
                            <textarea class="editor-area" id="editorContent" placeholder="Loading content...">${this._editorContent || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Commit message</label>
                            <input type="text" class="form-input" id="commitMsg" value="Update ${this.editingFile}" placeholder="Describe your changes">
                        </div>
                    `}
                </div>
            </div>`;
    },

    async editArticle(path) {
        this.editingFile = path;
        this.activeTab = 'editor';
        this._editorContent = '';
        this._draw();

        const textarea = document.getElementById('editorContent');
        if (textarea) textarea.value = 'Loading...';

        try {
            const file = await API.github.getFile(path);
            const content = file.content ? atob(file.content) : file.raw || '';
            this._editorContent = content;
            if (textarea) textarea.value = content;
        } catch (e) {
            UI.toast('Could not load file: ' + e.message, 'error');
            if (textarea) textarea.value = '<!-- Could not load file -->';
        }
    },

    async publishArticle() {
        const content = document.getElementById('editorContent')?.value;
        const msg = document.getElementById('commitMsg')?.value || 'Update article';
        if (!content || !this.editingFile) return;

        try {
            UI.toast('Publishing to production...', 'warning');
            await API.github.commitFile(this.editingFile, btoa(unescape(encodeURIComponent(content))), msg);
            UI.toast('Published ✓ — auto-deploying via Cloudflare Pages', 'success');
        } catch (e) {
            UI.toast('Publish failed: ' + e.message, 'error');
        }
    },

    saveDraft() {
        const content = document.getElementById('editorContent')?.value;
        if (!content) return;
        // Store locally as draft
        localStorage.setItem('draft_' + this.editingFile, content);
        UI.toast('Draft saved locally', 'success');
    },

    showNewDraft() {
        this.editingFile = 'articles/new-article.html';
        this._editorContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Article — Upside Journal</title>
    <meta name="description" content="">
    <meta property="og:title" content="">
    <meta property="og:description" content="">
    <link rel="stylesheet" href="/styles.css">
    <link rel="stylesheet" href="/article.css">
</head>
<body>
    <!-- Your article content here -->
</body>
</html>`;
        this.activeTab = 'editor';
        this._draw();
    },

    checkSeo(slug) {
        window.location.hash = `/seo?url=${CONFIG.siteUrl}/articles/${slug}.html`;
    },
};

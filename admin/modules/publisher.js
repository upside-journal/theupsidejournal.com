/* ═══════════════════════════════════════════════════
   PUBLISHER — Content staging & HITL queue  (v3)
   Now with Visual ↔ Code toggle (Quill.js WYSIWYG)
   ═══════════════════════════════════════════════════ */

const PublisherModule = {
    articles: [],
    activeTab: 'live',
    editingFile: null,
    editorMode: 'visual',   // 'visual' | 'code'
    _quill: null,
    _editorContent: '',

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

        // Init Quill if in visual editor mode
        if (this.activeTab === 'editor' && this.editingFile && this.editorMode === 'visual') {
            this._initQuill();
        }
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
        const modeToggle = this.editingFile ? `
            <div class="editor-mode-toggle">
                <button class="mode-btn ${this.editorMode === 'visual' ? 'active' : ''}"
                        onclick="PublisherModule.switchMode('visual')">
                    ◉ Visual
                </button>
                <button class="mode-btn ${this.editorMode === 'code' ? 'active' : ''}"
                        onclick="PublisherModule.switchMode('code')">
                    ⟨/⟩ Code
                </button>
            </div>
        ` : '';

        return `
            <div class="card">
                <div class="card-header">
                    <span class="card-title">${this.editingFile ? 'Editing: ' + this.editingFile : 'Content Editor'}</span>
                    <div style="display:flex;gap:6px;align-items:center">
                        ${modeToggle}
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
                    ` : this.editorMode === 'visual' ? `
                        <div id="quillToolbar"></div>
                        <div id="quillEditor" style="min-height:450px;background:#fff;font-family:var(--sans);font-size:15px;line-height:1.7"></div>
                        <div class="form-group" style="margin-top:16px">
                            <label class="form-label">Commit message</label>
                            <input type="text" class="form-input" id="commitMsg" value="Update ${this.editingFile}" placeholder="Describe your changes">
                        </div>
                    ` : `
                        <div class="form-group">
                            <label class="form-label">File path</label>
                            <input type="text" class="form-input" id="editorPath" value="${this.editingFile}" readonly>
                        </div>
                        <div class="form-group">
                            <label class="form-label">HTML Source</label>
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

    /* ─── WYSIWYG Quill.js Integration ─── */
    _initQuill() {
        const container = document.getElementById('quillEditor');
        if (!container || typeof Quill === 'undefined') return;

        this._quill = new Quill('#quillEditor', {
            theme: 'snow',
            placeholder: 'Start writing your article…',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    ['link', 'image'],
                    ['clean'],
                ],
            },
        });

        // Load content into Quill
        if (this._editorContent) {
            // Extract body content for visual editing
            const bodyContent = this._extractBody(this._editorContent);
            this._quill.root.innerHTML = bodyContent;
        }
    },

    _extractBody(html) {
        // Extract just the <body> inner content for visual editing
        const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (match) return match[1].trim();
        // If no body tags, return the whole thing (might be a fragment)
        return html;
    },

    _wrapBody(bodyHtml) {
        // Re-wrap visual edits back into the full HTML document
        if (this._editorContent && this._editorContent.includes('<body')) {
            return this._editorContent.replace(
                /(<body[^>]*>)([\s\S]*?)(<\/body>)/i,
                `$1\n${bodyHtml}\n$3`
            );
        }
        return bodyHtml;
    },

    _getCurrentContent() {
        if (this.editorMode === 'visual' && this._quill) {
            const bodyHtml = this._quill.root.innerHTML;
            return this._wrapBody(bodyHtml);
        }
        return document.getElementById('editorContent')?.value || this._editorContent;
    },

    switchMode(mode) {
        // Sync content between modes before switching
        if (mode === this.editorMode) return;

        if (this.editorMode === 'visual' && this._quill) {
            // Visual → Code: save Quill content back
            const bodyHtml = this._quill.root.innerHTML;
            this._editorContent = this._wrapBody(bodyHtml);
        } else if (this.editorMode === 'code') {
            // Code → Visual: read textarea
            const ta = document.getElementById('editorContent');
            if (ta) this._editorContent = ta.value;
        }

        this.editorMode = mode;
        this._quill = null;
        this._draw();
    },

    /* ─── Article Actions ─── */
    async editArticle(path) {
        this.editingFile = path;
        this.activeTab = 'editor';
        this._editorContent = '';
        this.editorMode = 'visual';  // default to visual
        this._quill = null;
        this._draw();

        // Show loading state
        const edEl = document.getElementById('quillEditor') || document.getElementById('editorContent');
        if (edEl && edEl.tagName === 'TEXTAREA') edEl.value = 'Loading...';

        try {
            const file = await API.github.getFile(path);
            const content = file.content ? atob(file.content) : file.raw || '';
            this._editorContent = content;
            // Re-draw to load content into the editor
            this._draw();
        } catch (e) {
            UI.toast('Could not load file: ' + e.message, 'error');
        }
    },

    async publishArticle() {
        const content = this._getCurrentContent();
        const msg = document.getElementById('commitMsg')?.value || 'Update article';
        if (!content || !this.editingFile) return;

        try {
            UI.toast('Publishing to production...', 'warning');
            await API.github.commitFile(this.editingFile, btoa(unescape(encodeURIComponent(content))), msg);
            UI.toast('Published ✓ — deploying via GitHub Pages', 'success');

            // Auto-purge CF cache for this article
            try {
                const articleUrl = `${CONFIG.siteUrl}/${this.editingFile}`;
                await API.cloudflare.purgeCache([articleUrl]);
                UI.toast('Edge cache purged for updated article', 'success');
            } catch (cfErr) {
                // CF purge is optional
            }
        } catch (e) {
            UI.toast('Publish failed: ' + e.message, 'error');
        }
    },

    saveDraft() {
        const content = this._getCurrentContent();
        if (!content) return;
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
        this.editorMode = 'visual';
        this._quill = null;
        this._draw();
    },

    checkSeo(slug) {
        window.location.hash = `/seo?url=${CONFIG.siteUrl}/articles/${slug}.html`;
    },
};

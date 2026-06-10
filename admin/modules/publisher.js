/* ═══════════════════════════════════════════════════
   PUBLISHER — Content staging, HITL queue & scheduled posts
   v5 — Scheduled tab reads Viktor AI manifest
   ═══════════════════════════════════════════════════ */

const PublisherModule = {
    articles: [],
    scheduledData: null,
    activeTab: 'live',
    editingFile: null,
    editorMode: 'visual',   // 'visual' | 'code'
    _quill: null,
    _editorContent: '',

    async render() {
        const page = document.getElementById('pageContainer');
        page.innerHTML = UI.loading('Loading publisher...');

        try {
            [this.articles, this.scheduledData] = await Promise.all([
                API.github.listArticles().catch(() => []),
                API.scheduled.getManifest().catch(() => ({ scheduled: [], published: [] })),
            ]);
        } catch (e) {
            this.articles = [];
            this.scheduledData = { scheduled: [], published: [] };
            UI.toast('Could not load data from GitHub', 'error');
        }

        this._draw();
    },

    _draw() {
        const page = document.getElementById('pageContainer');
        const liveCount = this.articles.filter(a => a.name?.endsWith('.html')).length;
        const scheduledCount = (this.scheduledData?.scheduled || []).length;

        const badge = document.getElementById('draftCount');
        if (badge) badge.textContent = liveCount;

        page.innerHTML = `
            ${UI.sectionHeader('Publisher Engine', 'Review, edit, and publish content',
                `<button class="btn btn-primary" onclick="PublisherModule.showNewDraft()">+ New Draft</button>`
            )}

            ${UI.tabs([
                { id: 'live', label: 'Live Articles (' + liveCount + ')' },
                { id: 'scheduled', label: '📅 Scheduled (' + scheduledCount + ')' },
                { id: 'editor', label: 'Editor' },
            ], this.activeTab)}

            <div id="publisherContent">
                ${this.activeTab === 'live' ? this._renderLiveQueue()
                    : this.activeTab === 'scheduled' ? this._renderScheduledQueue()
                    : this._renderEditor()}
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

    /* ─── Scheduled Queue (Viktor AI manifest) ─── */
    _renderScheduledQueue() {
        const posts = this.scheduledData?.scheduled || [];
        const lastUpdated = this.scheduledData?.lastUpdated;
        const publishedPosts = this.scheduledData?.published || [];

        if (posts.length === 0 && publishedPosts.length === 0) {
            return UI.card('Scheduled Posts — Viktor AI',
                UI.empty('📅', 'No scheduled posts found',
                    'Viktor pushes scheduled.json to the repo whenever articles are queued. Check back after the next publish cycle.')
            );
        }

        const todayStr = new Date().toISOString().split('T')[0];

        // Group by week
        const thisWeek = posts.filter(p => {
            const d = new Date(p.date);
            const now = new Date();
            const diff = (d - now) / (1000 * 60 * 60 * 24);
            return diff < 7 && diff >= 0;
        });
        const later = posts.filter(p => {
            const d = new Date(p.date);
            const now = new Date();
            const diff = (d - now) / (1000 * 60 * 60 * 24);
            return diff >= 7;
        });
        const overdue = posts.filter(p => p.date < todayStr);

        let html = '';

        // Sync info bar
        html += `
            <div style="background:var(--bg-secondary);padding:12px 16px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;font-size:13px">
                <span>
                    <strong>Viktor AI Cron</strong> · Publishes daily at ${this.scheduledData?.publishTime || '07:00 BST'}
                    · <span style="color:var(--slate-500)">Last sync: ${lastUpdated ? new Date(lastUpdated).toLocaleString() : '—'}</span>
                </span>
                <span>${UI.badge(posts.length + ' queued', 'gold')}</span>
            </div>`;

        // Overdue (if any)
        if (overdue.length > 0) {
            html += this._scheduledSection('⚠️ Overdue', overdue, 'amber');
        }

        // This week
        if (thisWeek.length > 0) {
            html += this._scheduledSection('📅 This Week', thisWeek, 'gold');
        }

        // Later
        if (later.length > 0) {
            html += this._scheduledSection('🗓 Upcoming', later, 'slate');
        }

        // Recently published (from manifest)
        if (publishedPosts.length > 0) {
            const recentPub = [...publishedPosts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
            html += this._scheduledSection('✅ Recently Published', recentPub, 'green');
        }

        return UI.card('Scheduled Posts — Viktor AI Queue', html,
            `<div class="flex-between">
                <span style="font-size:12px;color:var(--slate-500)">Source: scheduled.json in ${CONFIG.github.owner}/${CONFIG.github.repo}</span>
                <button class="btn btn-ghost btn-sm" onclick="PublisherModule.render()">↻ Refresh</button>
            </div>`
        );
    },

    _scheduledSection(title, posts, badgeColor) {
        return `
            <div style="margin-bottom:20px">
                <div style="font-weight:600;font-size:14px;margin-bottom:8px;color:var(--text-primary)">${title}</div>
                ${posts.map(p => {
                    const isPublished = p.status === 'published';
                    const statusBadge = isPublished
                        ? UI.badge('Published', 'green')
                        : UI.badge(p.date, badgeColor);

                    return `
                        <div class="queue-item" style="${!isPublished ? 'border-left:3px solid var(--gold-500)' : ''}">
                            <div class="queue-item-content">
                                <div class="queue-item-title">${UI.esc(p.title)}</div>
                                <div class="queue-item-meta">
                                    <span style="text-transform:uppercase;font-size:11px;color:var(--gold-500)">${UI.esc(p.series)}</span>
                                    <span>${UI.esc(p.author)}</span>
                                    ${statusBadge}
                                </div>
                            </div>
                            <div class="queue-item-actions">
                                ${isPublished ? `
                                    <a href="${CONFIG.siteUrl}/articles/${p.slug}.html" target="_blank" class="btn btn-ghost btn-xs">View ↗</a>
                                ` : `
                                    <button class="btn btn-ghost btn-xs" onclick="PublisherModule.previewScheduled('${p.slug}')">Preview</button>
                                `}
                            </div>
                        </div>`;
                }).join('')}
            </div>`;
    },

    previewScheduled(slug) {
        // Open the article HTML file in the editor if it exists in the repo
        this.editArticle(`articles/${slug}.html`);
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
            const bodyContent = this._extractBody(this._editorContent);
            this._quill.root.innerHTML = bodyContent;
        }
    },

    _extractBody(html) {
        const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (match) return match[1].trim();
        return html;
    },

    _wrapBody(bodyHtml) {
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
        if (mode === this.editorMode) return;

        if (this.editorMode === 'visual' && this._quill) {
            const bodyHtml = this._quill.root.innerHTML;
            this._editorContent = this._wrapBody(bodyHtml);
        } else if (this.editorMode === 'code') {
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
        this.editorMode = 'visual';
        this._quill = null;
        this._draw();

        const edEl = document.getElementById('quillEditor') || document.getElementById('editorContent');
        if (edEl && edEl.tagName === 'TEXTAREA') edEl.value = 'Loading...';

        try {
            const file = await API.github.getFile(path);
            const content = file.content ? atob(file.content) : file.raw || '';
            this._editorContent = content;
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

            try {
                const articleUrl = `${CONFIG.siteUrl}/${this.editingFile}`;
                await API.cloudflare.purgeCache([articleUrl]);
                UI.toast('Edge cache purged for updated article', 'success');
            } catch (cfErr) { /* CF purge optional */ }
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

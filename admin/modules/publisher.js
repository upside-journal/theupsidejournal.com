/* ═══════════════════════════════════════════════════
   PUBLISHER — Content staging, HITL queue & scheduled posts
   v6 — Fixed visual editor (Quill 2.0), scheduled tab
   ═══════════════════════════════════════════════════ */

const PublisherModule = {
    articles: [],
    scheduledData: null,
    activeTab: 'live',
    editingFile: null,
    editorMode: 'visual',   // 'visual' | 'code'
    _quill: null,
    _editorContent: '',

    /* Pagination state */
    _page: { live: 1, scheduled: 1, drafts: 1 },
    _perPage: 10,

    /* Local drafts (localStorage) */
    _drafts: [],

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

        /* Load local drafts */
        this._loadDrafts();
        const draftCount = this._drafts.length;

        const badge = document.getElementById('draftCount');
        if (badge) badge.textContent = liveCount;

        page.innerHTML = `
            ${UI.sectionHeader('Publisher Engine', 'Review, edit, and publish content',
                `<button class="btn btn-primary" onclick="PublisherModule.showNewDraft()">+ New Draft</button>`
            )}

            ${UI.tabs([
                { id: 'live', label: 'Live Articles (' + liveCount + ')' },
                { id: 'scheduled', label: '📅 Scheduled (' + scheduledCount + ')' },
                { id: 'drafts', label: '📝 Drafts (' + draftCount + ')' },
                { id: 'editor', label: 'Editor' },
            ], this.activeTab)}

            <div id="publisherContent">
                ${this.activeTab === 'live' ? this._renderLiveQueue()
                    : this.activeTab === 'scheduled' ? this._renderScheduledQueue()
                    : this.activeTab === 'drafts' ? this._renderDraftsTab()
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

        /* Pagination for scheduled items */
        const allScheduledItems = [...overdue, ...thisWeek, ...later];
        const totalPages = Math.ceil(allScheduledItems.length / this._perPage) || 1;
        const page = Math.min(this._page.scheduled, totalPages) || 1;
        html += this._renderPagination('scheduled', page, totalPages, allScheduledItems.length + publishedPosts.length);

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

        /* Try to get publish dates from scheduled manifest for sorting */
        const publishedMap = {};
        (this.scheduledData?.published || []).forEach(p => {
            if (p.slug && p.date) publishedMap[p.slug] = p.date;
        });

        const sorted = [...this.articles]
            .filter(a => a.name?.endsWith('.html'))
            .sort((a, b) => {
                const slugA = a.name.replace('.html', '');
                const slugB = b.name.replace('.html', '');
                const dateA = publishedMap[slugA] || '';
                const dateB = publishedMap[slugB] || '';
                /* Most recently published first; fallback to name desc */
                if (dateA || dateB) return dateB.localeCompare(dateA);
                return (b.name || '').localeCompare(a.name || '');
            });

        /* Pagination */
        const totalPages = Math.ceil(sorted.length / this._perPage);
        const page = Math.min(this._page.live, totalPages) || 1;
        const start = (page - 1) * this._perPage;
        const pageItems = sorted.slice(start, start + this._perPage);

        const rows = pageItems.map(a => {
            const slug = a.name.replace('.html', '');
            const title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const sizeKB = a.size ? (a.size / 1024).toFixed(1) + ' KB' : '—';
            const pubDate = publishedMap[slug];
            const dateLabel = pubDate ? new Date(pubDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

            return `
                <div class="queue-item">
                    <div class="queue-item-content">
                        <div class="queue-item-title">${UI.esc(title)}</div>
                        <div class="queue-item-meta">
                            <span>articles/${a.name}</span>
                            <span>${sizeKB}</span>
                            ${dateLabel ? `<span style="color:var(--slate-400)">${dateLabel}</span>` : ''}
                            ${UI.badge('Live', 'green')}
                        </div>
                    </div>
                    <div class="queue-item-actions">
                        <button class="btn btn-secondary btn-xs" onclick="PublisherModule.editArticle('articles/${a.name}')">Edit</button>
                        <button class="btn btn-ghost btn-xs" onclick="PublisherModule.generateSocialForSlug('${slug}')">📡 Social</button>
                        <button class="btn btn-ghost btn-xs" onclick="PublisherModule.checkSeo('${slug}')">SEO Check</button>
                        <a href="${CONFIG.siteUrl}/articles/${a.name}" target="_blank" class="btn btn-ghost btn-xs">View ↗</a>
                    </div>
                </div>`;
        }).join('');

        return UI.card(`HITL Staging Queue — ${sorted.length} articles`, rows +
            this._renderPagination('live', page, totalPages, sorted.length),
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
                            <button class="btn btn-ghost btn-sm" onclick="PublisherModule.generateSocialCopies()" title="Generate social media copies for this article">📡 Social</button>
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

        // Load content into Quill (Quill 2.0 requires clipboard API, not innerHTML)
        if (this._editorContent) {
            const bodyContent = this._extractBody(this._editorContent);
            this._quill.clipboard.dangerouslyPasteHTML(bodyContent);
        }
    },

    _extractBody(html) {
        // Prefer <article> content for cleaner editing (skip nav/header/footer)
        const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
        if (articleMatch) return articleMatch[1].trim();
        // Fallback to full body
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) return bodyMatch[1].trim();
        return html;
    },

    _wrapBody(bodyHtml) {
        if (!this._editorContent) return bodyHtml;
        // If original had <article>, splice edited content back into it
        if (this._editorContent.match(/<article[^>]*>/i)) {
            return this._editorContent.replace(
                /(<article[^>]*>)([\s\S]*?)(<\/article>)/i,
                `$1\n${bodyHtml}\n$3`
            );
        }
        // Fallback to body replacement
        if (this._editorContent.includes('<body')) {
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

        /* Extract title from HTML */
        const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        let title = titleMatch ? titleMatch[1].replace(/\s*[—|]\s*Upside Journal/i, '').trim() : '';
        if (!title) {
            const h1Match = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
            title = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '';
        }

        const filename = this.editingFile || 'new-article.html';
        this._saveDraftToStorage(filename, title, content);
        UI.toast('Draft saved ✓', 'success');
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

    /* ─── Generate Social Media Copies ─── */
    async generateSocialForSlug(slug) {
        const title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const url = `${CONFIG.siteUrl}/articles/${slug}.html`;
        this._showSocialGenerator(title, url, slug);
    },

    async generateSocialCopies() {
        if (!this.editingFile) { UI.toast('No article open', 'error'); return; }
        const slug = this.editingFile.replace('articles/', '').replace('.html', '');
        const title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const url = `${CONFIG.siteUrl}/articles/${slug}.html`;
        this._showSocialGenerator(title, url, slug);
    },

    /* ─── Shared Pagination Helper ─── */
    _renderPagination(tabKey, currentPage, totalPages, totalItems) {
        if (totalPages <= 1) return '';
        const start = (currentPage - 1) * this._perPage + 1;
        const end = Math.min(currentPage * this._perPage, totalItems);
        return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid var(--slate-200);margin-top:8px">
                <span style="font-size:12px;color:var(--slate-500)">
                    Showing ${start}–${end} of ${totalItems}
                </span>
                <div style="display:flex;gap:6px;align-items:center">
                    <button class="btn btn-ghost btn-xs" ${currentPage <= 1 ? 'disabled' : ''}
                        onclick="PublisherModule._goToPage('${tabKey}', ${currentPage - 1})">← Prev</button>
                    <span style="font-size:12px;font-weight:500;color:var(--text-primary);min-width:60px;text-align:center">
                        Page ${currentPage} of ${totalPages}
                    </span>
                    <button class="btn btn-ghost btn-xs" ${currentPage >= totalPages ? 'disabled' : ''}
                        onclick="PublisherModule._goToPage('${tabKey}', ${currentPage + 1})">Next →</button>
                </div>
            </div>`;
    },

    _goToPage(tabKey, page) {
        this._page[tabKey] = page;
        this._draw();
    },

    /* ─── Drafts Tab ─── */
    _loadDrafts() {
        const drafts = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key.startsWith('uj_draft_')) continue;
            try {
                const draft = JSON.parse(localStorage.getItem(key));
                drafts.push({ ...draft, _key: key });
            } catch (e) { /* skip invalid */ }
        }
        this._drafts = drafts.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    },

    _renderDraftsTab() {
        this._loadDrafts();
        const drafts = this._drafts;

        if (drafts.length === 0) {
            return UI.card('Drafts',
                UI.empty('📝', 'No drafts yet', 'Create a new draft from the Editor tab, or click "+ New Draft" above'),
                `<div style="font-size:12px;color:var(--slate-500)">Drafts are saved to your browser\'s local storage</div>`
            );
        }

        /* Pagination */
        const totalPages = Math.ceil(drafts.length / this._perPage);
        const page = Math.min(this._page.drafts, totalPages) || 1;
        const start = (page - 1) * this._perPage;
        const pageItems = drafts.slice(start, start + this._perPage);

        const rows = pageItems.map(d => {
            const wordCount = d.content ? d.content.split(/\s+/).length : 0;
            const updated = d.updatedAt ? new Date(d.updatedAt).toLocaleString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '—';
            const slug = (d.filename || 'untitled').replace('.html', '');

            return `
                <div class="queue-item">
                    <div class="queue-item-content">
                        <div class="queue-item-title">${UI.esc(d.title || slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))}</div>
                        <div class="queue-item-meta">
                            <span>${UI.esc(d.filename || 'untitled.html')}</span>
                            <span>${wordCount.toLocaleString()} words</span>
                            <span style="color:var(--slate-400)">${updated}</span>
                            ${UI.badge('Draft', 'amber')}
                        </div>
                    </div>
                    <div class="queue-item-actions">
                        <button class="btn btn-secondary btn-xs" onclick="PublisherModule._openDraft('${d._key}')">Edit</button>
                        <button class="btn btn-primary btn-xs" onclick="PublisherModule._publishDraft('${d._key}')">⬆ Publish</button>
                        <button class="btn btn-ghost btn-xs" onclick="PublisherModule._deleteDraft('${d._key}')" title="Delete draft">🗑</button>
                    </div>
                </div>`;
        }).join('');

        return UI.card(`Drafts — ${drafts.length} saved`, rows +
            this._renderPagination('drafts', page, totalPages, drafts.length),
            `<div class="flex-between">
                <span style="font-size:12px;color:var(--slate-500)">Stored in browser localStorage</span>
                <button class="btn btn-ghost btn-sm" onclick="PublisherModule._draw()">↻ Refresh</button>
            </div>`
        );
    },

    _saveDraftToStorage(filename, title, content) {
        const key = 'uj_draft_' + (filename || 'untitled-' + Date.now()).replace(/[^a-z0-9\-_.]/gi, '_');
        const draft = {
            filename: filename || 'new-article.html',
            title: title || '',
            content,
            updatedAt: new Date().toISOString(),
            createdAt: localStorage.getItem(key)
                ? JSON.parse(localStorage.getItem(key)).createdAt
                : new Date().toISOString(),
        };
        localStorage.setItem(key, JSON.stringify(draft));
        return key;
    },

    _openDraft(key) {
        try {
            const draft = JSON.parse(localStorage.getItem(key));
            if (!draft?.content) { UI.toast('Draft is empty', 'error'); return; }
            this.editingFile = draft.filename || 'articles/draft.html';
            this._editorContent = draft.content;
            this.activeTab = 'editor';
            this.editorMode = 'visual';
            this._quill = null;
            this._draw();
        } catch (e) {
            UI.toast('Could not open draft', 'error');
        }
    },

    async _publishDraft(key) {
        try {
            const draft = JSON.parse(localStorage.getItem(key));
            if (!draft?.content) { UI.toast('Draft is empty', 'error'); return; }

            const filename = draft.filename || 'new-article.html';
            const path = filename.startsWith('articles/') ? filename : `articles/${filename}`;

            if (!confirm(`Publish "${draft.title || filename}" to ${path}?`)) return;

            UI.toast('Publishing draft to production...', 'warning');
            await API.github.commitFile(path, btoa(unescape(encodeURIComponent(draft.content))),
                `Publish draft: ${draft.title || filename}`);
            UI.toast('Draft published ✓', 'success');

            /* Remove from localStorage after successful publish */
            localStorage.removeItem(key);
            this.activeTab = 'live';
            await this.render();
        } catch (e) {
            UI.toast('Publish failed: ' + e.message, 'error');
        }
    },

    _deleteDraft(key) {
        if (!confirm('Delete this draft? This cannot be undone.')) return;
        localStorage.removeItem(key);
        this._draw();
        UI.toast('Draft deleted', 'success');
    },

    /* ─── Article Hook Extraction (for social copies) ─── */
    async _extractArticleHook(slug) {
        try {
            const ghToken = API._getToken('github');
            const { owner, repo, branch } = CONFIG.github;
            const path = `articles/${slug}.html`;

            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
                headers: ghToken ? { Authorization: `token ${ghToken}` } : {},
            });
            if (!res.ok) return null;
            const data = await res.json();
            const html = atob(data.content);

            /* Extract article-lede paragraph */
            const ledeMatch = html.match(/<p\s+class="article-lede"[^>]*>([\s\S]*?)<\/p>/i);
            const lede = ledeMatch ? ledeMatch[1].replace(/<[^>]+>/g, '').trim() : '';

            /* Extract first 2 body paragraphs after lede */
            const bodyMatch = html.match(/<div\s+class="article-body"[^>]*>([\s\S]*?)<\/div>/i);
            let firstParas = '';
            if (bodyMatch) {
                const paras = bodyMatch[1].match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
                const cleanParas = paras
                    .map(p => p.replace(/<[^>]+>/g, '').trim())
                    .filter(p => p.length > 20 && !p.includes('article-lede'));
                /* Skip the lede (first para), take next 1-2 */
                firstParas = cleanParas.slice(1, 3).join(' ');
            }

            /* Extract subtitle */
            const subtitleMatch = html.match(/<p\s+class="article-subtitle"[^>]*>([\s\S]*?)<\/p>/i);
            const subtitle = subtitleMatch ? subtitleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

            return { lede, firstParas, subtitle };
        } catch (e) {
            console.warn('Hook extraction failed:', e);
            return null;
        }
    },

    _selectedVideoUrl: null,
    _selectedImageUrl: null,

    async _showSocialGenerator(title, url, slug) {
        const PROXY = 'https://uj-social-proxy.pages.dev/api/buffer/graphql';
        const tokenA = API._getToken('buffer_a');
        const tokenB = API._getToken('buffer_b');

        if (!tokenA && !tokenB) {
            UI.toast('Set Buffer tokens in Ops Center → API Vault first', 'error');
            return;
        }

        this._selectedVideoUrl = null;
        this._selectedImageUrl = null;

        /* Try to auto-match from manifest */
        let manifestMatch = null;
        try { manifestMatch = await ManifestModule.getArticleMedia(slug); } catch (e) { /* ignore */ }

        /* Extract article hook for richer social copies */
        let hook = null;
        try { hook = await this._extractArticleHook(slug); } catch (e) { /* fallback to basic templates */ }

        const lede = hook?.lede || '';
        const hookShort = lede.length > 200 ? lede.slice(0, 197) + '…' : lede;
        const hookTweet = lede.length > 180
            ? lede.split(/[.!?]\s+/).slice(0, 1).join('. ').slice(0, 180).trim() + '.'
            : lede;

        /* Platform copy templates (with article hooks) */
        const copies = {
            linkedin: {
                icon: '💼', label: 'LinkedIn', charLimit: 3000, type: 'text',
                text: lede
                    ? `🪝 ${hookShort}\n\n📰 ${title}\n\nRead the full article: ${url}\n\n#TheUpsideJournal #MediaBusiness #Entertainment`
                    : `📰 New from The Upside Journal\n\n${title}\n\nRead the full article: ${url}\n\n#TheUpsideJournal #MediaBusiness #Entertainment`,
            },
            twitter: {
                icon: '𝕏', label: 'X / Twitter', charLimit: 280, type: 'text',
                text: (() => {
                    /* Twitter: short hook + link, stay under 280 */
                    const tags = '#TheUpsideJournal';
                    if (hookTweet) {
                        const draft = `${hookTweet}\n\n${url}\n\n${tags}`;
                        if (draft.length <= 280) return draft;
                        /* Fallback: just hook + link */
                        const shorter = `${hookTweet}\n\n${url}`;
                        if (shorter.length <= 280) return shorter;
                    }
                    return `${title}\n\n${url}\n\n${tags}`;
                })(),
            },
            facebook: {
                icon: '📘', label: 'Facebook', charLimit: 2000, type: 'text',
                text: lede
                    ? `${hookShort}\n\n${title}\n\nRead more on The Upside Journal 👇\n${url}`
                    : `${title}\n\nRead more on The Upside Journal 👇\n${url}`,
            },
            tiktok: {
                icon: '🎵', label: 'TikTok', charLimit: 2200, type: 'video',
                text: lede
                    ? `${hookShort}\n\nFull story: ${title} — theupsidejournal.com\n\n#TheUpsideJournal #MediaNews #Entertainment`
                    : `${title} — full story on theupsidejournal.com\n\n#TheUpsideJournal #MediaNews #Entertainment`,
            },
            instagram: {
                icon: '📸', label: 'Instagram Reel', charLimit: 2200, type: 'video',
                text: lede
                    ? `${hookShort}\n\n${title}\n\nRead the full story — link in bio\n\n#TheUpsideJournal #MediaBusiness #Entertainment`
                    : `${title}\n\nRead the full story — link in bio\n\n#TheUpsideJournal #MediaBusiness #Entertainment`,
            },
            youtube: {
                icon: '📺', label: 'YouTube Short', charLimit: 5000, type: 'video',
                text: lede
                    ? `${hookShort}\n\n${title}\n\nRead the full article at ${url}\n\n#TheUpsideJournal #Entertainment`
                    : `${title}\n\nRead the full article at ${url}\n\n#TheUpsideJournal #Entertainment`,
            },
        };

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px';
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        const textCards = Object.entries(copies).filter(([,p]) => p.type === 'text').map(([key, p]) => `
            <div class="social-preview-card" style="border-left:3px solid var(--gold)">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <strong>${p.icon} ${p.label}</strong>
                    <span class="social-char-count" id="charCount_${key}">${p.text.length}/${p.charLimit}</span>
                </div>
                <textarea id="socialCopy_${key}" rows="4" class="form-input social-compose-text" 
                    style="min-height:80px;font-size:13px"
                    oninput="document.getElementById('charCount_${key}').textContent = this.value.length + '/${p.charLimit}'"
                >${p.text}</textarea>
            </div>
        `).join('');

        const videoCards = Object.entries(copies).filter(([,p]) => p.type === 'video').map(([key, p]) => `
            <div class="social-preview-card" style="border-left:3px solid #E1306C">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <strong>${p.icon} ${p.label}</strong>
                    <span class="social-char-count" id="charCount_${key}">${p.text.length}/${p.charLimit}</span>
                </div>
                <textarea id="socialCopy_${key}" rows="3" class="form-input social-compose-text" 
                    style="min-height:60px;font-size:13px"
                    oninput="document.getElementById('charCount_${key}').textContent = this.value.length + '/${p.charLimit}'"
                >${p.text}</textarea>
            </div>
        `).join('');

        /* Manifest status pill */
        const manifestPill = manifestMatch
            ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:var(--emerald-50);color:var(--emerald-700);border:1px solid var(--emerald-200)">
                📋 Manifest: ${manifestMatch.videoStatus || 'No video'} ${manifestMatch.imageFilename ? '• 🖼 Image ready' : ''}
               </span>`
            : `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:var(--amber-50);color:var(--amber-700);border:1px solid var(--amber-200)">
                📋 Not in manifest
               </span>`;

        modal.innerHTML = `
            <div style="background:var(--white);border-radius:var(--radius);max-width:700px;width:100%;max-height:90vh;overflow-y:auto;padding:24px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                    <div>
                        <h3 style="margin:0 0 4px 0">📡 Social Copies — ${UI.esc(title)}</h3>
                        ${manifestPill}
                    </div>
                    <button class="btn btn-ghost btn-sm" onclick="this.closest('.modal-overlay').remove()">✕</button>
                </div>

                <!-- Image selector for text channels -->
                <div style="margin-bottom:16px;padding:12px;background:var(--bg-secondary);border-radius:var(--radius)">
                    <p style="font-size:13px;color:var(--slate-500);margin:0 0 8px 0">
                        <strong>🖼 Image attachment</strong> — for LinkedIn, X & Facebook posts
                    </p>
                    <div style="display:flex;gap:8px;align-items:center">
                        <select id="imageSelector" class="form-input" style="flex:1" onchange="PublisherModule._onImageSelect()">
                            <option value="">⏳ Loading images...</option>
                        </select>
                        <button class="btn btn-ghost btn-xs" onclick="PublisherModule._loadImageList('${slug}')" title="Refresh">↻</button>
                    </div>
                    <div id="imagePreviewArea" style="margin-top:8px"></div>
                </div>

                <!-- Text channels section -->
                <p style="font-size:13px;color:var(--slate-500);margin-bottom:12px">
                    <strong>Text channels</strong> — queued directly to Buffer
                </p>
                ${textCards}

                <!-- Video channels section -->
                <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--slate-200)">
                    <p style="font-size:13px;color:var(--slate-500);margin-bottom:12px">
                        <strong>🎬 Video channels</strong> — attach a video to post as Reel/Short
                    </p>
                    <div style="margin-bottom:12px">
                        <label class="form-label">Select Video</label>
                        <div style="display:flex;gap:8px;align-items:center">
                            <select id="videoSelector" class="form-input" style="flex:1" onchange="PublisherModule._onVideoSelect()">
                                <option value="">⏳ Loading videos...</option>
                            </select>
                            <button class="btn btn-ghost btn-xs" onclick="PublisherModule._loadVideoList('${slug}')" title="Refresh">↻</button>
                        </div>
                        <div id="videoPreviewArea" style="margin-top:8px"></div>
                    </div>
                    ${videoCards}
                </div>

                <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
                    <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="btn btn-primary" id="queueSocialBtn" onclick="PublisherModule._queueSocialCopies('${slug}')">
                        📡 Queue to Buffer
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Load video + image lists (manifest-aware)
        this._loadVideoList(slug);
        this._loadImageList(slug);
    },

    /* ─── Smart Video Picker (manifest + GitHub fallback) ─── */
    async _loadVideoList(slug) {
        const select = document.getElementById('videoSelector');
        if (!select) return;

        select.innerHTML = '<option value="">⏳ Loading...</option>';

        try {
            /* 1. Load manifest for auto-match */
            let manifestVideo = null;
            try {
                const media = await ManifestModule.getArticleMedia(slug);
                if (media?.videoFilename) manifestVideo = media.videoFilename;
            } catch (e) { /* continue without manifest */ }

            /* 2. Load actual videos from GitHub repo */
            const ghToken = API._getToken('github');
            const { owner, repo, branch } = CONFIG.github;
            const dir = CONFIG.video?.repoDir || 'videos';

            const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${dir}?ref=${branch}`, {
                headers: ghToken ? { Authorization: `token ${ghToken}` } : {},
            });

            if (!res.ok) throw new Error(`GitHub API ${res.status}`);
            const files = await res.json();

            const videos = files
                .filter(f => /\.(mp4|mov|webm)$/i.test(f.name))
                .sort((a, b) => a.name.localeCompare(b.name));

            /* 3. Group by manifest weeks if available */
            let weeklyGroups = null;
            try {
                const weeks = await ManifestModule.getByWeek();
                if (weeks.length > 0) weeklyGroups = weeks;
            } catch (e) { /* flat list fallback */ }

            select.innerHTML = `<option value="">— No video (save as Ideas) —</option>`;

            /* Auto-match suggestion first */
            if (manifestVideo) {
                const matchedFile = videos.find(v => v.name === manifestVideo);
                if (matchedFile) {
                    const videoUrl = `${CONFIG.video?.baseUrl || CONFIG.siteUrl + '/videos'}/${matchedFile.name}`;
                    const sizeStr = matchedFile.size ? ` (${(matchedFile.size / 1024 / 1024).toFixed(1)}MB)` : '';
                    const opt = document.createElement('option');
                    opt.value = videoUrl;
                    opt.textContent = `⭐ ${matchedFile.name}${sizeStr} — manifest match`;
                    opt.style.fontWeight = '600';
                    select.appendChild(opt);

                    // Auto-select it
                    select.value = videoUrl;
                    this._selectedVideoUrl = videoUrl;
                    this._onVideoSelect();
                }
            }

            /* All videos */
            if (videos.length > 0) {
                const group = document.createElement('optgroup');
                group.label = `📁 All videos (${videos.length})`;
                videos.forEach(v => {
                    const videoUrl = `${CONFIG.video?.baseUrl || CONFIG.siteUrl + '/videos'}/${v.name}`;
                    if (manifestVideo && v.name === manifestVideo) return; // skip duplicate
                    const sizeStr = v.size ? ` (${(v.size / 1024 / 1024).toFixed(1)}MB)` : '';
                    const opt = document.createElement('option');
                    opt.value = videoUrl;
                    opt.textContent = `🎬 ${v.name}${sizeStr}`;
                    group.appendChild(opt);
                });
                select.appendChild(group);
            }

            if (videos.length === 0 && !manifestVideo) {
                select.innerHTML = '<option value="">No videos in /videos/ folder</option>';
            }
        } catch (e) {
            console.error('Video list error:', e);
            select.innerHTML = '<option value="">Error loading videos</option>';
        }
    },

    _onVideoSelect() {
        const select = document.getElementById('videoSelector');
        const preview = document.getElementById('videoPreviewArea');
        const url = select?.value;
        this._selectedVideoUrl = url || null;

        if (preview) {
            if (url) {
                const name = url.split('/').pop();
                preview.innerHTML = `
                    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--emerald-50);border-radius:var(--radius);border:1px solid var(--emerald-200)">
                        <span style="font-size:18px">✅</span>
                        <div>
                            <div style="font-size:12px;font-weight:600;color:var(--emerald-700)">Video attached</div>
                            <div style="font-size:11px;color:var(--emerald-600)">${UI.esc(name)} — will post as Reel/Short on TikTok, Instagram & YouTube</div>
                        </div>
                    </div>`;
            } else {
                preview.innerHTML = `
                    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--amber-50);border-radius:var(--radius);border:1px solid var(--amber-200)">
                        <span style="font-size:18px">💡</span>
                        <div style="font-size:11px;color:var(--amber-700)">No video selected — video channels will be saved as Ideas instead of posts</div>
                    </div>`;
            }
        }
    },

    /* ─── Smart Image Picker (article assets + manifest) ─── */
    async _loadImageList(slug) {
        const select = document.getElementById('imageSelector');
        if (!select) return;

        select.innerHTML = '<option value="">⏳ Loading...</option>';

        try {
            const ghToken = API._getToken('github');
            const { owner, repo, branch } = CONFIG.github;

            /* Load images from /images/ (article covers + incontent assets) */
            let images = [];
            try {
                const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/images?ref=${branch}`, {
                    headers: ghToken ? { Authorization: `token ${ghToken}` } : {},
                });
                if (res.ok) {
                    const files = await res.json();
                    images = files.filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name))
                        .sort((a, b) => a.name.localeCompare(b.name));
                }
            } catch (e) { /* folder may not exist */ }

            select.innerHTML = `<option value="">— No image (text-only post) —</option>`;

            /* Auto-match by article slug: {slug}-cover.* and {slug}-incontent.* */
            const coverImg = images.find(i => i.name.match(new RegExp(`^${slug}-cover\\.`, 'i')));
            const incontentImg = images.find(i => i.name.match(new RegExp(`^${slug}-incontent\\.`, 'i')));

            const baseUrl = CONFIG.siteUrl + '/images';

            if (coverImg || incontentImg) {
                const autoGroup = document.createElement('optgroup');
                autoGroup.label = `⭐ Article images (auto-matched)`;

                if (coverImg) {
                    const opt = document.createElement('option');
                    opt.value = `${baseUrl}/${coverImg.name}`;
                    opt.textContent = `⭐ ${coverImg.name} — cover image`;
                    opt.style.fontWeight = '600';
                    autoGroup.appendChild(opt);
                }
                if (incontentImg) {
                    const opt = document.createElement('option');
                    opt.value = `${baseUrl}/${incontentImg.name}`;
                    opt.textContent = `⭐ ${incontentImg.name} — in-content image`;
                    opt.style.fontWeight = '600';
                    autoGroup.appendChild(opt);
                }
                select.appendChild(autoGroup);

                /* Auto-select cover image */
                if (coverImg) {
                    select.value = `${baseUrl}/${coverImg.name}`;
                    this._selectedImageUrl = `${baseUrl}/${coverImg.name}`;
                    this._onImageSelect();
                }
            }

            /* All other images */
            const matchedNames = new Set([coverImg?.name, incontentImg?.name].filter(Boolean));
            const otherImages = images.filter(i => !matchedNames.has(i.name));
            if (otherImages.length > 0) {
                const group = document.createElement('optgroup');
                group.label = `📁 All images (${images.length})`;
                otherImages.forEach(img => {
                    const sizeStr = img.size ? ` (${(img.size / 1024).toFixed(0)}KB)` : '';
                    const opt = document.createElement('option');
                    opt.value = `${baseUrl}/${img.name}`;
                    opt.textContent = `🖼 ${img.name}${sizeStr}`;
                    group.appendChild(opt);
                });
                select.appendChild(group);
            }

            if (images.length === 0) {
                select.innerHTML = `<option value="">No images found in /images/</option>`;
            }
        } catch (e) {
            console.error('Image list error:', e);
            select.innerHTML = '<option value="">Error loading images</option>';
        }
    },

    _onImageSelect() {
        const select = document.getElementById('imageSelector');
        const preview = document.getElementById('imagePreviewArea');
        const url = select?.value;
        this._selectedImageUrl = url || null;

        if (preview) {
            if (url) {
                const name = url.split('/').pop();
                preview.innerHTML = `
                    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--blue-50,#eff6ff);border-radius:var(--radius);border:1px solid var(--blue-200,#bfdbfe)">
                        <img src="${url}" style="width:48px;height:48px;object-fit:cover;border-radius:4px" onerror="this.style.display='none'">
                        <div>
                            <div style="font-size:12px;font-weight:600;color:var(--blue-700,#1d4ed8)">Image attached</div>
                            <div style="font-size:11px;color:var(--blue-600,#2563eb)">${UI.esc(name)} — will attach to LinkedIn, X & Facebook posts</div>
                        </div>
                    </div>`;
            } else {
                preview.innerHTML = '';
            }
        }
    },

    async _queueSocialCopies(slug) {
        const PROXY = 'https://uj-social-proxy.pages.dev/api/buffer/graphql';
        const tokenA = API._getToken('buffer_a');
        const tokenB = API._getToken('buffer_b');
        const btn = document.getElementById('queueSocialBtn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Queuing...'; }

        const videoUrl = this._selectedVideoUrl;
        const imageUrl = this._selectedImageUrl;
        const articleTitle = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        /* Channel config from CONFIG */
        const chCfg = CONFIG.buffer.channels;
        const getToken = (org) => org === 'A' ? tokenA : tokenB;

        /* Text channels — always queue as posts */
        const textChannels = {
            linkedin:  { ...chCfg.linkedin,  token: getToken(chCfg.linkedin.org) },
            twitter:   { ...chCfg.twitter,   token: getToken(chCfg.twitter.org) },
            facebook:  { ...chCfg.facebook,  token: getToken(chCfg.facebook.org) },
        };

        /* Video channels — queue as posts (with video) OR save as ideas (without video) */
        const videoChannels = {
            tiktok:    { ...chCfg.tiktok,    token: getToken(chCfg.tiktok.org),    orgId: CONFIG.buffer.orgs.socialB },
            instagram: { ...chCfg.instagram, token: getToken(chCfg.instagram.org), orgId: CONFIG.buffer.orgs.socialA },
            youtube:   { ...chCfg.youtube,   token: getToken(chCfg.youtube.org),   orgId: CONFIG.buffer.orgs.socialB },
        };

        const createPost = `mutation($input: CreatePostInput!) {
            createPost(input: $input) {
                __typename
                ... on PostActionSuccess { post { id status } }
                ... on InvalidInputError { message }
                ... on UnexpectedError { message }
                ... on LimitReachedError { message }
                ... on RestProxyError { message }
                ... on NotFoundError { message }
            }
        }`;
        const createIdea = `mutation($input: CreateIdeaInput!) {
            createIdea(input: $input) {
                __typename
                ... on Idea { id content { title } }
            }
        }`;

        let queued = 0, videos = 0, ideas = 0, errors = 0;
        const errorDetails = [];

        /* ─── Queue text channels (with optional image) ─── */
        for (const [key, ch] of Object.entries(textChannels)) {
            const text = document.getElementById(`socialCopy_${key}`)?.value?.trim();
            if (!text || !ch.token) continue;
            try {
                const metadata = {};
                if (key === 'facebook') metadata.facebook = { type: 'post' };

                const input = {
                    channelId: ch.id,
                    text,
                    mode: 'addToQueue',
                    schedulingType: 'automatic',
                    ...(Object.keys(metadata).length ? { metadata } : {}),
                };

                /* Attach image if selected (LinkedIn, X, Facebook) */
                if (imageUrl) {
                    input.assets = [{ image: { url: imageUrl } }];
                }

                const res = await fetch(PROXY, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: ch.token,
                        query: createPost,
                        variables: { input },
                    }),
                });
                const data = await res.json();
                if (data.data?.createPost?.post) {
                    queued++;
                } else {
                    const errMsg = data.data?.createPost?.message || data.errors?.[0]?.message || 'Unknown error';
                    errorDetails.push(`${key}: ${errMsg}`);
                    errors++;
                    console.warn(`Buffer ${key} error:`, data);
                }
            } catch (e) {
                errorDetails.push(`${key}: ${e.message}`);
                errors++;
                console.error(key, e);
            }
        }

        /* ─── Video channels: post with video OR save as idea ─── */
        for (const [key, ch] of Object.entries(videoChannels)) {
            const text = document.getElementById(`socialCopy_${key}`)?.value?.trim();
            if (!text || !ch.token) continue;

            if (videoUrl) {
                /* Video attached → create real post with video asset */
                try {
                    const input = {
                        channelId: ch.id,
                        text,
                        mode: 'addToQueue',
                        schedulingType: 'automatic',
                        assets: [{ video: { url: videoUrl, metadata: { title: articleTitle } } }],
                        metadata: {},
                    };

                    /* Platform-specific metadata */
                    if (key === 'tiktok') {
                        input.metadata.tiktok = { title: articleTitle };
                    } else if (key === 'instagram') {
                        input.metadata.instagram = { type: 'reel', shouldShareToFeed: true };
                    } else if (key === 'youtube') {
                        input.metadata.youtube = {
                            title: `${articleTitle} | The Upside Journal`,
                            categoryId: '24',
                            madeForKids: false,
                        };
                    }

                    const res = await fetch(PROXY, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: ch.token, query: createPost, variables: { input } }),
                    });
                    const data = await res.json();
                    if (data.data?.createPost?.post) {
                        videos++;
                    } else {
                        const errMsg = data.data?.createPost?.message || data.errors?.[0]?.message || 'Unknown error';
                        errorDetails.push(`${key}: ${errMsg}`);
                        errors++;
                        console.warn(`Buffer ${key} video error:`, data);
                    }
                } catch (e) {
                    errorDetails.push(`${key}: ${e.message}`);
                    errors++;
                    console.error(key, e);
                }
            } else {
                /* No video → save as Idea (fallback) */
                try {
                    const res = await fetch(PROXY, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            token: ch.token,
                            query: createIdea,
                            variables: { input: {
                                organizationId: ch.orgId,
                                content: { title: `[VIDEO] ${articleTitle}`, text },
                            }},
                        }),
                    });
                    const data = await res.json();
                    if (data.data?.createIdea?.id) ideas++;
                    else {
                        const errMsg = data.errors?.[0]?.message || 'Unknown error';
                        errorDetails.push(`${key} (idea): ${errMsg}`);
                        errors++;
                        console.warn(`Buffer ${key} idea error:`, data);
                    }
                } catch (e) {
                    errorDetails.push(`${key} (idea): ${e.message}`);
                    errors++;
                    console.error(key, e);
                }
            }
        }

        if (btn) { btn.disabled = false; btn.textContent = '📡 Queue to Buffer'; }

        const summary = [];
        if (queued) summary.push(`${queued} text posts queued`);
        if (videos) summary.push(`${videos} video posts queued`);
        if (ideas) summary.push(`${ideas} ideas saved`);
        if (errors) {
            summary.push(`${errors} errors`);
            /* Show first error detail in toast for debugging */
            if (errorDetails.length > 0) {
                const detail = errorDetails.slice(0, 2).join(' | ');
                summary.push(`→ ${detail}`);
            }
        }

        UI.toast(summary.join(', ') || 'Nothing to queue', errors ? 'error' : 'success', errors ? 8000 : 3000);

        if (!errors) {
            const modal = document.querySelector('.modal-overlay');
            if (modal) setTimeout(() => modal.remove(), 1500);
        }
    },
};

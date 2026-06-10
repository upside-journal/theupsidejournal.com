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
                        <button class="btn btn-ghost btn-xs" onclick="PublisherModule.generateSocialForSlug('${slug}')">📡 Social</button>
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

    _showSocialGenerator(title, url, slug) {
        const PROXY = 'https://uj-social-proxy.pages.dev/api/buffer/graphql';
        const tokenA = API._getToken('buffer_a');
        const tokenB = API._getToken('buffer_b');

        if (!tokenA && !tokenB) {
            UI.toast('Set Buffer tokens in Ops Center → API Vault first', 'error');
            return;
        }

        /* Platform copy templates */
        const copies = {
            linkedin: {
                icon: '💼', label: 'LinkedIn', charLimit: 3000,
                text: `📰 New from The Upside Journal\n\n${title}\n\nRead the full article: ${url}\n\n#TheUpsideJournal #MediaBusiness #Entertainment`,
            },
            twitter: {
                icon: '𝕏', label: 'X / Twitter', charLimit: 280,
                text: `${title}\n\n${url}\n\n#TheUpsideJournal`,
            },
            facebook: {
                icon: '📘', label: 'Facebook', charLimit: 2000,
                text: `${title}\n\nRead more on The Upside Journal 👇\n${url}`,
            },
            tiktok: {
                icon: '🎵', label: 'TikTok (idea)', charLimit: 2200,
                text: `[VIDEO NEEDED] ${title}\n\nCaption: ${title} — full story on theupsidejournal.com\n\n#TheUpsideJournal #MediaNews`,
            },
            instagram: {
                icon: '📸', label: 'Instagram (idea)', charLimit: 2200,
                text: `[VIDEO/IMAGE NEEDED] ${title}\n\nCaption: ${title}\n\nRead the full story — link in bio\n\n#TheUpsideJournal #MediaBusiness`,
            },
            youtube: {
                icon: '📺', label: 'YouTube (idea)', charLimit: 5000,
                text: `[VIDEO NEEDED] ${title}\n\nDescription: Read the full article at ${url}\n\n#TheUpsideJournal`,
            },
        };

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px';
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        const cards = Object.entries(copies).map(([key, p]) => `
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

        modal.innerHTML = `
            <div style="background:var(--white);border-radius:var(--radius);max-width:700px;width:100%;max-height:90vh;overflow-y:auto;padding:24px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                    <h3 style="margin:0">📡 Generate Social Copies — ${UI.esc(title)}</h3>
                    <button class="btn btn-ghost btn-sm" onclick="this.closest('.modal-overlay').remove()">✕</button>
                </div>
                <p style="font-size:13px;color:var(--slate-500);margin-bottom:16px">
                    Edit the copies below, then click "Queue to Buffer" to schedule them. 
                    Text channels (LinkedIn, X, Facebook) will be queued directly. 
                    Video channels (TikTok, Instagram, YouTube) will be saved as Ideas.
                </p>
                ${cards}
                <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
                    <button class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="btn btn-primary" id="queueSocialBtn" onclick="PublisherModule._queueSocialCopies('${slug}')">
                        📡 Queue to Buffer
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    async _queueSocialCopies(slug) {
        const PROXY = 'https://uj-social-proxy.pages.dev/api/buffer/graphql';
        const tokenA = API._getToken('buffer_a');
        const tokenB = API._getToken('buffer_b');
        const btn = document.getElementById('queueSocialBtn');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Queuing...'; }

        const textChannels = {
            linkedin:  { id: '6a20500bc687a22dd4580b6a', token: tokenA },
            twitter:   { id: '6a23299bc687a22dd465499a', token: tokenA },
            facebook:  { id: '6a234c5ac687a22dd465fbc2', token: tokenB },
        };
        const ideaOrgs = {
            tiktok:    { orgId: '6a23463c718b53dcaa08024b', token: tokenB },
            instagram: { orgId: '6a204f0472772154c8dff558', token: tokenA },
            youtube:   { orgId: '6a23463c718b53dcaa08024b', token: tokenB },
        };

        const createPost = `mutation($input: CreatePostInput!) {
            createPost(input: $input) {
                ... on PostActionSuccess { post { id status } }
                ... on InvalidInputError { message }
                ... on UnexpectedError { message }
            }
        }`;
        const createIdea = `mutation($input: CreateIdeaInput!) {
            createIdea(input: $input) {
                ... on Idea { id content { title } }
            }
        }`;

        let queued = 0, ideas = 0, errors = 0;

        /* Queue text channels */
        for (const [key, ch] of Object.entries(textChannels)) {
            const text = document.getElementById(`socialCopy_${key}`)?.value?.trim();
            if (!text || !ch.token) continue;
            try {
                const res = await fetch(PROXY, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: ch.token,
                        query: createPost,
                        variables: { input: {
                            channelId: ch.id,
                            text: text,
                            mode: 'addToQueue',
                            schedulingType: 'automatic',
                            assets: {},
                        }},
                    }),
                });
                const data = await res.json();
                if (data.data?.createPost?.post) queued++;
                else { errors++; console.warn(key, data); }
            } catch (e) { errors++; console.error(key, e); }
        }

        /* Save ideas for video channels */
        for (const [key, ch] of Object.entries(ideaOrgs)) {
            const text = document.getElementById(`socialCopy_${key}`)?.value?.trim();
            if (!text || !ch.token) continue;
            try {
                const title = slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const res = await fetch(PROXY, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: ch.token,
                        query: createIdea,
                        variables: { input: {
                            organizationId: ch.orgId,
                            content: { title: `[VIDEO] ${title}`, text: text },
                        }},
                    }),
                });
                const data = await res.json();
                if (data.data?.createIdea?.id) ideas++;
                else { errors++; console.warn(key, data); }
            } catch (e) { errors++; console.error(key, e); }
        }

        if (btn) { btn.disabled = false; btn.textContent = '📡 Queue to Buffer'; }

        const summary = [];
        if (queued) summary.push(`${queued} posts queued`);
        if (ideas) summary.push(`${ideas} ideas saved`);
        if (errors) summary.push(`${errors} errors`);

        UI.toast(summary.join(', ') || 'Nothing to queue', errors ? 'error' : 'success');

        if (!errors) {
            const modal = document.querySelector('.modal-overlay');
            if (modal) setTimeout(() => modal.remove(), 1500);
        }
    },
};

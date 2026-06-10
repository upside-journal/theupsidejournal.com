/* ═══════════════════════════════════════════════════
   SOCIAL SCHEDULER  (v1 — Session 5)
   Buffer GraphQL integration for cross-platform
   social media scheduling across 6 channels.
   ═══════════════════════════════════════════════════ */

const SocialModule = {
    activeTab: 'channels',
    _channels: [],
    _posts: [],
    _loading: false,
    _postFilter: 'scheduled',

    /* ─── Buffer GraphQL helper (via CF Worker proxy) ─── */
    _PROXY: 'https://uj-social-proxy.pages.dev/api/buffer/graphql',
    async _gql(token, query, variables = {}) {
        const res = await fetch(this._PROXY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, query, variables }),
        });
        const data = await res.json();
        if (data.errors) throw new Error(data.errors.map(e => e.message).join('; '));
        return data.data;
    },

    /* ─── Token helpers ─── */
    _getTokenA() { return API._getToken('buffer_a'); },
    _getTokenB() { return API._getToken('buffer_b'); },

    _hasTokens() {
        return !!(this._getTokenA() && this._getTokenB());
    },

    /* ─── Service metadata ─── */
    _serviceInfo: {
        linkedin:  { icon: '💼', color: '#0A66C2', label: 'LinkedIn' },
        instagram: { icon: '📸', color: '#E1306C', label: 'Instagram' },
        twitter:   { icon: '𝕏',  color: '#1DA1F2', label: 'X / Twitter' },
        tiktok:    { icon: '🎵', color: '#000000', label: 'TikTok' },
        facebook:  { icon: '📘', color: '#1877F2', label: 'Facebook' },
        youtube:   { icon: '▶️', color: '#FF0000', label: 'YouTube' },
    },

    /* ─── Main Render ─── */
    async render() {
        const page = document.getElementById('pageContainer');

        if (!this._hasTokens()) {
            page.innerHTML = this._noTokensView();
            return;
        }

        page.innerHTML = `
            ${UI.sectionHeader('Social Scheduler',
                'Buffer integration · 6 channels · Schedule, queue & publish',
                UI.btn('↻ Refresh', 'btn-secondary btn-sm', 'onclick="SocialModule.refresh()"')
            )}
            ${UI.tabs([
                { id: 'channels', label: 'Channels (6)' },
                { id: 'queue',    label: 'Post Queue' },
                { id: 'compose',  label: '✎ Compose' },
            ], this.activeTab)}
            <div id="socialContent">${UI.loading('Connecting to Buffer...')}</div>
        `;

        document.querySelectorAll('[data-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                this.activeTab = tab.dataset.tab;
                this._renderTab();
            });
        });

        await this._loadData();
        this._renderTab();
    },

    async refresh() {
        UI.toast('Refreshing social data...', 'warning', 1500);
        await this._loadData(true);
        this._renderTab();
    },

    /* ─── Data Loading ─── */
    async _loadData(force = false) {
        if (this._channels.length > 0 && !force) return;
        try {
            const tokenA = this._getTokenA();
            const tokenB = this._getTokenB();
            const orgA = CONFIG.buffer.orgs.socialA;
            const orgB = CONFIG.buffer.orgs.socialB;

            const chQuery = `query($orgId: OrganizationId!) {
                channels(input: { organizationId: $orgId }) {
                    id name service avatar type isDisconnected
                    postingSchedule { day times paused }
                    postingGoal { goal sentCount scheduledCount status }
                }
            }`;

            const [dataA, dataB] = await Promise.all([
                this._gql(tokenA, chQuery, { orgId: orgA }),
                this._gql(tokenB, chQuery, { orgId: orgB }),
            ]);

            this._channels = [
                ...(dataA.channels || []).map(c => ({ ...c, _org: 'A', _token: tokenA, _orgId: orgA })),
                ...(dataB.channels || []).map(c => ({ ...c, _org: 'B', _token: tokenB, _orgId: orgB })),
            ];

            // Load recent posts
            await this._loadPosts();
        } catch (e) {
            console.error('Buffer load error:', e);
            UI.toast('Buffer API error: ' + e.message, 'error');
        }
    },

    async _loadPosts(filter) {
        try {
            const tokenA = this._getTokenA();
            const tokenB = this._getTokenB();
            const orgA = CONFIG.buffer.orgs.socialA;
            const orgB = CONFIG.buffer.orgs.socialB;

            const filterParam = filter || this._postFilter;
            const postQuery = `query($orgId: OrganizationId!) {
                posts(input: {
                    organizationId: $orgId,
                    filter: { status: "${filterParam}" }
                }, first: 30) {
                    edges {
                        node {
                            id status text dueAt sentAt createdAt
                            channelService schedulingType
                            channel { id name service avatar }
                            assets { ... on ImageAsset { type source thumbnail } }
                        }
                    }
                }
            }`;

            const [postsA, postsB] = await Promise.all([
                this._gql(tokenA, postQuery, { orgId: orgA }),
                this._gql(tokenB, postQuery, { orgId: orgB }),
            ]);

            const extractPosts = (data, org) =>
                (data?.posts?.edges || []).map(e => ({ ...e.node, _org: org }));

            this._posts = [
                ...extractPosts(postsA, 'A'),
                ...extractPosts(postsB, 'B'),
            ].sort((a, b) => {
                const da = a.dueAt || a.sentAt || a.createdAt;
                const db = b.dueAt || b.sentAt || b.createdAt;
                return new Date(db) - new Date(da);
            });
        } catch (e) {
            console.error('Posts load error:', e);
        }
    },

    /* ─── Tab Router ─── */
    _renderTab() {
        const container = document.getElementById('socialContent');
        if (!container) return;
        switch (this.activeTab) {
            case 'channels': container.innerHTML = this._channelsView(); break;
            case 'queue':    container.innerHTML = this._queueView(); this._bindQueueFilters(); break;
            case 'compose':  container.innerHTML = this._composeView(); this._bindCompose(); break;
        }
    },

    /* ═══════════════════════════════════════
       CHANNELS TAB
       ═══════════════════════════════════════ */
    _channelsView() {
        if (this._channels.length === 0) {
            return UI.empty('📡', 'No channels loaded', 'Check your Buffer tokens in Ops Center → API Vault');
        }

        const cards = this._channels.map(ch => {
            const info = this._serviceInfo[ch.service] || { icon: '📱', color: '#666', label: ch.service };
            const statusBadge = ch.isDisconnected
                ? UI.badge('Disconnected', 'red')
                : UI.badge('Connected', 'green');
            const goal = ch.postingGoal;
            const goalHtml = goal ? `
                <div class="social-goal">
                    <span class="social-goal-label">Weekly goal:</span>
                    <span class="social-goal-progress">${goal.sentCount + goal.scheduledCount}/${goal.goal}</span>
                </div>` : '';

            const schedule = (ch.postingSchedule || [])
                .filter(s => !s.paused && s.times && s.times.length > 0)
                .map(s => `${s.day.slice(0,3)}: ${s.times.join(', ')}`)
                .slice(0, 3);

            return `
                <div class="social-channel-card" style="--ch-color: ${info.color}">
                    <div class="social-channel-header">
                        <div class="social-channel-avatar">
                            ${ch.avatar
                                ? `<img src="${ch.avatar}" alt="${ch.name}" onerror="this.parentElement.textContent='${info.icon}'">`
                                : info.icon
                            }
                        </div>
                        <div class="social-channel-info">
                            <div class="social-channel-name">${UI.esc(ch.name)}</div>
                            <div class="social-channel-service">${info.label} · ${ch.type}</div>
                        </div>
                        ${statusBadge}
                    </div>
                    ${goalHtml}
                    ${schedule.length > 0 ? `
                        <div class="social-schedule-times">
                            <span class="form-label" style="margin-bottom:2px;font-size:10px">POSTING TIMES</span>
                            ${schedule.map(s => `<div style="font-size:11px;color:var(--slate-500)">${s}</div>`).join('')}
                            ${(ch.postingSchedule || []).filter(s => !s.paused).length > 3
                                ? `<div style="font-size:10px;color:var(--slate-400)">+ ${(ch.postingSchedule || []).filter(s => !s.paused).length - 3} more days</div>`
                                : ''
                            }
                        </div>
                    ` : ''}
                </div>`;
        }).join('');

        return `
            <div class="stats-grid" style="margin-top:16px;margin-bottom:20px">
                ${UI.statCard('CHANNELS', this._channels.length)}
                ${UI.statCard('CONNECTED', this._channels.filter(c => !c.isDisconnected).length)}
                ${UI.statCard('SCHEDULED', this._posts.filter(p => p.status === 'scheduled').length)}
                ${UI.statCard('SENT (RECENT)', this._posts.filter(p => p.status === 'sent').length)}
            </div>
            <div class="social-channels-grid">${cards}</div>
        `;
    },

    /* ═══════════════════════════════════════
       QUEUE TAB
       ═══════════════════════════════════════ */
    _queueView() {
        const filters = ['scheduled', 'sent', 'draft'].map(f =>
            `<button class="btn ${this._postFilter === f ? 'btn-primary' : 'btn-secondary'} btn-sm"
                     data-filter="${f}">${f.charAt(0).toUpperCase() + f.slice(1)}</button>`
        ).join('');

        const rows = this._posts.map(post => {
            const info = this._serviceInfo[post.channelService] || { icon: '📱', label: post.channelService };
            const channelName = post.channel?.name || '—';
            const text = UI.truncate(post.text || '(no text)', 80);
            const time = post.dueAt
                ? new Date(post.dueAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : post.sentAt
                    ? new Date(post.sentAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                    : '—';
            const statusBadge = post.status === 'sent'
                ? UI.badge('Sent', 'green')
                : post.status === 'scheduled'
                    ? UI.badge('Scheduled', 'blue')
                    : UI.badge(post.status || 'Draft', 'slate');

            const hasImage = post.assets && post.assets.length > 0;

            return `
                <div class="social-post-row" data-post-id="${post.id}">
                    <div class="social-post-channel">
                        <span class="social-post-icon" title="${info.label}">${info.icon}</span>
                        <span class="social-post-channel-name">${UI.esc(channelName)}</span>
                    </div>
                    <div class="social-post-text">
                        ${hasImage ? '<span title="Has media">🖼 </span>' : ''}
                        ${UI.esc(text)}
                    </div>
                    <div class="social-post-time">${time}</div>
                    <div class="social-post-status">${statusBadge}</div>
                    ${post.status === 'scheduled' ? `
                        <button class="btn btn-ghost btn-xs" onclick="SocialModule.deletePost('${post.id}', '${post._org}')" title="Delete">🗑</button>
                    ` : ''}
                </div>`;
        }).join('');

        return `
            <div class="card mt-16">
                <div class="card-header">
                    <span class="card-title">Post Queue</span>
                    <div style="display:flex;gap:6px" id="queueFilters">${filters}</div>
                </div>
                <div class="card-body" style="padding:0">
                    ${this._posts.length > 0
                        ? `<div class="social-posts-list">${rows}</div>`
                        : UI.empty('📭', 'No posts', `No ${this._postFilter} posts found across your channels`)
                    }
                </div>
                <div class="card-footer" style="font-size:11px;color:var(--slate-400)">
                    Showing ${this._posts.length} ${this._postFilter} posts across ${this._channels.length} channels
                </div>
            </div>`;
    },

    _bindQueueFilters() {
        document.querySelectorAll('#queueFilters [data-filter]').forEach(btn => {
            btn.addEventListener('click', async () => {
                this._postFilter = btn.dataset.filter;
                const container = document.getElementById('socialContent');
                container.innerHTML = UI.loading('Loading posts...');
                await this._loadPosts(this._postFilter);
                container.innerHTML = this._queueView();
                this._bindQueueFilters();
            });
        });
    },

    /* ═══════════════════════════════════════
       COMPOSE TAB
       ═══════════════════════════════════════ */
    _composeView() {
        const channelChecks = this._channels.map(ch => {
            const info = this._serviceInfo[ch.service] || { icon: '📱', label: ch.service };
            return `
                <label class="social-compose-channel" title="${info.label} — ${ch.name}">
                    <input type="checkbox" value="${ch.id}" data-org="${ch._org}" data-service="${ch.service}">
                    <span class="social-compose-channel-icon">${info.icon}</span>
                    <span class="social-compose-channel-label">${UI.esc(ch.name)}</span>
                </label>`;
        }).join('');

        return `
            <div class="card mt-16">
                <div class="card-header">
                    <span class="card-title">Compose Post</span>
                </div>
                <div class="card-body">
                    <div class="form-group">
                        <label class="form-label">Post Text</label>
                        <textarea class="form-input social-compose-text" id="composeText"
                                  rows="5" placeholder="Write your post... (supports emoji, hashtags, mentions)"></textarea>
                        <div style="display:flex;justify-content:space-between;margin-top:4px">
                            <span style="font-size:11px;color:var(--slate-400)">
                                Tip: text is shared across selected channels. Platform-specific formatting coming soon.
                            </span>
                            <span class="social-char-count" id="charCount">0</span>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Select Channels</label>
                        <div class="social-compose-channels">${channelChecks}</div>
                        <div style="display:flex;gap:8px;margin-top:8px">
                            <button class="btn btn-ghost btn-xs" onclick="SocialModule._selectAll(true)">Select All</button>
                            <button class="btn btn-ghost btn-xs" onclick="SocialModule._selectAll(false)">Deselect All</button>
                            <button class="btn btn-ghost btn-xs" onclick="SocialModule._selectTextOnly()">Text Only (LI, X, FB)</button>
                        </div>
                    </div>

                    <div class="form-group">
                        <label class="form-label">Scheduling</label>
                        <div class="social-compose-schedule">
                            <label class="social-schedule-option">
                                <input type="radio" name="scheduleMode" value="addToQueue" checked>
                                <div>
                                    <strong>Add to Queue</strong>
                                    <div style="font-size:11px;color:var(--slate-400)">Posts at next available slot</div>
                                </div>
                            </label>
                            <label class="social-schedule-option">
                                <input type="radio" name="scheduleMode" value="shareNow">
                                <div>
                                    <strong>Share Now</strong>
                                    <div style="font-size:11px;color:var(--slate-400)">Publish immediately</div>
                                </div>
                            </label>
                            <label class="social-schedule-option">
                                <input type="radio" name="scheduleMode" value="shareNext">
                                <div>
                                    <strong>Share Next</strong>
                                    <div style="font-size:11px;color:var(--slate-400)">Jump to front of queue</div>
                                </div>
                            </label>
                            <label class="social-schedule-option">
                                <input type="radio" name="scheduleMode" value="customScheduled">
                                <div>
                                    <strong>Custom Time</strong>
                                    <div style="font-size:11px;color:var(--slate-400)">Pick exact date & time</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="form-group" id="customTimeGroup" style="display:none">
                        <label class="form-label">Schedule Date & Time</label>
                        <div style="display:flex;gap:8px">
                            <input type="date" class="form-input" id="scheduleDate" style="flex:1">
                            <input type="time" class="form-input" id="scheduleTime" style="width:120px" value="09:00">
                        </div>
                    </div>

                    <div style="display:flex;gap:8px;margin-top:16px">
                        <button class="btn btn-primary" id="btnPublish" onclick="SocialModule.submitPost()">
                            📤 Schedule Post
                        </button>
                        <button class="btn btn-secondary" onclick="SocialModule.saveDraft()">
                            💾 Save as Draft
                        </button>
                    </div>
                </div>
            </div>

            <div class="card mt-16">
                <div class="card-header">
                    <span class="card-title">Preview</span>
                </div>
                <div class="card-body" id="composePreview">
                    <div style="color:var(--slate-400);font-size:13px;text-align:center;padding:20px">
                        Start typing to see preview...
                    </div>
                </div>
            </div>
        `;
    },

    _bindCompose() {
        const textarea = document.getElementById('composeText');
        const charCount = document.getElementById('charCount');
        const preview = document.getElementById('composePreview');

        if (textarea) {
            textarea.addEventListener('input', () => {
                const len = textarea.value.length;
                charCount.textContent = len;
                charCount.style.color = len > 280 ? 'var(--red)' : len > 200 ? 'var(--amber)' : 'var(--slate-400)';
                this._updatePreview(textarea.value);
            });
        }

        // Show/hide custom time
        document.querySelectorAll('[name="scheduleMode"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const group = document.getElementById('customTimeGroup');
                group.style.display = radio.value === 'customScheduled' && radio.checked ? 'block' : 'none';

                const btn = document.getElementById('btnPublish');
                if (radio.value === 'shareNow') btn.textContent = '🚀 Publish Now';
                else btn.textContent = '📤 Schedule Post';
            });
        });

        // Set default date to tomorrow
        const dateInput = document.getElementById('scheduleDate');
        if (dateInput) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            dateInput.value = tomorrow.toISOString().split('T')[0];
        }
    },

    _updatePreview(text) {
        const preview = document.getElementById('composePreview');
        if (!preview || !text.trim()) {
            if (preview) preview.innerHTML = '<div style="color:var(--slate-400);font-size:13px;text-align:center;padding:20px">Start typing to see preview...</div>';
            return;
        }

        const selected = [...document.querySelectorAll('.social-compose-channel input:checked')];
        const previews = selected.map(input => {
            const service = input.dataset.service;
            const info = this._serviceInfo[service] || { icon: '📱', label: service };
            const maxLen = service === 'twitter' ? 280 : service === 'linkedin' ? 3000 : 2200;
            const truncated = text.length > maxLen;
            return `
                <div class="social-preview-card">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                        <span>${info.icon}</span>
                        <strong style="font-size:12px">${info.label}</strong>
                        ${truncated ? `<span style="color:var(--red);font-size:10px">${text.length}/${maxLen} chars</span>` : ''}
                    </div>
                    <div style="font-size:13px;white-space:pre-wrap;word-break:break-word;color:var(--slate-700)">${UI.esc(text.slice(0, maxLen))}</div>
                </div>`;
        }).join('');

        preview.innerHTML = previews || '<div style="color:var(--slate-400);font-size:13px;text-align:center;padding:20px">Select channels to preview</div>';
    },

    /* ─── Channel selection helpers ─── */
    _selectAll(state) {
        document.querySelectorAll('.social-compose-channel input').forEach(cb => cb.checked = state);
        const text = document.getElementById('composeText');
        if (text) this._updatePreview(text.value);
    },

    _selectTextOnly() {
        document.querySelectorAll('.social-compose-channel input').forEach(cb => {
            const svc = cb.dataset.service;
            cb.checked = ['linkedin', 'twitter', 'facebook'].includes(svc);
        });
        const text = document.getElementById('composeText');
        if (text) this._updatePreview(text.value);
    },

    /* ═══════════════════════════════════════
       POST ACTIONS
       ═══════════════════════════════════════ */
    async submitPost() {
        const text = document.getElementById('composeText')?.value?.trim();
        if (!text) { UI.toast('Please write some text first', 'error'); return; }

        const selected = [...document.querySelectorAll('.social-compose-channel input:checked')];
        if (selected.length === 0) { UI.toast('Select at least one channel', 'error'); return; }

        const mode = document.querySelector('[name="scheduleMode"]:checked')?.value || 'addToQueue';

        let dueAt = null;
        if (mode === 'customScheduled') {
            const date = document.getElementById('scheduleDate')?.value;
            const time = document.getElementById('scheduleTime')?.value || '09:00';
            if (!date) { UI.toast('Pick a date for custom scheduling', 'error'); return; }
            dueAt = new Date(`${date}T${time}:00`).toISOString();
        }

        const btn = document.getElementById('btnPublish');
        const origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ Sending...';

        let success = 0, failed = 0;

        for (const input of selected) {
            const channelId = input.value;
            const org = input.dataset.org;
            const token = org === 'A' ? this._getTokenA() : this._getTokenB();

            const mutation = `mutation($input: CreatePostInput!) {
                createPost(input: $input) {
                    ... on PostActionSuccess { post { id status dueAt } }
                    ... on InvalidInputError { message }
                    ... on UnauthorizedError { message }
                    ... on UnexpectedError { message }
                    ... on LimitReachedError { message }
                    ... on PostPublishingError { message }
                }
            }`;

            const variables = {
                input: {
                    channelId,
                    text,
                    mode,
                    schedulingType: 'automatic',
                    assets: {},
                    ...(dueAt ? { dueAt } : {}),
                },
            };

            try {
                const result = await this._gql(token, mutation, variables);
                const post = result.createPost;
                if (post?.post?.id) {
                    success++;
                } else {
                    const msg = post?.message || 'Unknown error';
                    console.error(`Post failed for ${channelId}:`, msg);
                    failed++;
                }
            } catch (e) {
                console.error(`Post error for ${channelId}:`, e);
                failed++;
            }
        }

        btn.disabled = false;
        btn.textContent = origText;

        if (success > 0) {
            UI.toast(`✓ ${success} post${success > 1 ? 's' : ''} ${mode === 'shareNow' ? 'published' : 'scheduled'}${failed > 0 ? ` (${failed} failed)` : ''}`, 'success');
            document.getElementById('composeText').value = '';
            document.getElementById('charCount').textContent = '0';
            // Refresh queue
            await this._loadPosts();
        } else {
            UI.toast(`Failed to create posts: ${failed} error${failed > 1 ? 's' : ''}`, 'error');
        }
    },

    async saveDraft() {
        const text = document.getElementById('composeText')?.value?.trim();
        if (!text) { UI.toast('Nothing to save', 'error'); return; }

        const selected = [...document.querySelectorAll('.social-compose-channel input:checked')];
        if (selected.length === 0) { UI.toast('Select at least one channel', 'error'); return; }

        let success = 0;
        for (const input of selected) {
            const channelId = input.value;
            const org = input.dataset.org;
            const token = org === 'A' ? this._getTokenA() : this._getTokenB();

            const mutation = `mutation($input: CreatePostInput!) {
                createPost(input: $input) {
                    ... on PostActionSuccess { post { id status } }
                    ... on InvalidInputError { message }
                    ... on UnexpectedError { message }
                }
            }`;

            try {
                const result = await this._gql(token, mutation, {
                    input: {
                        channelId,
                        text,
                        mode: 'addToQueue',
                        schedulingType: 'automatic',
                        assets: {},
                        saveToDraft: true,
                    },
                });
                if (result.createPost?.post?.id) success++;
            } catch (e) {
                console.error('Draft save error:', e);
            }
        }

        if (success > 0) {
            UI.toast(`✓ Saved ${success} draft${success > 1 ? 's' : ''} to Buffer`, 'success');
        } else {
            UI.toast('Failed to save drafts', 'error');
        }
    },

    async deletePost(postId, org) {
        if (!confirm('Delete this scheduled post?')) return;

        const token = org === 'A' ? this._getTokenA() : this._getTokenB();
        const mutation = `mutation($input: DeletePostInput!) {
            deletePost(input: $input) {
                ... on DeletePostSuccess { id }
                ... on UnauthorizedError { message }
                ... on NotFoundError { message }
            }
        }`;

        try {
            await this._gql(token, mutation, { input: { id: postId } });
            UI.toast('Post deleted', 'success');
            this._posts = this._posts.filter(p => p.id !== postId);
            this._renderTab();
        } catch (e) {
            UI.toast('Delete failed: ' + e.message, 'error');
        }
    },

    /* ─── No Tokens View ─── */
    _noTokensView() {
        return `
            ${UI.sectionHeader('Social Scheduler', 'Buffer integration required')}
            <div class="card mt-16">
                <div class="card-body" style="text-align:center;padding:40px">
                    <div style="font-size:48px;margin-bottom:16px">📡</div>
                    <h3 style="margin-bottom:8px">Connect Buffer</h3>
                    <p style="color:var(--slate-500);max-width:400px;margin:0 auto 20px">
                        Add your Buffer API tokens to the Token Vault to connect your social channels.
                    </p>
                    <ol style="text-align:left;max-width:400px;margin:0 auto 20px;color:var(--slate-600);font-size:13px;line-height:2">
                        <li>Go to <strong>Ops Center → API Vault</strong></li>
                        <li>Click <strong>Set</strong> on <em>Buffer (Social A)</em> — paste your Org 1 token</li>
                        <li>Click <strong>Set</strong> on <em>Buffer (Social B)</em> — paste your Org 2 token</li>
                        <li>Return here and refresh</li>
                    </ol>
                    <a href="#/operations" class="btn btn-primary">Go to API Vault →</a>
                </div>
            </div>`;
    },
};

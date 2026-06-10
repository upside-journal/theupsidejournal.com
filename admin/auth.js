/* ═══════════════════════════════════════════════════
   MISSION CONTROL — Auth System  (v4 — Session 3)
   Email + password authentication with user management.
   Users stored in users.json (GitHub repo as DB).
   Supports: login, register, approve/reject, 5-user cap.
   ═══════════════════════════════════════════════════ */

const UserStore = {
    _users: null,
    _loaded: false,
    MAX_USERS: 5,

    // SHA-256 hash helper
    async sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // Load users from GitHub repo
    async load() {
        try {
            const token = API._getToken('github') || CONFIG.github.defaultToken;
            const headers = { 'Accept': 'application/vnd.github.v3+json' };
            if (token) headers['Authorization'] = `token ${token}`;

            const res = await fetch(
                `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}/contents/users.json?ref=${CONFIG.github.branch}&t=${Date.now()}`,
                { headers, cache: 'no-store' }
            );

            if (res.ok) {
                const data = await res.json();
                const decoded = atob(data.content.replace(/\n/g, ''));
                this._users = JSON.parse(decoded);
                this._sha = data.sha;
            } else {
                // No users.json yet — use defaults
                this._users = CONFIG.auth.defaultUsers.map(u => ({ ...u }));
                this._sha = null;
            }
        } catch (e) {
            console.warn('UserStore: GitHub fetch failed, using defaults', e);
            this._users = CONFIG.auth.defaultUsers.map(u => ({ ...u }));
            this._sha = null;
        }
        this._loaded = true;
        return this._users;
    },

    // Save users to GitHub repo
    async save(commitMsg) {
        const token = API._getToken('github') || CONFIG.github.defaultToken;
        if (!token) throw new Error('GitHub token required');

        const content = btoa(unescape(encodeURIComponent(JSON.stringify(this._users, null, 2))));
        const body = {
            message: commitMsg || 'Update users.json',
            content,
            branch: CONFIG.github.branch,
        };
        if (this._sha) body.sha = this._sha;

        const res = await fetch(
            `https://api.github.com/repos/${CONFIG.github.owner}/${CONFIG.github.repo}/contents/users.json`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }
        );

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(`Save failed: ${res.status} — ${err.message || 'Unknown error'}`);
        }

        const result = await res.json();
        this._sha = result.content.sha;
        return result;
    },

    // Get all users
    getAll() {
        return this._users || [];
    },

    // Get by email (case-insensitive)
    getByEmail(email) {
        return (this._users || []).find(
            u => u.email.toLowerCase() === email.toLowerCase()
        );
    },

    // Count active (approved) users
    countActive() {
        return (this._users || []).filter(u => u.status === 'approved').length;
    },

    // Count total (including pending)
    countTotal() {
        return (this._users || []).length;
    },

    // Can register? (5-user cap on approved users, but allow pending registrations)
    canRegister() {
        return this.countActive() < this.MAX_USERS;
    },
};

const Auth = {
    _currentUser: null,

    isAuthenticated() {
        const session = sessionStorage.getItem(CONFIG.auth.sessionKey);
        if (!session) return false;
        try {
            const data = JSON.parse(session);
            this._currentUser = data;
            return data && data.email && data.status === 'approved';
        } catch {
            return false;
        }
    },

    getCurrentUser() {
        return this._currentUser;
    },

    async login(email, password) {
        if (!UserStore._loaded) await UserStore.load();

        const user = UserStore.getByEmail(email);
        if (!user) return { ok: false, error: 'No account found with that email.' };

        const hash = await UserStore.sha256(password);
        if (hash !== user.passwordHash) return { ok: false, error: 'Incorrect password.' };

        if (user.status === 'pending') return { ok: false, error: 'Your account is pending admin approval.' };
        if (user.status === 'rejected') return { ok: false, error: 'Your account request was declined.' };

        // Store session
        this._currentUser = { email: user.email, role: user.role, name: user.name, status: user.status };
        sessionStorage.setItem(CONFIG.auth.sessionKey, JSON.stringify(this._currentUser));
        return { ok: true };
    },

    async register(name, email, password) {
        if (!UserStore._loaded) await UserStore.load();

        // Check if email already exists
        if (UserStore.getByEmail(email)) {
            return { ok: false, error: 'An account with this email already exists.' };
        }

        // Check 5-user cap
        if (!UserStore.canRegister()) {
            return { ok: false, error: 'Maximum user limit (5) reached. Contact an admin.' };
        }

        const hash = await UserStore.sha256(password);
        const newUser = {
            email: email.toLowerCase().trim(),
            name: name.trim(),
            passwordHash: hash,
            role: 'editor',
            status: 'pending',
            createdAt: new Date().toISOString(),
        };

        UserStore._users.push(newUser);

        try {
            await UserStore.save(`Register: ${email} (pending approval)`);
        } catch (e) {
            // Rollback
            UserStore._users.pop();
            return { ok: false, error: 'Registration failed — please try again.' };
        }

        return { ok: true };
    },

    async approveUser(email) {
        const user = UserStore.getByEmail(email);
        if (!user) return false;

        // Check cap before approving
        if (UserStore.countActive() >= UserStore.MAX_USERS) {
            UI.toast('Cannot approve — 5-user limit reached', 'error');
            return false;
        }

        user.status = 'approved';
        user.approvedAt = new Date().toISOString();
        try {
            await UserStore.save(`Approve user: ${email}`);
            return true;
        } catch (e) {
            user.status = 'pending';
            return false;
        }
    },

    async rejectUser(email) {
        const user = UserStore.getByEmail(email);
        if (!user) return false;

        user.status = 'rejected';
        try {
            await UserStore.save(`Reject user: ${email}`);
            return true;
        } catch (e) {
            user.status = 'pending';
            return false;
        }
    },

    async removeUser(email) {
        const idx = UserStore._users.findIndex(
            u => u.email.toLowerCase() === email.toLowerCase()
        );
        if (idx === -1) return false;

        const removed = UserStore._users.splice(idx, 1);
        try {
            await UserStore.save(`Remove user: ${email}`);
            return true;
        } catch (e) {
            UserStore._users.splice(idx, 0, removed[0]);
            return false;
        }
    },

    async changeRole(email, newRole) {
        const user = UserStore.getByEmail(email);
        if (!user) return false;

        const old = user.role;
        user.role = newRole;
        try {
            await UserStore.save(`Change role: ${email} → ${newRole}`);
            return true;
        } catch (e) {
            user.role = old;
            return false;
        }
    },

    logout() {
        sessionStorage.removeItem(CONFIG.auth.sessionKey);
        this._currentUser = null;
        location.reload();
    },

    // ─── Render Login / Register Screen ───
    renderLoginScreen() {
        // Hide sidebar and topbar
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        if (sidebar) sidebar.style.display = 'none';
        if (mainContent) mainContent.style.marginLeft = '0';

        const page = document.getElementById('pageContainer');
        const topbar = document.querySelector('.topbar');
        if (topbar) topbar.style.display = 'none';

        this._showLoginForm(page);
    },

    _showLoginForm(page) {
        page.innerHTML = `
            <div class="login-screen">
                <div class="login-card">
                    <div class="login-brand">
                        <div class="login-logo">UJ</div>
                        <h1 class="login-title">MISSION CONTROL</h1>
                        <p class="login-sub">theupsidejournal.com</p>
                    </div>
                    <form id="loginForm" class="login-form" autocomplete="off">
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input type="email" class="form-input" id="loginEmail"
                                   placeholder="you@example.com" autofocus required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Password</label>
                            <input type="password" class="form-input" id="loginPassword"
                                   placeholder="Enter your password" required>
                        </div>
                        <div id="loginError" class="login-error" style="display:none"></div>
                        <button type="submit" class="btn btn-primary" id="loginBtn"
                                style="width:100%;padding:12px;font-size:14px;justify-content:center">
                            Sign In
                        </button>
                    </form>
                    <div class="login-divider">
                        <span>or</span>
                    </div>
                    <div style="padding:0 32px 28px;text-align:center">
                        <button class="btn btn-ghost" id="showRegister"
                                style="font-size:13px;color:var(--gold)">
                            Request Access →
                        </button>
                    </div>
                    <div class="login-footer">
                        🔒 Protected admin area · Powered by Viktor AI
                    </div>
                </div>
            </div>
        `;

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('loginBtn');
            const errEl = document.getElementById('loginError');
            btn.disabled = true;
            btn.textContent = 'Signing in...';
            errEl.style.display = 'none';

            const email = document.getElementById('loginEmail').value.trim();
            const pw = document.getElementById('loginPassword').value;
            const result = await Auth.login(email, pw);

            if (result.ok) {
                location.reload();
            } else {
                errEl.textContent = result.error;
                errEl.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'Sign In';
            }
        });

        document.getElementById('showRegister').addEventListener('click', () => {
            this._showRegisterForm(page);
        });
    },

    _showRegisterForm(page) {
        page.innerHTML = `
            <div class="login-screen">
                <div class="login-card">
                    <div class="login-brand">
                        <div class="login-logo">UJ</div>
                        <h1 class="login-title">REQUEST ACCESS</h1>
                        <p class="login-sub">theupsidejournal.com</p>
                    </div>
                    <form id="registerForm" class="login-form" autocomplete="off">
                        <div class="form-group">
                            <label class="form-label">Full Name</label>
                            <input type="text" class="form-input" id="regName"
                                   placeholder="Your full name" autofocus required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Email</label>
                            <input type="email" class="form-input" id="regEmail"
                                   placeholder="you@example.com" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Password</label>
                            <input type="password" class="form-input" id="regPassword"
                                   placeholder="Min 8 characters" required minlength="8">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Confirm Password</label>
                            <input type="password" class="form-input" id="regConfirm"
                                   placeholder="Re-enter password" required>
                        </div>
                        <div id="regError" class="login-error" style="display:none"></div>
                        <div id="regSuccess" class="login-success" style="display:none"></div>
                        <button type="submit" class="btn btn-primary" id="regBtn"
                                style="width:100%;padding:12px;font-size:14px;justify-content:center">
                            Request Access
                        </button>
                    </form>
                    <div class="login-divider">
                        <span>or</span>
                    </div>
                    <div style="padding:0 32px 28px;text-align:center">
                        <button class="btn btn-ghost" id="showLogin"
                                style="font-size:13px;color:var(--gold)">
                            ← Back to Sign In
                        </button>
                    </div>
                    <div class="login-footer">
                        🔒 Registrations require admin approval · Max 5 users
                    </div>
                </div>
            </div>
        `;

        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('regBtn');
            const errEl = document.getElementById('regError');
            const successEl = document.getElementById('regSuccess');
            errEl.style.display = 'none';
            successEl.style.display = 'none';

            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const pw = document.getElementById('regPassword').value;
            const confirm = document.getElementById('regConfirm').value;

            if (pw !== confirm) {
                errEl.textContent = 'Passwords do not match.';
                errEl.style.display = 'block';
                return;
            }

            if (pw.length < 8) {
                errEl.textContent = 'Password must be at least 8 characters.';
                errEl.style.display = 'block';
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Submitting...';

            const result = await Auth.register(name, email, pw);
            if (result.ok) {
                successEl.textContent = '✓ Access request submitted! An admin will review your request.';
                successEl.style.display = 'block';
                btn.textContent = 'Request Submitted';
                // Disable form
                document.querySelectorAll('#registerForm input').forEach(i => i.disabled = true);
            } else {
                errEl.textContent = result.error;
                errEl.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'Request Access';
            }
        });

        document.getElementById('showLogin').addEventListener('click', () => {
            this._showLoginForm(page);
        });
    },
};

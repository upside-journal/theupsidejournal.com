/* ═══════════════════════════════════════════════════
   MISSION CONTROL — App Shell & Router  (v3)
   Hash-based SPA routing for /admin
   Auth gate with SHA-256 password check
   ═══════════════════════════════════════════════════ */

const Auth = {
    async sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    isAuthenticated() {
        return sessionStorage.getItem(CONFIG.auth.sessionKey) === 'true';
    },

    async login(password) {
        const hash = await this.sha256(password);
        if (hash === CONFIG.auth.passwordHash) {
            sessionStorage.setItem(CONFIG.auth.sessionKey, 'true');
            return true;
        }
        return false;
    },

    logout() {
        sessionStorage.removeItem(CONFIG.auth.sessionKey);
        location.reload();
    },

    renderLoginScreen() {
        // Hide sidebar and topbar
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        if (sidebar) sidebar.style.display = 'none';
        if (mainContent) mainContent.style.marginLeft = '0';

        const page = document.getElementById('pageContainer');
        const topbar = document.querySelector('.topbar');
        if (topbar) topbar.style.display = 'none';

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
                            <label class="form-label">Password</label>
                            <input type="password" class="form-input" id="loginPassword"
                                   placeholder="Enter admin password" autofocus>
                        </div>
                        <div id="loginError" class="login-error" style="display:none">
                            Incorrect password. Please try again.
                        </div>
                        <button type="submit" class="btn btn-primary" style="width:100%;padding:12px;font-size:14px">
                            Sign In
                        </button>
                    </form>
                    <div class="login-footer">
                        🔒 Protected admin area · Powered by Viktor AI
                    </div>
                </div>
            </div>
        `;

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const pw = document.getElementById('loginPassword').value;
            const ok = await Auth.login(pw);
            if (ok) {
                location.reload();
            } else {
                document.getElementById('loginError').style.display = 'block';
                document.getElementById('loginPassword').value = '';
                document.getElementById('loginPassword').focus();
            }
        });
    },
};

const App = {
    routes: {
        dashboard:   { module: DashboardModule,   title: 'Dashboard',          breadcrumb: 'Dashboard' },
        publisher:   { module: PublisherModule,    title: 'Publisher Engine',   breadcrumb: 'Content → Publisher' },
        seo:         { module: SeoModule,          title: 'SEO / GEO Suite',   breadcrumb: 'Content → SEO / GEO' },
        analytics:   { module: AnalyticsModule,    title: 'Analytics Console',  breadcrumb: 'Intelligence → Analytics' },
        assets:      { module: AssetsModule,       title: 'Asset Catalog',      breadcrumb: 'Intelligence → Assets' },
        operations:  { module: OperationsModule,   title: 'Ops Center',         breadcrumb: 'Operations → Ops Center' },
        syndication: { module: SyndicationModule,  title: 'Syndication',        breadcrumb: 'Operations → Syndication' },
    },

    currentRoute: null,

    init() {
        // ─── Auth Gate ───
        if (!Auth.isAuthenticated()) {
            Auth.renderLoginScreen();
            return;
        }

        // Handle hash changes
        window.addEventListener('hashchange', () => this.navigate());

        // Sidebar toggle (mobile)
        document.getElementById('sidebarToggle')?.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.toggle('open');
        });

        // Close sidebar on nav click (mobile)
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                document.getElementById('sidebar')?.classList.remove('open');
            });
        });

        // Global refresh
        document.getElementById('btnRefresh')?.addEventListener('click', () => {
            this.navigate();
            UI.toast('Refreshing...', 'success', 1500);
        });

        // Cache purge button
        document.getElementById('btnCachePurge')?.addEventListener('click', async () => {
            try {
                UI.toast('Purging edge cache...', 'warning');
                await API.cloudflare.purgeCache();
                UI.toast('Edge cache purged ✓', 'success');
            } catch (e) {
                UI.toast('Configure Cloudflare API token in Ops Center', 'error');
            }
        });

        // Logout link in sidebar footer
        const sidebarFooter = document.querySelector('.sidebar-footer');
        if (sidebarFooter) {
            sidebarFooter.innerHTML += `
                <div style="padding:8px 20px;text-align:center">
                    <button class="btn btn-ghost btn-xs" onclick="Auth.logout()" style="font-size:11px;color:var(--slate-400)">
                        🔒 Sign Out
                    </button>
                </div>
            `;
        }

        // Navigate to initial route
        this.navigate();
    },

    navigate() {
        const hash = window.location.hash.replace('#/', '').split('?')[0] || 'dashboard';
        const route = this.routes[hash];

        if (!route) {
            window.location.hash = '#/dashboard';
            return;
        }

        this.currentRoute = hash;

        // Update active nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.route === hash);
        });

        // Update breadcrumb
        const breadcrumb = document.getElementById('breadcrumb');
        if (breadcrumb) breadcrumb.textContent = route.breadcrumb;

        // Update title
        document.title = `${route.title} — Mission Control`;

        // Render module
        route.module.render();
    },
};

// Boot
document.addEventListener('DOMContentLoaded', () => {
    App.init();
    console.log('%c⚡ Mission Control — Upside Journal', 'font-size:14px;font-weight:bold;color:#c9963a');
});

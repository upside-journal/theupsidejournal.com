/* ═══════════════════════════════════════════════════
   MISSION CONTROL — App Shell & Router  (v6 — Session 4)
   Hash-based SPA routing for /admin
   Auth via auth.js (email + password, user management)
   ═══════════════════════════════════════════════════ */

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

    async init() {
        // ─── Load users from GitHub ───
        await UserStore.load();

        // ─── Auth Gate ───
        if (!Auth.isAuthenticated()) {
            Auth.renderLoginScreen();
            return;
        }

        // Show user info in topbar
        const user = Auth.getCurrentUser();
        const avatarEl = document.querySelector('.user-avatar');
        if (avatarEl && user) {
            avatarEl.textContent = (user.name || user.email)[0].toUpperCase();
            avatarEl.title = `${user.name || ''} (${user.email}) — ${user.role}`;
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

        // Logout & user info in sidebar footer
        const sidebarFooter = document.querySelector('.sidebar-footer');
        if (sidebarFooter && user) {
            sidebarFooter.innerHTML = `
                <div class="system-status" id="systemStatus">
                    <span class="status-dot online"></span>
                    <span class="status-text">All systems nominal</span>
                </div>
                <div class="sidebar-user-info">
                    <div class="sidebar-user-email" title="${user.email}">${user.email}</div>
                    <button class="btn btn-ghost btn-xs sidebar-signout" onclick="Auth.logout()">
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
    console.log('%c⚡ Mission Control v6 — Upside Journal', 'font-size:14px;font-weight:bold;color:#c9963a');
});

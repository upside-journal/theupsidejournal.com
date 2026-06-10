# Changelog — Upside Journal Mission Control

All notable changes to the admin portal at `theupsidejournal.com/admin/` are documented here.

---

## [0.5.1] — 2026-06-10 (Session 4b)

### Fixed
- **Visual Editor article extraction** — `_extractBody()` now uses `<article>` content instead of full `<body>` (removes nav/header/footer from editor view). `_wrapBody()` splices edits back into the full page template.
- **Editor scroll containment** — `.ql-editor` now has `max-height: 70vh` + `overflow-y: auto`. No more 4600px page stretch.

### Added
- **Brevo CRM pipeline** — Created folder "Upside Journal" with 3 contact lists: Newsletter Subscribers (4), Brand Partners (5), VIP / Early Supporters (6). Synced beehiiv subscribers.
- **beehiiv integration** — API key + publication ID configured. Subscriber sync to Brevo active.
- **Token Vault** — Added Brevo + beehiiv rows to Ops Center → API Vault.
- **Daily Publish cron** — 07:00 BST daily. Checks `scheduled.json` → publishes due articles → updates index + sitemap.

### Changed
- Config version → v7, all script cache-bust tags → `?v=7`.
- GA4 Vault entry updated to correct property `539910386`.

---

## [0.5.0] — 2026-06-10 (Session 4)

### Fixed
- **Visual Editor white screen** — Quill 2.0 requires `clipboard.dangerouslyPasteHTML()` instead of `root.innerHTML` for loading article content. Editor now renders full article HTML in visual mode correctly.

### Changed
- **GA4 consolidated** — Removed old readupside.com property (`G-M09QN8XXZ5`) from all 38 HTML files. Only `G-SGW838P3YX` (theupsidejournal.com) remains. Eliminates double-tracking.
- **Admin config.js** — GA4 property updated to `539910386` / `G-SGW838P3YX`.
- **Daily analytics cron** — Viktor cron pulls GA4 + Search Console data daily, writes `admin/analytics-data.json` to the repo. Mission Control reads it on load — no server needed.
- All script + CSS cache-bust tags bumped to `?v=6`.
- App shell version → v6, console log updated.

### Added
- **Analytics data pipeline** — `admin/analytics-data.json` committed daily by Viktor with sessions, users, pageviews, top pages, traffic sources, and search queries.

---

## [0.4.0] — 2026-06-10

### Added
- **Scheduled Posts Integration** — Dashboard and Publisher now show Viktor AI's scheduled article queue, read from `scheduled.json` in the repo.
- **Dashboard "Next Publish" card** — Highlights the next upcoming article with title, series, author, and date.
- **Dashboard "Scheduled Posts" table** — Full table of all queued articles with date, series, author, and status badges (Today / Queued / Overdue).
- **Publisher "📅 Scheduled" tab** — New tab in Publisher Engine showing the full Viktor AI queue, grouped by This Week / Upcoming / Recently Published.
- **`scheduled.json`** — Machine-readable manifest at repo root, auto-updated by Viktor's daily publish cron. Contains all scheduled and recently published articles.
- **`API.scheduled.getManifest()`** — New API method in `api.js` to fetch and parse the scheduled manifest via GitHub API.

### Changed
- Dashboard stat cards now show "SCHEDULED" count instead of "SITE STATUS" (site status still in sidebar).
- Publisher tabs expanded from 2 (Live / Editor) to 3 (Live / Scheduled / Editor).
- All script tags bumped to `?v=5` for cache-busting.

---

## [0.3.0] — 2026-06-10

### Added
- **Email + Password Authentication** — Login screen now requires email and password (replacing single shared password). Per-user accounts with SHA-256 hashed passwords.
- **3 Pre-approved Admin Accounts** — `askinfocnc@gmail.com`, `read@theupsidejournal.com`, `sendpicsmfb@gmail.com` seeded as admins with full access.
- **User Registration** — "Request Access" flow on login screen. New sign-ups enter a pending state and require admin approval before gaining access.
- **Admin Approval Workflow** — New "Users" tab in Ops Center. Admins can approve, reject, or remove users. Role management (Admin / Editor) with live updates.
- **5-User Cap** — Registration enforces a maximum of 5 approved users (suitable for Year 1 scale).
- **users.json** — Lightweight user store committed to the GitHub repo. No database required — reads/writes via GitHub API.
- **auth.js** — Dedicated authentication module (`UserStore` + `Auth`) handling login, registration, session management, and user CRUD.

### Changed
- Login screen redesigned with email + password fields and "Request Access" link.
- Sidebar footer now shows logged-in user email and Sign Out button.
- Topbar avatar reflects current user's initial.
- Ops Center now has 5 tabs: Cron Controller, Slack Pods, API Vault, Edge Cache, Users.
- Config updated — auth section now uses `defaultUsers` array as fallback, `passwordHash` removed.
- Script tags bumped to `?v=4` for cache-busting.
- `login-logo` and `login-title` now use correct CSS variables (`--gold`, `--serif`) instead of undefined `--accent`/`--display`.

### Security
- Password-only login removed — all access now requires a valid email + password combination.
- Pending users see a clear "awaiting approval" message and cannot access the portal.
- Rejected users receive a "declined" message.

---

## [0.2.0] — 2026-06-10

### Added
- **WYSIWYG Editor** — Visual ↔ Code toggle in Publisher using Quill.js. Non-technical editors can now use a rich-text toolbar (bold, italic, headings, links, images, lists) without touching HTML. Seamless sync between visual and code modes.
- **Live Cloudflare Cache Purge** — Edge Cache tab now connected to real Cloudflare API. Purge specific URLs or everything globally across 300+ edge nodes. Purge log with timestamps.
- **Token Vault improvements** — Set/rotate tokens directly from the UI. Cloudflare token now shows as Active. localStorage-only storage (never transmitted).
- **Auto cache purge on publish** — Publishing an article now automatically purges the CF edge cache for that URL.
- **Cloudflare zone configuration** — Zone ID added to config for direct API calls.
- **CHANGELOG.md** — This file.

### Changed
- Publisher defaults to Visual mode when opening an article (Code mode still one click away).
- API layer upgraded to v3 — Cloudflare operations now go direct to CF API with Bearer token (no CF Pages Functions dependency).
- Operations → Edge Cache tab shows connection status and disables buttons when token is missing.
- Script tags bumped to `?v=3` for cache-busting.

---

## [0.1.0] — 2026-06-09

### Added
- **Admin SPA shell** — Sidebar navigation, topbar, toast notification system, hash-based router.
- **Dashboard** — Live article count (34), site status, today's publishing theme, quick actions, 7-day cadence table, recent articles list.
- **Publisher Engine** — HITL staging queue loading all articles from GitHub API. Inline HTML editor with commit-to-GitHub. New draft template. Local draft saving.
- **SEO / GEO Suite** — 10-point metadata validator (OG tags, Twitter Cards, JSON-LD, canonical, H1). GEO Previewer simulating Perplexity-style AI search answers. Sitemap health checker.
- **Analytics Console** — GA4, Google Search Console, and AdSense panels with placeholder configs and connection guidance.
- **Operations Center** — Cron controller (pause/resume/manual trigger). 5 Slack workflow pod status cards with activity log. API token vault (6 services). Edge cache management UI.
- **Asset Catalog** — Image assets grouped by article slug with thumbnail previews.
- **Syndication Exporter** — JSON feed, RSS 2.0, and custom export builder with field selection for B2B partners.
- **CF Pages Functions** — GitHub, Cloudflare, and SEO proxy endpoints (dormant until CF Pages migration).
- **Design system** — White/slate/gold palette matching Upside Journal brand. Playfair Display + Inter + JetBrains Mono fonts. Responsive layout.

### Technical
- Hybrid API layer: direct GitHub API calls for reads (public repo CORS), CF Functions fallback for writes.
- 18 files committed to `main` branch, auto-deployed via GitHub Pages.
- Cache-busting `?v=2` on all script tags.

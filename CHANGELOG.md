# Changelog — Upside Journal Mission Control

All notable changes to the admin portal at `theupsidejournal.com/admin/` are documented here.

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

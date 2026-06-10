/* ═══════════════════════════════════════════════════
   MISSION CONTROL — Configuration  (v4 — Session 3)
   Client-side config. Auth now uses email + password.
   ═══════════════════════════════════════════════════ */

const CONFIG = {
    // Auth — email + password system
    auth: {
        sessionKey: 'mc_auth_session',
        // Pre-approved admin accounts (fallback if users.json not yet in repo)
        defaultUsers: [
            {
                email: 'askinfocnc@gmail.com',
                name: 'Admin (CNC)',
                passwordHash: '227a3ab58128d3a55cbccf92a3aee174f48d48394857298bfe97fbbe11472749',
                role: 'admin',
                status: 'approved',
                createdAt: '2026-06-10T00:00:00Z',
            },
            {
                email: 'read@theupsidejournal.com',
                name: 'Admin (UJ)',
                passwordHash: '227a3ab58128d3a55cbccf92a3aee174f48d48394857298bfe97fbbe11472749',
                role: 'admin',
                status: 'approved',
                createdAt: '2026-06-10T00:00:00Z',
            },
            {
                email: 'sendpicsmfb@gmail.com',
                name: 'Admin (MFB)',
                passwordHash: '227a3ab58128d3a55cbccf92a3aee174f48d48394857298bfe97fbbe11472749',
                role: 'admin',
                status: 'approved',
                createdAt: '2026-06-10T00:00:00Z',
            },
        ],
    },

    // GitHub
    github: {
        owner: 'upside-journal',
        repo: 'theupsidejournal.com',
        branch: 'main',
        articlesDir: 'articles',
        imagesDir: 'images',
        defaultToken: null,  // Set via API Vault in Ops Center
    },

    // Google Analytics
    ga4: {
        propertyId: '395631476',
        measurementId: 'G-M09QN8XXZ5',
    },

    // AdSense
    adsense: {
        publisherId: 'pub-5980085884006955',
    },

    // Buffer org IDs
    buffer: {
        orgs: {
            socialA: '6a204f0472772154c8dff558',
            socialB: '6a23463c718b53dcaa08024b',
        }
    },

    // Cron schedule
    cron: {
        publishTime: '07:00',
        timezone: 'Europe/London',
        cadence: [
            { day: 'Monday',    theme: 'Man Champion Monday' },
            { day: 'Tuesday',   theme: 'Tech Tuesday' },
            { day: 'Wednesday', theme: 'Woman Crush Wednesday' },
            { day: 'Thursday',  theme: 'Throwback Thursday' },
            { day: 'Friday',    theme: 'Feature Friday' },
            { day: 'Saturday',  theme: 'Spotlight Saturday' },
            { day: 'Sunday',    theme: 'Super Sunday' },
        ],
    },

    // Cloudflare
    cloudflare: {
        zoneId: '2b8805ea14c607732041deacdf0c61a2',
    },

    // API proxy prefix (CF Pages Functions)
    apiBase: '/api',

    // Site
    siteUrl: 'https://theupsidejournal.com',
};

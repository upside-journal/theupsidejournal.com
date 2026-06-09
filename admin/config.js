/* ═══════════════════════════════════════════════════
   MISSION CONTROL — Configuration
   Environment variables are injected via CF Pages
   Functions. Client-side config only.
   ═══════════════════════════════════════════════════ */

const CONFIG = {
    // GitHub
    github: {
        owner: 'upside-journal',
        repo: 'theupsidejournal.com',
        branch: 'main',
        articlesDir: 'articles',
        imagesDir: 'images',
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
            socialA: '6a204f0472772154c8dff558',  // LinkedIn, Instagram, X
            socialB: '6a23463c718b53dcaa08024b',  // TikTok, Facebook, YouTube
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

    // API proxy prefix (CF Pages Functions)
    apiBase: '/api',

    // Site
    siteUrl: 'https://theupsidejournal.com',
};

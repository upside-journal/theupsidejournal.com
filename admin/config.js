/* ═══════════════════════════════════════════════════
   MISSION CONTROL — Configuration  (v8 — Session 6)
   Client-side config. Auth now uses email + password.
   API keys → Token Vault (localStorage), not here.
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
        propertyId: '539910386',
        measurementId: 'G-SGW838P3YX',
    },

    // AdSense
    adsense: {
        publisherId: 'pub-5980085884006955',
    },

    // Buffer org IDs + channel mappings
    buffer: {
        orgs: {
            socialA: '6a204f0472772154c8dff558',
            socialB: '6a23463c718b53dcaa08024b',
        },
        channels: {
            linkedin:  { id: '6a20500bc687a22dd4580b6a', org: 'A', type: 'text' },
            instagram: { id: '6a232952c687a22dd46548ac', org: 'A', type: 'video' },
            twitter:   { id: '6a23299bc687a22dd465499a', org: 'A', type: 'text' },
            tiktok:    { id: '6a23492cc687a22dd465ec5f', org: 'B', type: 'video' },
            facebook:  { id: '6a234c5ac687a22dd465fbc2', org: 'B', type: 'text' },
            youtube:   { id: '6a234c88c687a22dd465fc91', org: 'B', type: 'video' },
        },
    },

    // Content Manifest (Google Sheets — public read)
    manifest: {
        sheetId: '1FQ_R3Kp0f6pE6JtVbiwpvZdyAi8nmcvbMxKbw8FQcB8',
        cacheTTL: 300000, // 5 min cache
    },

    // Video templates
    video: {
        repoDir: 'videos',
        baseUrl: 'https://theupsidejournal.com/videos',
        driveFolderId: '1mMaqnM2-cKSQilS-GLccq_T7hJEiDR-m',
    },

    // Social images (article cover + incontent assets in /images/)
    images: {
        repoDir: 'images',
        baseUrl: 'https://theupsidejournal.com/images',
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

    // Brevo CRM (API key via Token Vault)
    brevo: {
        apiUrl: 'https://api.brevo.com/v3',
        lists: {
            newsletter: 4,
            brandPartners: 5,
            vip: 6,
        },
        folderId: 3,
        senderName: 'Upside Journal',
        senderEmail: 'mfbphotos1@gmail.com',
    },

    // beehiiv Newsletter (API key via Token Vault)
    beehiiv: {
        apiUrl: 'https://api.beehiiv.com/v2',
        publicationId: 'pub_735275a4-a1eb-4143-83de-a3e8ba805d0b',
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

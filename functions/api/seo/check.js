// CF Pages Function: GET /api/seo/check?url=...
// Fetches a URL and extracts metadata for SEO validation

export async function onRequestGet(context) {
    const url = new URL(context.request.url).searchParams.get('url');
    if (!url) {
        return Response.json({ error: 'url parameter required' }, { status: 400, headers: corsHeaders() });
    }

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'UpsideJournal-SEOBot/1.0' },
        });
        const html = await res.text();

        // Parse metadata server-side
        const extract = (regex) => { const m = html.match(regex); return m ? m[1] : null; };

        const title = extract(/<title>(.*?)<\/title>/is);
        const description = extract(/<meta\s+name="description"\s+content="(.*?)"/is);
        const ogTitle = extract(/<meta\s+property="og:title"\s+content="(.*?)"/is);
        const ogDesc = extract(/<meta\s+property="og:description"\s+content="(.*?)"/is);
        const ogImage = extract(/<meta\s+property="og:image"\s+content="(.*?)"/is);
        const ogUrl = extract(/<meta\s+property="og:url"\s+content="(.*?)"/is);
        const twCard = extract(/<meta\s+name="twitter:card"\s+content="(.*?)"/is);
        const canonical = extract(/<link\s+rel="canonical"\s+href="(.*?)"/is);

        // JSON-LD
        const jsonLdBlocks = [];
        const ldRegex = /<script\s+type="application\/ld\+json">(.*?)<\/script>/gis;
        let match;
        while ((match = ldRegex.exec(html)) !== null) {
            try { jsonLdBlocks.push(JSON.parse(match[1])); } catch {}
        }

        // H1 count
        const h1s = (html.match(/<h1[\s>]/gi) || []).length;

        // Build checks
        const checks = [];
        let score = 0;
        const total = 10;

        const check = (label, value, req, detail) => {
            const pass = typeof req === 'function' ? req(value) : !!value;
            checks.push({ label, status: pass ? 'pass' : (value ? 'warn' : 'fail'), detail: detail || value || 'Missing' });
            if (pass) score++;
        };

        check('Page Title', title, v => v && v.length > 10, title ? `"${title}" (${title.length} chars)` : 'Missing');
        check('Meta Description', description, v => v && v.length > 50, description ? `${description.length} chars` : 'Missing');
        check('Open Graph: Title', ogTitle, Boolean, ogTitle || 'Missing');
        check('Open Graph: Description', ogDesc, Boolean, ogDesc ? ogDesc.substring(0, 80) : 'Missing');
        check('Open Graph: Image', ogImage, Boolean, ogImage || 'Missing');
        check('Open Graph: URL', ogUrl, Boolean, ogUrl || 'Missing');
        check('Twitter Card', twCard, Boolean, twCard ? `Type: ${twCard}` : 'Missing');
        check('Canonical URL', canonical, Boolean, canonical || 'Missing');
        check('JSON-LD', jsonLdBlocks.length > 0, Boolean, jsonLdBlocks.length > 0 ? `${jsonLdBlocks.length} block(s)` : 'None found');
        check('H1 Heading', h1s, v => v === 1, `${h1s} H1 tag(s)`);

        return Response.json({
            url, score, total, checks, jsonLd: jsonLdBlocks,
            title, description,
        }, { headers: corsHeaders() });

    } catch (e) {
        return Response.json({ error: e.message }, { status: 500, headers: corsHeaders() });
    }
}

function corsHeaders() {
    return { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
}

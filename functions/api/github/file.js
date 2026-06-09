// CF Pages Function: GET /api/github/file?path=...&ref=main
// Fetches a single file from the repo

export async function onRequestGet(context) {
    const token = context.env.GITHUB_TOKEN;
    const url = new URL(context.request.url);
    const path = url.searchParams.get('path');
    const ref = url.searchParams.get('ref') || 'main';

    if (!token) {
        return Response.json({ error: 'GITHUB_TOKEN not configured' }, { status: 500, headers: corsHeaders() });
    }
    if (!path) {
        return Response.json({ error: 'path parameter required' }, { status: 400, headers: corsHeaders() });
    }

    try {
        const res = await fetch(
            `https://api.github.com/repos/upside-journal/theupsidejournal.com/contents/${path}?ref=${ref}`,
            {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'UpsideJournal-MissionControl',
                },
            }
        );
        const data = await res.json();
        return Response.json(data, { headers: corsHeaders() });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500, headers: corsHeaders() });
    }
}

function corsHeaders() {
    return { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
}

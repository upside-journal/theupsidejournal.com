// CF Pages Function: GET /api/github/articles
// Lists articles from the GitHub repo

export async function onRequestGet(context) {
    const token = context.env.GITHUB_TOKEN;
    const owner = 'upside-journal';
    const repo = 'theupsidejournal.com';

    if (!token) {
        return new Response(JSON.stringify({ error: 'GITHUB_TOKEN not configured' }), {
            status: 500,
            headers: corsHeaders(),
        });
    }

    try {
        const res = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/articles`,
            {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'UpsideJournal-MissionControl',
                },
            }
        );

        const data = await res.json();
        return new Response(JSON.stringify(data), {
            headers: corsHeaders(),
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: corsHeaders(),
        });
    }
}

function corsHeaders() {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    };
}

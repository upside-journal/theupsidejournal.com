// CF Pages Function: POST /api/github/commit
// Commits a file to the repo (create or update)
// Body: { path, content (base64), message }

export async function onRequestPost(context) {
    const token = context.env.GITHUB_TOKEN;
    if (!token) {
        return Response.json({ error: 'GITHUB_TOKEN not configured' }, { status: 500, headers: corsHeaders() });
    }

    const body = await context.request.json();
    const { path, content, message } = body;

    if (!path || !content) {
        return Response.json({ error: 'path and content required' }, { status: 400, headers: corsHeaders() });
    }

    const owner = 'upside-journal';
    const repo = 'theupsidejournal.com';

    try {
        // First get the current file SHA (needed for updates)
        let sha = null;
        const existing = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'UpsideJournal-MissionControl',
                },
            }
        );
        if (existing.ok) {
            const data = await existing.json();
            sha = data.sha;
        }

        // Commit
        const commitBody = {
            message: message || `Update ${path}`,
            content: content,
            branch: 'main',
        };
        if (sha) commitBody.sha = sha;

        const res = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'UpsideJournal-MissionControl',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(commitBody),
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

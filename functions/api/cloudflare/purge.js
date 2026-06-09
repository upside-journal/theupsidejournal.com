// CF Pages Function: POST /api/cloudflare/purge
// Purges Cloudflare edge cache
// Body: { urls: [] } — empty for purge_everything

export async function onRequestPost(context) {
    const apiToken = context.env.CF_API_TOKEN;
    const zoneId = context.env.CF_ZONE_ID;

    if (!apiToken || !zoneId) {
        return Response.json(
            { error: 'CF_API_TOKEN and CF_ZONE_ID environment variables required' },
            { status: 500, headers: corsHeaders() }
        );
    }

    try {
        const body = await context.request.json().catch(() => ({}));
        const urls = body.urls || [];

        const purgeBody = urls.length > 0
            ? { files: urls }
            : { purge_everything: true };

        const res = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(purgeBody),
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

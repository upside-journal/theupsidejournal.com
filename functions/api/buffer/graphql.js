// CF Pages Function: POST /api/buffer/graphql
// Proxies GraphQL requests to Buffer's API to bypass CORS.
// Client sends { token, query, variables } in the body.

function cors(headers = {}) {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        ...headers,
    };
}

export async function onRequestOptions() {
    return new Response(null, { status: 204, headers: cors() });
}

export async function onRequestPost(context) {
    try {
        const body = await context.request.json();
        const { token, query, variables } = body;

        if (!token || !query) {
            return Response.json(
                { error: 'Missing token or query' },
                { status: 400, headers: cors() }
            );
        }

        const res = await fetch('https://api.buffer.com/graphql', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables: variables || {} }),
        });

        const data = await res.json();
        return Response.json(data, { status: res.status, headers: cors() });
    } catch (e) {
        return Response.json(
            { error: e.message || 'Buffer proxy error' },
            { status: 500, headers: cors() }
        );
    }
}

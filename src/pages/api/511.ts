import type { APIRoute } from 'astro'

export const prerender = false

const apiKey = '7a7f827d-6d7d-451e-a9a6-bcc517c951b9'

async function make511Request(
    moduleName: string,
    params: string[][] = []
) {
    console.log(`[511 API] Starting ${moduleName} request`)

    let paramString = ''
    if (Array.isArray(params) && params.length > 0) {
        paramString = '&' + params.map((p: string[]) => p.join('=')).join('&')
    }

    const url = `https://api.511.org/transit/${moduleName}?api_key=${apiKey}${paramString}`
    console.log('[511 API] Fetching URL:', url.replace(apiKey, 'KEY_REDACTED'))

    const response = await fetch(url)
    console.log('[511 API] Response status:', response.status, response.statusText)

    // Pass upstream rate limits through so the client can back off, keeping Retry-After when sent
    if (response.status === 429) {
        return new Response(
            JSON.stringify({ error: 'Rate limited by 511.org' }),
            {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    ...(response.headers.has('Retry-After') ? { 'Retry-After': response.headers.get('Retry-After')! } : {})
                }
            }
        )
    }

    if (!response.ok) {
        console.error('[511 API] Error response body:', await response.text())
        throw new Error(`Upstream status ${response.status}`)
    }

    let data = await response.json()

    // Handle double-encoded JSON
    if (typeof data === 'string') {
        if (
            (data.startsWith('{') && data.endsWith('}')) ||
            (data.startsWith('[') && data.endsWith(']'))
        ) {
            data = JSON.parse(data)
        }
    }

    return data
}

export const GET: APIRoute = async ({ url, request }) => {
    console.log('[511 API Route] Received request:', url.toString())
    console.log('[511 API Route] Request URL:', request.url)
    console.log('[511 API Route] SearchParams keys:', Array.from(url.searchParams.keys()))

    const moduleName = url.searchParams.get('module')
    const paramsString = url.searchParams.get('params')

    if (!moduleName || moduleName.length > 64) {
        console.error('[511 API Route] Missing or oversized module parameter')
        return new Response(
            JSON.stringify({ error: 'Invalid module parameter' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }

    let params: string[][] | null = []
    if (paramsString) {
        try {
            params = paramsString.length <= 1000 ? JSON.parse(paramsString) : null
        } catch {
            params = null
        }
        if (
            !Array.isArray(params) || params.length > 10 ||
            !params.every(p => Array.isArray(p) && p.length === 2 && p.every(v => typeof v === 'string' && v.length <= 100))
        ) {
            console.error('[511 API Route] Invalid params format:', paramsString.slice(0, 200))
            return new Response(
                JSON.stringify({ error: 'Invalid params format' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
        }
    }

    try {
        const data = await make511Request(moduleName, params ?? [])
        if (data instanceof Response) return data
        return new Response(
            JSON.stringify(data),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            }
        )
    } catch (err) {
        console.error('[511 API Route] Request failed, returning error:', err instanceof Error ? err.message : String(err))
        return new Response(
            JSON.stringify({ error: 'Upstream request failed' }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
        )
    }
}

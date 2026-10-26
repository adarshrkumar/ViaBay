import type { APIRoute } from 'astro'

export const prerender = false

const apiKey = '7a7f827d-6d7d-451e-a9a6-bcc517c951b9'

const modules: Record<string, { params: string[], maxAge: number }> = {
    gtfsoperators: { params: [], maxAge: 3600 },
    VehicleMonitoring: { params: ['agency'], maxAge: 15 },
    patterns: { params: ['operator_id', 'line_id'], maxAge: 3600 },
    lines: { params: ['operator_id'], maxAge: 3600 },
}

const rateLimitWindowMs = 60_000
const rateLimitMax = 120
const requestCounts = new Map<string, { count: number, resetAt: number }>()

async function make511Request(
    moduleName: string,
    params: string[][] = []
) {
    console.log(`[511 API] Starting ${moduleName} request`)

    const url = `https://api.511.org/transit/${moduleName}?api_key=${apiKey}${params.map(([name, value]) => `&${encodeURIComponent(name)}=${encodeURIComponent(value)}`).join('')}`
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

export const GET: APIRoute = async ({ url, request, clientAddress }) => {
    console.log('[511 API Route] Received request:', url.toString())
    console.log('[511 API Route] Request URL:', request.url)
    console.log('[511 API Route] SearchParams keys:', Array.from(url.searchParams.keys()))

    if (requestCounts.size > 10_000) {
        requestCounts.forEach((entry, ip) => {
            if (entry.resetAt <= Date.now()) requestCounts.delete(ip)
        })
    }
    const counter = requestCounts.get(clientAddress)
    if (!counter || counter.resetAt <= Date.now()) requestCounts.set(clientAddress, { count: 1, resetAt: Date.now() + rateLimitWindowMs })
    else if (++counter.count > rateLimitMax) {
        return new Response(
            JSON.stringify({ error: 'Too many requests' }),
            {
                status: 429,
                headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil((counter.resetAt - Date.now()) / 1000)) }
            }
        )
    }

    const moduleName = url.searchParams.get('module')
    const paramsString = url.searchParams.get('params')

    if (!moduleName || !Object.hasOwn(modules, moduleName)) {
        console.error('[511 API Route] Missing or unsupported module:', moduleName?.slice(0, 64))
        return new Response(
            JSON.stringify({ error: 'Unsupported module' }),
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
            !params.every(p => Array.isArray(p) && p.length === 2 && modules[moduleName].params.includes(p[0]) && typeof p[1] === 'string' && p[1].length <= 100)
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
                    'Cache-Control': `public, max-age=0, s-maxage=${modules[moduleName].maxAge}, stale-while-revalidate=${modules[moduleName].maxAge}`
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

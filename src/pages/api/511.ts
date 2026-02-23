import type { APIRoute } from 'astro'

export const prerender = false

const apiKey = '7a7f827d-6d7d-451e-a9a6-bcc517c951b9'

async function make511Request(
    moduleName: string,
    params: string[][] = []
): Promise<any> {
    console.log(`[511 API] Starting ${moduleName} request`)

    let paramString = ''
    if (Array.isArray(params) && params.length > 0) {
        paramString = '&' + params.map((p: string[]) => p.join('=')).join('&')
    }

    const url = `https://api.511.org/transit/${moduleName}?api_key=${apiKey}${paramString}`
    console.log('[511 API] Fetching URL:', url.replace(apiKey, 'KEY_REDACTED'))

    const response = await fetch(url)
    console.log('[511 API] Response status:', response.status, response.statusText)

    if (!response.ok) {
        const errorText = await response.text()
        console.error('[511 API] Error response body:', errorText)
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText.substring(0, 200)}`)
    }

    let data = await response.json()
    console.log('[511 API] Response data type:', typeof data, Array.isArray(data) ? 'array' : 'object')

    // Handle double-encoded JSON
    if (typeof data === 'string') {
        console.log('[511 API] Double-encoded JSON detected, parsing...')
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

    console.log(`[511 API Route] Parsed ${moduleName} params`)

    if (!moduleName) {
        console.error('[511 API Route] Missing module parameter')
        return new Response(
            JSON.stringify({ error: 'Missing module parameter' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }

    let params: string[][] = []
    if (paramsString) {
        try {
            params = JSON.parse(paramsString)
            console.log(`[511 API Route] Parsed params array`)
        } catch (err) {
            console.error('[511 API Route] Invalid params format:', paramsString)
            return new Response(
                JSON.stringify({ error: 'Invalid params format' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
        }
    }

    try {
        const data = await make511Request(moduleName, params)
        console.log('[511 API Route] Returning success response')
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
        console.error('[511 API Route] Request failed, returning error:', (err as Error).message)
        return new Response(
            JSON.stringify({ error: (err as Error).message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
}

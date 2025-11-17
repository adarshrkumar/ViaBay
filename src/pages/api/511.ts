import type { APIRoute } from 'astro'

export const prerender = false

const apiKeys: string[] = [
    '7a7f827d-6d7d-451e-a9a6-bcc517c951b9',
    '6e4e4158-72bd-424d-85a3-2678e0a9854e',
    '1eb78f53-b000-42ea-8ff6-9bedb66e01cc',
    '1bd488ee-e387-49a9-af4f-6a15d1636bff',
    'fac23cdd-333b-41fc-b6d2-fc3628fbfb1d',
    'b9269045-ce6b-48e3-9ef2-bdb1332499ad',
    '26c601e1-1221-4690-9b03-1d597f5ccc96',
    'f5f72bd0-7553-4b01-888c-0d55e988a1c3', 
    '20f77a03-c3af-41f3-9931-c117b8bbe8b3',
]

interface KeyUsage {
    usage: number
    key: string
}

// Track API key usage in memory
const keyUsage: KeyUsage[] = apiKeys.map((key: string) => ({ usage: 0, key }))

async function make511Request(
    moduleName: string,
    params: string[][] = [],
    keyIndex: number = 0
): Promise<any> {
    console.log(`[511 API] Starting ${moduleName} request`)

    if (keyIndex >= apiKeys.length) {
        console.error('[511 API] All API keys exhausted')
        throw new Error('All API keys exhausted')
    }

    let paramString = ''
    if (Array.isArray(params) && params.length > 0) {
        paramString = '&' + params.map((p: string[]) => p.join('=')).join('&')
    }

    const url = `https://api.511.org/transit/${moduleName}?api_key=${keyUsage[keyIndex].key}${paramString}`
    console.log('[511 API] Fetching URL:', url.replace(keyUsage[keyIndex].key, 'KEY_REDACTED'))

    try {
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

        keyUsage[keyIndex].usage++
        console.log('[511 API] Success! Key usage:', keyUsage[keyIndex].usage)
        return data
    } catch (err: any) {
        console.error('[511 API] Request failed:', err.message)
        keyUsage[keyIndex].usage++

        // Try next key if available and current key hasn't been used too much
        if (keyUsage[keyIndex].usage < 100 && keyIndex < apiKeys.length - 1) {
            console.log('[511 API] Trying next API key...')
            return await make511Request(moduleName, params, keyIndex + 1)
        }

        throw err
    }
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
    } catch (err: any) {
        console.error('[511 API Route] Request failed, returning error:', err.message)
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
}

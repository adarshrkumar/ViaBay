import type { APIRoute } from 'astro'

const apiKeys: string[] = [
    '7a7f827d-6d7d-451e-a9a6-bcc517c951b9',
    '6e4e4158-72bd-424d-85a3-2678e0a9854e',
    '1eb78f53-b000-42ea-8ff6-9bedb66e01cc',
    '1bd488ee-e387-49a9-af4f-6a15d1636bff',
    'fac23cdd-333b-41fc-b6d2-fc3628fbfb1d',
    'b9269045-ce6b-48e3-9ef2-bdb1332499ad',
    '26c601e1-1221-4690-9b03-1d597f5ccc96',
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
    if (keyIndex >= apiKeys.length) {
        throw new Error('All API keys exhausted')
    }

    let paramString = ''
    if (Array.isArray(params) && params.length > 0) {
        paramString = '&' + params.map((p: string[]) => p.join('=')).join('&')
    }

    const url = `https://api.511.org/transit/${moduleName}?api_key=${keyUsage[keyIndex].key}${paramString}`

    try {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
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

        keyUsage[keyIndex].usage++
        return data
    } catch (err) {
        keyUsage[keyIndex].usage++

        // Try next key if available and current key hasn't been used too much
        if (keyUsage[keyIndex].usage < 100 && keyIndex < apiKeys.length - 1) {
            return await make511Request(moduleName, params, keyIndex + 1)
        }

        throw err
    }
}

export const GET: APIRoute = async ({ url }) => {
    const moduleName = url.searchParams.get('module')
    const paramsString = url.searchParams.get('params')

    if (!moduleName) {
        return new Response(
            JSON.stringify({ error: 'Missing module parameter' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }

    let params: string[][] = []
    if (paramsString) {
        try {
            params = JSON.parse(paramsString)
        } catch (err) {
            return new Response(
                JSON.stringify({ error: 'Invalid params format' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
        }
    }

    try {
        const data = await make511Request(moduleName, params)
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
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
}

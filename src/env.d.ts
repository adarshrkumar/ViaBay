/// <reference types="astro/client" />

interface Window {
    makeRequest: (moduleName: string, params?: string[][], callback?: (data: unknown) => void) => Promise<void>
    checkAuthentication: (u: string, p: string) => boolean
    setCredentials: (username: string, password: string, dest: string) => void
    setCookie: (cname: string, cvalue: string, exdays: number) => void
    getCookie: (cname: string) => string
    assertError: (err: unknown, name: string) => void
    goToPage: (name: string) => void
    showModal: (title: string, content: string) => void
    addNotification: (module: string, name: string, icon: string, content: string, attatchmentInfo: unknown) => void
    getNotifications: (module?: unknown, title?: unknown, description?: unknown, content?: unknown, attatchmentInfo?: unknown) => void
    openSelection: (e: HTMLElement) => void
    closeSelection: (e: HTMLElement) => void
    showRoutePath: (aId: unknown, rId: unknown) => void
    findUsingValueofKey: (arr: Record<string, unknown>[], key: string, val: unknown) => Record<string, unknown>[]
    positionInterval: ReturnType<typeof setInterval> | null
    allPins: unknown[]
    directionsElement: Element | null
    directionsManager: boolean
}
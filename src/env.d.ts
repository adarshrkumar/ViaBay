/// <reference types="astro/client" />

interface Window {
    makeRequest: <T>(moduleName: string, params?: string[][], callback?: (data: T) => void) => Promise<void>
    checkAuthentication: (u: string, p: string) => boolean
    setCredentials: (username: string, password: string, dest: string) => void
    setCookie: (cname: string, cvalue: string, exdays: number) => void
    getCookie: (cname: string) => string
    assertError: (err: Error | string, name: string) => void
    goToPage: (name: string) => void
    showModal: (title: string, content: string) => void
    addNotification: (module: string, name: string, icon: string, content: string, attatchmentInfo: string) => void
    getNotifications: (module?: string, title?: string, description?: string, content?: string, attatchmentInfo?: string) => void
    openSelection: (e: HTMLElement) => void
    closeSelection: (e: HTMLElement) => void
    showRoutePath: (aId: string, rId: string) => void
    findUsingValueofKey: (arr: Record<string, string>[], key: string, val: string) => Record<string, string>[]
    positionInterval: ReturnType<typeof setInterval> | null
    allPins: L.Marker[]
    directionsElement: Element | null
    directionsManager: boolean
    login: () => void
    onMapLoad: ((map: L.Map) => void) | null
}
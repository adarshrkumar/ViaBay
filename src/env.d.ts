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
    addNotification: (module: string, name: string, icon: string, content: string, attachmentInfo?: string) => void
    getNotificationKeys: () => string[]
    getNotifications: () => void
    openSelection: (e: HTMLElement) => void
    closeSelection: (e: HTMLElement) => void
    showRoutePath: (aId: string, rId: string) => void
    positionInterval: ReturnType<typeof setInterval> | null
    directionsElement: Element | null
    directionsManager: boolean
    login: () => void
    onMapLoad: ((map: L.Map) => void) | null
}
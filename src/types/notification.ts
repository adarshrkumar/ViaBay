// Shape of a notification stored under NOTIFICATIONS://{module}|{name}, shared by the producer and the notifications page
export interface StoredNotification {
    module: string
    name: string
    icon: string
    content: string
    attachmentInfo?: string
}

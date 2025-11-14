var nGroup = document.querySelector('.notifications')


function getNotifications(module, title, description, content, attatchmentInfo) {
    var notificationList = localStorage.getItem('notifications')
    if (!!notificationList === false) notificationList = []
    notificationList = JSON.parse(notificationList)

    notificationList.forEach(function(name, i) {
        var notification = localStorage.getItem(`NOTIFICATIONS://${name}`)
        addNotification(notificationList[name])
        notificationList.shift()
        localStorage.removeItem(`NOTIFICATIONS://${name}`)
    })

    notificationList = JSON.stringify(notificationList)
    localStorage.setItem('notifications', notificationList)
}

function addNotification(notification) {
    var nIcon = notification.icon
    var nTitle = notification.title
    var nContent = notification.content

    var nEle = document.createElement('item')

    var nEleIcon = document.createElement('img')
    nEleIcon.classList.add('icon')
    nEleIcon.src = `/icons/${nIcon}.svg`
    nEle.appendChild(nEleIcon)
    
    var nEleContent = document.createElement('item-content')
    nEleContent.textContent = nTitle
    nEle.appendChild(nEleContent)
    
    nGroup.appendChild(nEle)

    nEle.onclick = function(e) {
        if (!!nContent) {
            showModal(nTitle, nContent)
        }
    }
}


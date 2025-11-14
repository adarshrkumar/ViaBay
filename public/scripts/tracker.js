var map, infobox, watchId, Microsoft, positionInterval = null
var BingMapsKey = 'AkMdzF1Q7JCJCXj3415UZvH4JYRCJihZ_W7JEOnpx6eH5Hwtt1qie1LQqIrJ7-jS'

var agencyIds = []
var agencies = {}
var allPins = []
// var lines = []
// var patterns = []

var colors = ['#0000FF','#FFA500','#6A4A3A','#800080','#800000','#40E0D0','#FF00FF','#000035','#FF6347','#FA8072','#808000','#7F00FF','#73BF00','#CD7F32','#8A2BE2','#3CB371','#2E8B57','#D2691E','#4682B4','#FF4500','#8B008B','#556B2F', '#8B4513', '#00CED1', '#483D8B', '#8B0000', '#9932CC', '#556B2F', '#2E8B57', '#6B8E23', '#9932CC', '#FF6347', '#20B2AA']
var customColors = {
    SF: {
        E: 'beige', 
        F: 'pink', 
        J: 'orange', 
        K: 'lightblue', 
        L: 'purple', 
        M: 'green', 
        N: 'blue', 
        S: 'yellow', 
        T: 'red', 
        C: 'brown', 
        CA: 'brown', 
        PM: 'brown', 
        PH: 'brown', 
    }
}

var directionsElement = document.querySelector('#hiddenDirections')
var directionsManager = false


function onMapLoad() {
    makeRequest('gtfsoperators', [], function(res) {
        res.forEach(function(agency, i) {
            var cI = i
            if (cI >= colors.length) cI = cI - colors.length
            var color = colors[cI]

            agencyIds.push(agency)

            makeRequest('VehicleMonitoring', [['agency', agency.Id]], function(vehicleData, i2) {
                var vehicleData = vehicleData.Siri.ServiceDelivery.VehicleMonitoringDelivery.VehicleActivity
                if (!vehicleData || typeof vehicleData !== 'object') vehicleData = []
                
                var aName = agency.Name
                switch (aName) {
                    case 'VTA': aName = 'Valley Transportation Authority (VTA)'
                    case 'AC TRANSIT': aName = 'AC Transit'
                }

                var aObj = agencies[agency.Id]
                if (!aObj) {
                    aObj = {
                        id: agency.Id, 
                        name: aName, 
                        vehicles: {
                            data: vehicleData, 
                            pins: {}, 
                        }, 
                    }
                }
                else {
                    aObj.vehicles.data = vehicleData
                }
                
                var goodPins = []
                
                vehicleData.forEach(function(vehicle) {
                    var vehicleRef = vehicle.MonitoredVehicleJourney.VehicleRef
                    if (aObj.vehicles.pins[vehicleRef]) {
                        goodPins.push({
                            name: vehicleRef, 
                            content: aObj.vehicles.pins[vehicleRef]
                        })
                    }
                })
                aObj.vehicles.pins = {}
                goodPins.forEach(function(pin) {
                    aObj.vehicles.pins[pin.name] = pin.content
                })
                
                vehicleData.forEach(function(vehicle, vI) {
                    var vehicleActivity = vehicle.MonitoredVehicleJourney
                    vehicleActivity.agency = aName
                    vehicleActivity.aId = agency.Id
                    vehicleActivity.i = vI
                    var vehicleRef = vehicleActivity.VehicleRef
                    var vehicleLocation = vehicleActivity.VehicleLocation
                    vehicleLocation = {
                        longitude: vehicleLocation.Longitude, 
                        latitude: vehicleLocation.Latitude, 
                        // altitude: 0, 
                        // altitudeReference: -1,
                    }
                    
                    switch (vehicleActivity.OperatorRef) {
                        case 'SF': 
                            var publishedLineName = vehicleActivity.PublishedLineName
                            if (publishedLineName) {
                                if (publishedLineName.includes(' ')) publishedLineName = publishedLineName.split(' ')
                                else publishedLineName = [publishedLineName]
                            
                                publishedLineName.forEach(function(p, i) {
                                    publishedLineName[i] = `${p[0]}${p.substring(1).toLowerCase()}`
                                })
                                
                                publishedLineName = publishedLineName.join(' ')
                                vehicleActivity.PublishedLineName = publishedLineName
                            }
                    }

                    var route = vehicleActivity.LineRef
                    if (route) {

                        var width = 30
                        if (route.length > 3) {
                            var exces = route.length-3
                            for (let i3 = 0; i3 < exces; i3++) {
                                width += 5
                            }
                        }
                        
                        if (color.toString().startsWith('#') && Microsoft.Maps.Color) {
                            if (Microsoft.Maps.Color.fromHex) color = Microsoft.Maps.Color.fromHex(color)
                            else color = 'red'
                        }
                        // Add the pushpin to the map
                        var pin = aObj.vehicles.pins[vehicleRef]
                        if (pin) {
                            pin.setLocation(vehicleLocation);
                        }
                        else {
                            vehicleActivity.infoboxOpen = false
                            pin = new Microsoft.Maps.Pushpin(vehicleLocation, {
                                text: route,
                                color: color, 
                                // icon: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20"><rect x="0" y="0" width="100%" height="100%" fill="${color}" /><text x="50%" y="50%" dy="2" textLength="${width-5}" lengthAdjust="spacing" font-family="sans-serif" dominant-baseline="middle" text-anchor="middle">${route}</text></svg>`,
                            });
                            pin.metadata = vehicleActivity;
                            
                            var events = ['click']
                            events.forEach(function(ev) {
                                Microsoft.Maps.Events.addHandler(pin, ev, showVehicleInfo);
                            })
                            
                            map.entities.push(pin);
                        }
                        aObj.vehicles.pins[vehicleRef] = pin
                    }
                })

                agencies[agency.Id] = aObj
            })

            // makeRequest('lines', [['operator_id', agency.Id]], function(lS) {
            //     lines[agency.Id] = lS
            //     patterns[agency.Id] = {}
            //     lS.forEach(function(line, lI) {
            //         makeRequest('patterns', [['operator_id', agency.Id], ['line_id', line.Id]], function(pattern) {
            //             patterns[agency.Id][line.Id] = pattern
            //         })
            //     })
            // })
        })
    })
}

GetMap()
function GetMap() {
    if (document.getElementById('myMap') && Microsoft) {
        map = new Microsoft.Maps.Map('#myMap');
        infobox = new Microsoft.Maps.Infobox(map.getCenter(), {
            visible: false,
            showCloseButton: true
        });

        //Assign the infobox to a map instance.
        infobox.setMap(map);

        // Close infobox when clicking on the map
        Microsoft.Maps.Events.addHandler(map, 'click', function(e) {
            if (infobox) {
                infobox.setOptions({ visible: false });
            }
        });

        if (onMapLoad) onMapLoad()
        positionInterval = setInterval(onMapLoad, 60000)
    }
    else {
        window.addEventListener('DOMContentLoaded', GetMap)
    }
}


function showVehicleInfo(e) {
    //Make sure the infobox has metadata to display.
    var data = e.target.metadata
    if (data) {
        // agencyIds.forEach(function(id, i) {
        //     if (agencies[id]) {
        //         agencies[id].vehicles.pins.forEach(function(p, pI) {
        //             agencies[id].vehicles.pins[pI].metadata.infoboxOpen = false
        //         })
        //     }
        // })
        
        // Set the infobox options with the metadata of the pushpin.
        var isSmallScreen = window.matchMedia('(max-width: 915px)').matches
        if (isSmallScreen) {
            
        }
        
        // agencies[data.aId].vehicles.pins[data.i].metadata.infoboxOpen = true

        // console.log(data)

        makeRequest('patterns', [['operator_id', data.aId], ['line_id', data.LineRef]], function(res) {
            var journeyPatterns = res.journeyPatterns
            var pattern = journeyPatterns.filter(p => p.DirectionRef === data.DirectionRef)
            if (Array.isArray(pattern) || typeof pattern === 'object') {
                if (pattern.length > 0) {
                    pattern = pattern[0]
                }
            }
            else pattern = []

            var PointsInSequence = pattern.PointsInSequence
            var TimingPointInJourneyPattern = PointsInSequence.TimingPointInJourneyPattern
            var stopNames = []
            TimingPointInJourneyPattern.forEach(t => {
                stopNames.push(t.Name)
            })

            var hasMCall = data.MonitoredCall ? true : false
            var hasCalls = data.OnwardCalls ? (data.OnwardCalls.OnwardCall ? (data.OnwardCalls.OnwardCall.length > 0 ? true : false) : false) : false
    
            var stops = []
    
            if (hasMCall) {
                stops.push(data.MonitoredCall)
            }
            if (hasCalls) {
                data.OnwardCalls.OnwardCall.forEach(function(stop, sI) {
                    stops.push(stop)
                })
            }

            stops.forEach(stop => {
                var items = TimingPointInJourneyPattern.filter(t => t.Name === stop.StopPointName)
                if (items) {
                    if (items.length > 0) {
                        if (items.length > 1) {
                            items.forEach(i => {
                                TimingPointInJourneyPattern.splice(TimingPointInJourneyPattern.indexOf(i), 1)
                            })
                        }
                        else {
                            TimingPointInJourneyPattern.splice(TimingPointInJourneyPattern.indexOf(items[0]), 1)
                        }
                    }
                }
            })
            console.log(TimingPointInJourneyPattern)

            var liS = []
            stops.forEach(function(stop, sI) {
                callActions(stop)
            })

            function callActions(stop) {
                var eDate = new Date(stop.ExpectedArrivalTime)
                var aDate = new Date(stop.AimedArrivalTime)
                var eTime = eDate.getHours()*60*60+eDate.getMinutes()*60+eDate.getSeconds()
                var aTime = aDate.getHours()*60*60+aDate.getMinutes()*60+aDate.getSeconds()
                
                var stopTime = `${eDate.getHours()}:${eDate.getMinutes().toString().length < 2 ? `0${eDate.getMinutes()}` : eDate.getMinutes()}`
                
                var isLate = eTime > aTime ? true : false
                var isEarly = eTime < aTime ? true : false
                var isOnTime = eTime === aTime ? true : false
    
                var earlyLateText = ''
                if (isLate) earlyLateText = `${Math.ceil((eTime-aTime)/60)} Minutes Late`
                if (isEarly) earlyLateText = `${Math.ceil((aTime-eTime)/60)} Minutes Early`
                if (isOnTime) earlyLateText = `On Time`
    
                var color = isLate ? 'red' : (isEarly ? 'green' : (isOnTime ? 'blue' : 'black'))

                var li = document.createElement('li')
                li.classList.add('stop')
                li.style.color = color
                li.textContent = `${stop.StopPointName} (${stop.StopPointRef}): ${stopTime} (${earlyLateText})`

                liS.push(li)
            }
    
        })

        data.LineName = data.PublishedLineName
        if (data.PublishedLineName) {
            if (data.LineName.includes('\\')) data.LineName = data.LineName.split('\\').join('/')
                if (data.LineName.includes(' / ')) data.LineName = data.LineName.split(' / ').join('/')
                if (data.LineName.includes('/')) data.LineName = data.LineName.split('/').join(' - ')
                if (data.LineName.includes('  ')) data.LineName = data.LineName.split('  ').join(' ')
            }

        var options = {
            title: [
                `${data.agency}`, 
                `${data.LineRef}: ${data.LineName}`
            ], 
            description: [
                `Direction: ${data.DirectionRef ? data.DirectionRef : 'Unknown Direction'}`,
                `Origin: ${data.OriginName ? data.OriginName : 'No Origin or Unknown'}`,
                `Destination: ${data.DestinationName ? data.DestinationName : 'No Destination or Unknown'}`,
                `Congestion: ${data.InCongestion ? 'Congested' : 'Not Congested or Unknown'}`,
                `Occupancy: ${data.Occupancy ? data.Occupancy : 'Unknown'}`,
                `Vehicle ID: ${data.VehicleRef ? data.VehicleRef : 'Unknown'}`
            ]
        }
        
        console.log(data.aId)
        // var agePatterns = patterns[data.aId]
        // if (agePatterns) {
        //     var routePatterns = agePatterns[data.LineRef]
        //     console.log(routePatterns)
        //     if (routePatterns) {
        //         var journeyPatterns = routePatterns.journeyPatterns
        //         if (journeyPatterns) {
        //             var journeyPattern = journeyPatterns
        //                 .filter(item => item['Name'] === data.PublishedLineName)
        //                 // .filter(item => item['DirectionRef'] === data.DirectionRef)
        //             console.log(journeyPattern)
        //             if (journeyPattern.PointsInSequence) {
        //                 var PointsInSequence = journeyPattern.PointsInSequence
        //                 console.log(PointsInSequence)
        //             }
        //         }
        //     }
        // }
        
        infobox.setOptions({
            location: e.target.getLocation(),
            title: options.title,
            htmlContent: `<div class="infobox">
                <button class="infobox-close-btn" onclick="if(window.infobox) window.infobox.setOptions({visible: false});">&times;</button>
                <span class="title">${options.title.join('<br>')}</span><br><span>${options.description.join('</span><br><span>')}</span><ol class="stops"></ol>
            </div>`,
            visible: true
        });
    }
}

function showRoutePath(aId, rId) {
    // Load the directions module.
    Microsoft.Maps.loadModule('Microsoft.Maps.Directions', function () {
        if (directionsManager) directionsManager.clearAll()

        // Create an instance of the directions manager.
        directionsManager = new Microsoft.Maps.Directions.DirectionsManager(map);
        
        // // Calculate a date time that is 1 hour from now.
        // Set Route Mode to transit.
        directionsManager.setRequestOptions({
            routeMode: Microsoft.Maps.Directions.RouteMode.tranit,
        });
        
        // Add waypoints.
        if (patterns[aId]) {
            if (patterns[aId][rId]) {
                patterns[aId][rId].forEach(function(s, i) {
                    var waypoint = new Microsoft.Maps.Directions.Waypoint({ address: s });
                    directionsManager.addWaypoint(waypoint);
                })
            }
        }
        
        // Set the element in which the itinerary will be rendered.
        directionsManager.setRenderOptions({ itineraryContainer: directionsElement });
        
        // Calculate directions.
        directionsManager.calculateDirections();
        console.log(directionsManager)
    });
}

function findUsingValueofKey(arr, key, val) {
    var res = arr.filter(item => item[key] === val)
    return res
}
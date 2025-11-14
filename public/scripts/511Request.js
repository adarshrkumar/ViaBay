var apiKeys = [
    '7a7f827d-6d7d-451e-a9a6-bcc517c951b9', 
    '6e4e4158-72bd-424d-85a3-2678e0a9854e', 
    '1eb78f53-b000-42ea-8ff6-9bedb66e01cc', 
    '1bd488ee-e387-49a9-af4f-6a15d1636bff', 
    'fac23cdd-333b-41fc-b6d2-fc3628fbfb1d', 
    'b9269045-ce6b-48e3-9ef2-bdb1332499ad', 
    '26c601e1-1221-4690-9b03-1d597f5ccc96', 
]
apiKeys.forEach((k, i) => apiKeys[i] = {usage: 0, key: k})

function makeRequest(moduleName, params=[], callback, i=0) {
    if (Array.isArray(params)) {
        if (params.length > 0) {
            params.forEach(function(param, i) {
                params[i] = param.join('=')
            })
            params = `&${params.join('&')}`
        }
        else {
            params = ''
        }
    }

    // console.log(i, apiKeys[i])
    var url = `https://api.511.org/transit/${moduleName}?api_key=${apiKeys[i].key}${params}`
    // console.log(url)

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (typeof data === 'string') {
                if (
                    (data.startsWith('{') && data.endsWith('}')) ||
                    (data.startsWith('[') && data.endsWith(']'))
                ) data = JSON.parse(data)
            }
            apiKeys[i].usage++
            callback(data)
        })
        .catch(err => {
            if (apiKeys[i].usage < 100 && i < apiKeys.length-1) {
                makeRequest(moduleName, params, callback, i+1)
            }
            else {
                console.error(err);
            }
            apiKeys[i].usage++
        });

}
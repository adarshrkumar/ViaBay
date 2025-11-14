var queryString = window.location.search; 
var urlParms = new URLSearchParams(queryString); 
var dest = !!urlParms.get('dest') ? urlParms.get('dest') : '/tracker';

var form = document.querySelector('[role="form"]')

// document.querySelector('.form').addEventListener('submit', function(e) {e.preventDefault()})

function login() {
    var username = form.querySelector('#email').value
    var password = form.querySelector('#password').value
    setCredentials(username, password, dest)
}
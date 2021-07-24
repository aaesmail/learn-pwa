var deferredPrompt

if (!window.Promise) {
  window.Promise = Promise
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js')
    .then(function () {
      console.log('Serice Worker Registered!')
    })
    .catch(function (err) {
      console.log(err)
    })
}

window.addEventListener('beforeinstallprompt', function (event) {
  console.log('before install prompt fired')
  event.preventDefault()
  deferredPrompt = event
  return false
})

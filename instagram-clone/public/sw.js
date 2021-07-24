importScripts('/src/js/idb.js')
importScripts('/src/js/utility.js')

var CACHE_VERSION = 21

var STATIC_CACHE_NAME = 'static-v' + CACHE_VERSION
var DYNAMIC_CACHE_NAME = 'dynamic-v' + CACHE_VERSION

var STATIC_FILES = [
  '/',
  '/index.html',
  '/offline.html',
  '/src/js/app.js',
  '/src/js/feed.js',
  '/src/js/idb.js',
  '/src/js/promise.js',
  '/src/js/fetch.js',
  '/src/js/material.min.js',
  '/src/css/app.css',
  '/src/css/feed.css',
  '/src/images/main-image.jpg',
  'https://fonts.googleapis.com/css?family=Roboto:400,700',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css',
]

// function trimCache(cacheName, maxItems) {
//   caches.open(cacheName).then(function (cache) {
//     return cache.keys().then(function (keys) {
//       if (keys.length > maxItems) {
//         cache.delete(keys[0]).then(trimCache(cacheName, maxItems))
//       }
//     })
//   })
// }

self.addEventListener('install', function (event) {
  console.log('[Service Worker] Installing Service Worker...', event)
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(function (cache) {
      console.log('[Service Worker] Precaching App Shell.')
      cache.addAll(STATIC_FILES)
    })
  )
})

self.addEventListener('activate', function (event) {
  console.log('[Service Worker] Activating Service Worker...', event)
  event.waitUntil(
    caches.keys().then(function (keyList) {
      return Promise.all(
        keyList.map(function (key) {
          if (key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key)
            return caches.delete(key)
          }
        })
      )
    })
  )
  return self.clients.claim()
})

// self.addEventListener('fetch', function (event) {
//   event.respondWith(
//     caches.match(event.request).then(function (response) {
//       return (
//         response ||
//         fetch(event.request)
//           .then(function (res) {
//             return caches.open(DYNAMIC_CACHE_NAME).then(function (cache) {
//               cache.put(event.request.url, res.clone())
//               return res
//             })
//           })
//           .catch(function (err) {
//             return caches.open(STATIC_CACHE_NAME).then(function (cache) {
//               return cache.match('/offline.html')
//             })
//           })
//       )
//     })
//   )
// })

function isInArray(string, array) {
  var cachePath
  if (string.indexOf(self.origin) === 0) {
    // request targets domain where we serve the page from (i.e. NOT a CDN)
    console.log('matched ', string)
    cachePath = string.substring(self.origin.length) // take the part of the URL AFTER the domain (e.g. after localhost:8080)
  } else {
    cachePath = string // store the full request (for CDNs)
  }
  return array.indexOf(cachePath) > -1
}

self.addEventListener('fetch', function (event) {
  var url =
    'https://pwagram-f8b66-default-rtdb.europe-west1.firebasedatabase.app/posts.json'

  if (event.request.url.indexOf(url) > -1) {
    event.respondWith(
      fetch(event.request).then(function (res) {
        var clonedRes = res.clone()

        clearAllData('posts')
          .then(function () {
            return clonedRes.json()
          })
          .then(function (data) {
            for (var key in data) writeData('posts', data[key])
          })

        return res
      })
    )
  } else if (isInArray(event.request.url, STATIC_FILES)) {
    event.respondWith(caches.match(event.request))
  } else {
    event.respondWith(
      caches.match(event.request).then(function (response) {
        return (
          response ||
          fetch(event.request)
            .then(function (res) {
              return caches.open(DYNAMIC_CACHE_NAME).then(function (cache) {
                // trimCache(DYNAMIC_CACHE_NAME, 3)
                cache.put(event.request.url, res.clone())
                return res
              })
            })
            .catch(function (err) {
              return caches.open(STATIC_CACHE_NAME).then(function (cache) {
                if (event.request.headers.get('accept').includes('text/html'))
                  return cache.match('/offline.html')
              })
            })
        )
      })
    )
  }
})

self.addEventListener('sync', function (event) {
  console.log('[Service Worker] Background Syncing...', event)
  if (event.tag === 'sync-new-posts') {
    console.log('[Service Worker] Syncing new post...')
    event.waitUntil(
      readAllData('sync-posts').then(function (data) {
        for (var dt of data) {
          fetch(
            'https://pwagram-f8b66-default-rtdb.europe-west1.firebasedatabase.app/posts.json',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: JSON.stringify({
                id: dt.id,
                title: dt.title,
                location: dt.location,
                image:
                  'https://firebasestorage.googleapis.com/v0/b/pwagram-f8b66.appspot.com/o/sf-boat.jpg?alt=media&token=ff51e551-511a-4bb9-a82b-461626473620',
              }),
            }
          )
            .then(function (res) {
              console.log('[Service Worker] Sent Data:', res)
              if (res.ok) deleteItemFromData('sync-posts', dt.id)
            })
            .catch(function (err) {
              console.log('[Service Worker] Error while sending data...', err)
            })
        }
      })
    )
  }
})

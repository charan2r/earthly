/* Cache the shell and immutable assets, never API responses or photos. */
const CACHE='earthly-shell-v2';
self.addEventListener('install',event=>{event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  const shell=await fetch('/',{cache:'reload'});
  if(!shell.ok)throw new Error('Shell unavailable');
  const html=await shell.clone().text();
  const assets=[...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"\s]+)"/g)].map(match=>match[1].replace(/&amp;/g,'&')))];
  await cache.put('/',shell);
  await cache.addAll(['/icon.svg','/manifest.webmanifest',...assets]);
  await self.skipWaiting();
})());});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>(key.startsWith('grassquest-shell-')||key.startsWith('earthly-shell-'))&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put('/',copy));}return response;}).catch(()=>caches.match('/')));return;}
  if(url.pathname.startsWith('/_next/static/')||['/icon.svg','/manifest.webmanifest'].includes(url.pathname))event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return response;})));
});

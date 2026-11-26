const C='nc-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','./index.html','./manifest.json','./icons/icon-192.png'])));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
 if(/overpass|routing|supabase|groq/.test(u.hostname)||u.pathname.startsWith('/.netlify'))return;
 if(r.mode==='navigate'){e.respondWith(fetch(r).catch(()=>caches.match('./index.html')));return}
 e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok&&(u.origin===location.origin||u.hostname.endsWith('tile.openstreetmap.org'))){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp))}return res})))});

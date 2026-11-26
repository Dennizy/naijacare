import React,{useEffect,useMemo,useRef,useState} from 'react';
import L from 'leaflet';import 'leaflet/dist/leaflet.css';
import {tr,LANGS,fmtDist} from './i18n';
import {STATES,loadHospitals,fetchRoute,isOpen,sb,hav} from './data';
import {speak,stopSpeech,listen,intent,voiceStatus,openVoiceSettings,getLastIds} from './voice';
import {syncVoice,getClip} from './voiceSync';
import {ensureUser,touchProfile} from './auth';
import {warmMms} from './mms';
import {clipList,clipText} from './clips';
import {startNav} from './nav';
const ls=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch{return d}};
const sv=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const FILT={h24:h=>h.is_24hrs,mat:h=>h.has_maternity,ae:h=>h.has_emergency,pha:h=>h.type==='Pharmacy'||h.has_pharmacy,chi:h=>h.has_children,pri:h=>/private/i.test(h.ownership),pub:h=>/public/i.test(h.ownership),amb:h=>h.has_ambulance};
const FKEYS=[['h24','f24'],['mat','fmat'],['ae','fae'],['pha','fpha'],['chi','fchi'],['pri','fpri'],['pub','fpub'],['amb','famb']];
const CONTACTS=[['112 Emergency','112'],['Ambulance (via 112)','112'],['Police','199'],['Fire (via 112)','112'],['FRSC Road Safety','122']];
const devId=(()=>{let d=localStorage.getItem('nc_dev');if(!d){d=crypto.randomUUID();localStorage.setItem('nc_dev',d)}return d})();
const mins=s=>Math.max(1,Math.round(s/60));

export default function App(){
 const [lang,setLang]=useState(ls('nc_lang',null));const [splash,setSplash]=useState(true);
 const [set,setSet]=useState(()=>{const x={engine:'naija',voice:true,speed:1,dark:true,...ls('nc_set',{})};if(x.engine==='groq')x.engine='naija';return x});const [prof,setProf]=useState(ls('nc_prof',{name:'',state:''}));
 const [pos,setPos]=useState(null);const [all,setAll]=useState(ls('nc_last',[]));const [filters,setFilters]=useState([]);
 const [st,setSt]=useState('');const [q,setQ]=useState('');const [tab,setTab]=useState('home');const [sel,setSel]=useState(null);
 const [favs,setFavs]=useState(ls('nc_favs',[]));const [rec,setRec]=useState(ls('nc_rec',[]));const [more,setMore]=useState(false);
 const [busy,setBusy]=useState(false);const [say,setSay]=useState('');const [live,setLive]=useState(false);
 const [route,setRoute]=useState(null);const [mode,setMode]=useState('drive');const [nv,setNv]=useState(null);const [rep,setRep]=useState(null);
 const stopRef=useRef(null);const wake=useRef(null);
 const [vs,setVs]=useState(null);const [vOn,setVOn]=useState(false);
 const recheck=()=>voiceStatus().then(setVs);
 useEffect(()=>{if(!lang)return;voiceStatus().then(x=>{setVs(x);if(!Object.values(x).every(Boolean)&&!ls('nc_vseen',false))setVOn(true)})},[lang]);
 useEffect(()=>{const f=()=>{if(document.visibilityState==='visible')recheck()};const n=()=>setSay(tr(lang||'en','novoice'));
  document.addEventListener('visibilitychange',f);window.addEventListener('nc-novoice',n);return()=>{document.removeEventListener('visibilitychange',f);window.removeEventListener('nc-novoice',n)}},[lang]);
 useEffect(()=>{if(lang)syncVoice(lang)},[lang]);
 useEffect(()=>{if(set.mms&&lang)warmMms(lang)},[set.mms,lang]);
 const [fix,setFix]=useState(false);const [vote,setVote]=useState(null);
 const nextVote=()=>sb?sb.rpc('my_pending_votes').then(r=>setVote(r.data?.[0]||null)):null;
 useEffect(()=>{if(!lang||!sb)return;(async()=>{const u=await ensureUser();if(!u)return;await touchProfile(u.id,lang,prof);nextVote()})()},[lang,prof.name,prof.state]);
 const T=(k,v)=>tr(lang||'en',k,v);
 useEffect(()=>{const t=setTimeout(()=>setSplash(false),1800);return()=>clearTimeout(t)},[]);
 useEffect(()=>{document.body.className=set.dark?'dark':'';sv('nc_set',set)},[set]);
 useEffect(()=>sv('nc_prof',prof),[prof]);useEffect(()=>sv('nc_favs',favs),[favs]);useEffect(()=>sv('nc_rec',rec),[rec]);
 const locate=()=>navigator.geolocation.getCurrentPosition(p=>setPos({lat:p.coords.latitude,lon:p.coords.longitude}),()=>{setPos({lat:9.0765,lon:7.3986});setSay(T('nogps'))},{enableHighAccuracy:true,timeout:15000});
 useEffect(()=>{if('geolocation' in navigator)locate();else setPos({lat:9.0765,lon:7.3986})},[]);
 useEffect(()=>{if(!pos)return;setBusy(true);loadHospitals(pos,st).then(r=>{setAll(r);sv('nc_last',r.slice(0,40))}).catch(()=>{setAll(a=>a.map(h=>({...h,dist:hav(pos.lat,pos.lon,h.lat,h.lon)})).sort((a,b)=>a.dist-b.dist))}).finally(()=>setBusy(false))},[pos,st]);
 const apply=(src,f,text)=>src.filter(h=>f.every(k=>FILT[k](h))&&(!text||[h.name,h.lga,h.state,h.type].join(' ').toLowerCase().includes(text.toLowerCase())));
 const list=useMemo(()=>apply(all,filters,q),[all,filters,q]);
 const shown=more?list.slice(0,30):list.slice(0,3);
 const say_=(t)=>{setSay(t);if(set.voice)speak(t,lang,set)};
 const mic=async()=>{setLive(true);setSay(T('listening'));try{const text=await listen(lang);setQ('');setRec(r=>[text,...r.filter(x=>x!==text)].slice(0,8));
   const f=intent(text);const res=apply(all,f,'');setFilters(f);setTab('home');setMore(false);
   say_(res.length?T('found',{n:res.length,name:res[0].name,d:fmtDist(res[0].dist,lang)}):T('none'))}catch(e){setSay(T('none'))}setLive(false)};
 const sosGo=()=>{const best=all.find(h=>h.type==='Hospital'&&h.has_emergency)||all[0];if(best)go(best,'drive',true);else say_(T('none'))};
 async function go(h,m=mode,voice=false){if(!pos)return;setMode(m);setSel(null);setTab('map');
  try{const r=await fetchRoute(pos,h,m);setRoute({h,r});if(voice)begin(h,r,m)}catch(e){setSay('Route unavailable offline.')}}
 async function begin(h,r,m){stopRef.current?.();try{wake.current=await navigator.wakeLock?.request('screen')}catch{}
  stopRef.current=startNav({route:r,from:pos,to:h,lang:lang||'en',mode:m,speak:t=>{if(set.voice)speak(t,lang,set)},
   onUpdate:u=>{setNv(u);if(u.arrived)halt()},onRoute:nr=>setRoute(x=>({...x,r:nr}))});setNv({remaining:r.distance,eta:r.duration,text:''})}
 function halt(){stopRef.current?.();stopRef.current=null;wake.current?.release?.();setNv(null);stopSpeech()}
 const isFav=h=>favs.some(f=>f.id===h.id);
 const toggleFav=h=>{const on=isFav(h);setFavs(on?favs.filter(f=>f.id!==h.id):[h,...favs]);
  if(sb){on?sb.from('favourites').delete().match({device_id:devId,hospital_key:h.id}):sb.from('favourites').upsert({device_id:devId,hospital_key:h.id,name:h.name}).then(()=>{})}};
 const share=h=>{const text=`${h.name} - https://www.openstreetmap.org/?mlat=${h.lat}&mlon=${h.lon}#map=17/${h.lat}/${h.lon}`;navigator.share?navigator.share({title:h.name,text}).catch(()=>{}):window.open('https://wa.me/?text='+encodeURIComponent(text))};
 const sosShare=()=>{if(!pos)return;const text=`${T('sosMsg')} https://www.google.com/maps?q=${pos.lat},${pos.lon}`;navigator.share?navigator.share({text}).catch(()=>{}):window.open('https://wa.me/?text='+encodeURIComponent(text))};
 const submitRep=async f=>{if(sb){await ensureUser();await sb.from('reports').insert({kind:rep.kind,hospital_key:rep.h?.id||null,name:f.name,message:f.message,contact:f.contact,lat:pos?.lat,lon:pos?.lon})}setRep(null);say_(T('sent'))};
 const Card=({h})=>{const o=isOpen(h);return<div className="card" onClick={()=>setSel(h)}>
  <h3>{h.name}</h3><div className="meta">{(h.dist/1000).toFixed(1)} km · ~{mins(h.dist/ (25000/3600))} min · {h.type}{h.ownership?' · '+h.ownership:''}</div>
  <span className={'tag '+(o===null?'u':o?'o':'c')}>{o===null?T('nohrs'):o?T('open'):T('closed')}</span>
  <div className="row" onClick={e=>e.stopPropagation()}>{h.phone?<a className="btn" href={'tel:'+h.phone}>📞 {T('call')}</a>:null}<button className="btn alt" onClick={()=>go(h)}>🧭 {T('dir')}</button></div></div>};
 if(splash)return<div className="splash"><img src="./icons/splash.png" alt="NaijaCare"/></div>;
 if(!lang)return<div className="splash" style={{flexDirection:'column',gap:12,padding:24}}><img src="./icons/logo-192.png" style={{width:140,height:140}} alt=""/>
  {LANGS.map(([c,n])=><button key={c} className="btn" style={{maxWidth:300,flex:'none',width:'100%',padding:16,fontSize:18}} onClick={()=>{setLang(c);sv('nc_lang',c)}}>{n}</button>)}</div>;
 return<>
 <div className="hdr"><img src="./icons/logo-192.png" alt=""/>NaijaCare</div>
 <main style={tab==='map'?{padding:0,overflow:'hidden'}:undefined}>
 {tab==='home'&&<>
  {say&&<div className="say">{say}</div>}
  <button className={'mic'+(live?' live':'')} onClick={mic}>🎤 {T('tag')}</button>
  <input placeholder={T('search')} value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&q){setRec(r=>[q,...r.filter(x=>x!==q)].slice(0,8));const f=intent(q);if(f.length){setFilters(f);setQ('')}}}}/>
  {rec.length>0&&!q&&<div className="chips">{rec.map(x=><button key={x} className="chip" onClick={()=>setQ(x)}>🕘 {x}</button>)}</div>}
  <select value={st} onChange={e=>setSt(e.target.value)}><option value="">{T('allStates')} (GPS)</option>{STATES.map(s=><option key={s[0]}>{s[0]}</option>)}</select>
  <div className="chips">{FKEYS.map(([k,l])=><button key={k} className={'chip'+(filters.includes(k)?' on':'')} onClick={()=>setFilters(f=>f.includes(k)?f.filter(x=>x!==k):[...f,k])}>{T(l)}</button>)}</div>
  {busy&&<p className="meta">…</p>}{!busy&&!list.length&&<p className="meta">{T('none')}</p>}
  {shown.map(h=><Card key={h.id} h={h}/>)}
  {list.length>3&&<button className="btn alt" style={{width:'100%'}} onClick={()=>setMore(!more)}>{more?'▲':T('more')}</button>}
  <button className="btn alt" style={{width:'100%',marginTop:10}} onClick={()=>setRep({kind:'new'})}>＋ {T('report')}</button></>}
 {tab==='map'&&<div className="mapwrap" style={{top:0}}>
  {nv?<div className="navp"><b>{nv.arrived?T('arr'):nv.text||'…'}</b>{(nv.remaining/1000).toFixed(1)} km {T('remaining')} · ~{mins(nv.eta)} min<div className="row"><button className="btn red" onClick={halt}>■ {T('stopNav')}</button></div><div className="row"><button className="btn alt" onClick={()=>setFix(true)}>🎙️ {T('vFix')}</button></div></div>
  :route&&<div className="navp"><b>{route.h.name}</b>{(route.r.distance/1000).toFixed(1)} km · ~{mins(route.r.duration)} min
   <div className="row">{['walk','drive','keke'].map(m=><button key={m} className={'btn'+(mode===m?'':' alt')} onClick={()=>go(route.h,m)}>{T(m)}</button>)}</div>
   <div className="row"><button className="btn" onClick={()=>begin(route.h,route.r,mode)}>🔊 {T('startNav')}</button></div><div className="row"><button className="btn alt" onClick={()=>setFix(true)}>🎙️ {T('vFix')}</button></div></div>}
  <MapView pos={pos} list={list.slice(0,30)} route={route} onPick={setSel}/></div>}
 {tab==='saved'&&<><h2>⭐ {T('saved')}</h2>{!favs.length&&<p className="meta">{T('nofav')}</p>}{favs.map(h=><Card key={h.id} h={{...h,dist:pos?hav(pos.lat,pos.lon,h.lat,h.lon):0}}/>)}</>}
 {tab==='sos'&&<><h2 style={{color:'#E63946'}}>🚨 SOS</h2>
  <div className="row"><a className="btn red" href="tel:112">📞 112</a><button className="btn red" onClick={sosShare}>📍 {T('sosShare')}</button></div>
  <h2>{T('contacts')}</h2>{CONTACTS.map(([n,p])=><div key={n} className="card"><div className="row" style={{marginTop:0,alignItems:'center'}}><b style={{flex:3}}>{n}</b><a className="btn" href={'tel:'+p}>📞 {p}</a></div></div>)}
  <h2>{T('sosBtn')}</h2>{all.slice(0,3).map(h=><Card key={h.id} h={h}/>)}</>}
 {tab==='settings'&&<><h2>{T('language')}</h2><select value={lang} onChange={e=>{setLang(e.target.value);sv('nc_lang',e.target.value)}}>{LANGS.map(([c,n])=><option key={c} value={c}>{n}</option>)}</select>
  <label className="card" style={{display:'block'}}><input type="checkbox" style={{width:'auto'}} checked={set.voice} onChange={e=>setSet({...set,voice:e.target.checked})}/> {T('voice')}</label>
  <label className="card" style={{display:'block'}}><input type="checkbox" style={{width:'auto'}} checked={set.dark} onChange={e=>setSet({...set,dark:e.target.checked})}/> {T('dark')}</label>
  <div className="card"><button className="btn alt" style={{width:'100%',marginBottom:8}} onClick={()=>{recheck();setVOn(true)}}>🔊 {T('vCheck')}</button>
   <button className="btn alt" style={{width:'100%'}} onClick={()=>setSet({...set,mms:true})}>{set.mms?'✅ ':'⬇ '}{T('vModel')}</button></div>
  <div className="card">{T('speed')}: {set.speed}x<input type="range" min=".6" max="1.4" step=".1" value={set.speed} onChange={e=>setSet({...set,speed:+e.target.value})}/></div>
  <button className="btn alt" style={{width:'100%',marginBottom:10}} onClick={locate}>📍 GPS</button>
  <h2>👤</h2><input placeholder={T('name')} value={prof.name} onChange={e=>setProf({...prof,name:e.target.value})}/>
  <select value={prof.state} onChange={e=>setProf({...prof,state:e.target.value})}><option value="">{T('state')}</option>{STATES.map(s=><option key={s[0]}>{s[0]}</option>)}</select>
  <p className="meta" style={{textAlign:'center',marginTop:20}}>NaijaCare v1.0.0 · com.naijacare.app<br/>Map data © OpenStreetMap contributors</p></>}
 </main>
 <div className="sosbar" style={tab==='map'?{display:'none'}:undefined}><button onClick={sosGo}>🚨 {T('sosBtn')}</button></div>
 <div className="nav">{[['home','🏠'],['map','🗺️'],['saved','⭐'],['sos','🚨'],['settings','⚙️']].map(([k,i])=><button key={k} className={tab===k?'on':''} onClick={()=>setTab(k)}>{i}<br/>{T(k)}</button>)}</div>
 {sel&&<div className="sheet"><button className="btn alt" style={{width:'auto',padding:'8px 14px'}} onClick={()=>setSel(null)}>←</button>
  <h2>{sel.name}</h2><div className="card"><div className="meta">{sel.type}{sel.ownership?' · '+sel.ownership:''}</div>
  <p>{[sel.address,sel.lga,sel.state].filter(Boolean).join(', ')||'—'}</p><p>📞 {sel.phone||'—'}</p><p>🕒 {sel.is_24hrs?'24/7':sel.opening_hours||T('nohrs')}</p>
  {sel.services&&<p>🩺 {sel.services.split(';').join(', ')}</p>}<p>📏 {fmtDist(sel.dist??hav(pos.lat,pos.lon,sel.lat,sel.lon),lang)}</p></div>
  <div className="row">{sel.phone&&<a className="btn" href={'tel:'+sel.phone}>📞 {T('call')}</a>}<button className="btn alt" onClick={()=>go(sel)}>🧭 {T('dir')}</button></div>
  <div className="row"><button className="btn" onClick={()=>go(sel,'drive',true)}>🔊 {T('startNav')}</button></div>
  <div className="row"><button className="btn alt" onClick={()=>share(sel)}>↗ {T('share')}</button><button className="btn alt" onClick={()=>toggleFav(sel)}>{isFav(sel)?'⭐ '+T('unfav'):'☆ '+T('fav')}</button></div>
  <div className="row"><button className="btn alt" onClick={()=>setRep({kind:'wrong',h:sel})}>⚠ {T('report')}</button></div></div>}
 {vOn&&<VoiceSetup T={T} vs={vs} onClose={()=>{sv('nc_vseen',true);setVOn(false)}} recheck={recheck}/>}
 {vote&&<VoteCard T={T} lang={lang} v={vote} onDone={nextVote}/>}
 {fix&&<Correction T={T} lang={lang} onClose={()=>setFix(false)}/>}
 {rep&&<Report T={T} rep={rep} onClose={()=>setRep(null)} onSubmit={submitRep}/>}
 </>}
function Report({T,rep,onClose,onSubmit}){const [f,setF]=useState({name:rep.h?.name||'',message:'',contact:''});
 return<div className="sheet"><button className="btn alt" style={{width:'auto',padding:'8px 14px'}} onClick={onClose}>←</button><h2>{T('report')}</h2>
 <input placeholder="Hospital name" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/>
 <textarea rows="5" placeholder="Address, phone, what is wrong / new details" value={f.message} onChange={e=>setF({...f,message:e.target.value})}/>
 <input placeholder="Phone / email (optional)" value={f.contact} onChange={e=>setF({...f,contact:e.target.value})}/>
 <button className="btn" style={{width:'100%'}} disabled={!f.name||!f.message} onClick={()=>onSubmit(f)}>{T('save')}</button></div>}
function MapView({pos,list,route,onPick}){
 const el=useRef(),map=useRef(),layer=useRef(),me=useRef();
 useEffect(()=>{map.current=L.map(el.current,{zoomControl:false}).setView([pos?.lat||9.07,pos?.lon||7.4],13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map.current);layer.current=L.layerGroup().addTo(map.current);
  setTimeout(()=>map.current.invalidateSize(),100);return()=>map.current.remove()},[]);
 useEffect(()=>{if(!pos)return;me.current?.remove();me.current=L.circleMarker([pos.lat,pos.lon],{radius:9,color:'#fff',weight:3,fillColor:'#2979ff',fillOpacity:1}).addTo(map.current);if(!route)map.current.setView([pos.lat,pos.lon],14)},[pos]);
 useEffect(()=>{layer.current.clearLayers();
  list.forEach(h=>L.marker([h.lat,h.lon],{icon:L.divIcon({className:'',html:'<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#00D68F;border:2px solid #0F2233"></div>',iconSize:[22,22],iconAnchor:[11,22]})}).addTo(layer.current).on('click',()=>onPick(h)));
  if(route){const pl=L.polyline(route.r.geometry.coordinates.map(([a,b])=>[b,a]),{color:'#00D68F',weight:6}).addTo(layer.current);map.current.fitBounds(pl.getBounds(),{padding:[40,40]})}},[list,route]);
 return<div id="map" ref={el}/>}

function VoiceSetup({T,vs,onClose,recheck}){const [help,setHelp]=useState('');
 const names={en:'English',pcm:'Pidgin',ha:'Hausa',yo:'Yorùbá',ig:'Igbo'};const ready=vs&&Object.values(vs).every(Boolean);
 const turnOn=async()=>{const ok=await openVoiceSettings();if(!ok)setHelp(/iPhone|iPad/.test(navigator.userAgent)?'iPhone: Settings > Accessibility > Spoken Content > Voices':'Android: Settings > System > Languages > Text-to-speech output > install voice data');};
 return<div className="sheet" style={{background:'#0F2233',color:'#fff',textAlign:'center'}}><img src="./icons/logo-192.png" width="120" alt=""/>
 <h2>{T('vTitle')}</h2>{vs&&Object.entries(names).map(([k,n])=><p key={k} style={{fontSize:18}}>{vs[k]?'✅':'❌'} {n}</p>)}
 {ready?<h2>{T('vReady')}</h2>:<button className="btn" style={{width:'100%',padding:16,fontSize:18}} onClick={turnOn}>🔊 {T('vBtn')}</button>}
 {help&&<p style={{margin:12}}>{help}</p>}<button className="btn alt" style={{width:'100%',marginTop:12,background:'#132E44'}} onClick={onClose}>{T('vGo')}</button></div>}

function VoteCard({T,lang,v,onDone}){const [busy,setBusy]=useState(false);const text=clipText(lang,v.phrase_id);
 const cast=async y=>{setBusy(true);await sb.rpc('cast_vote',{p_vote_id:v.vote_id,p_yes:y});setBusy(false);onDone()};
 return<div className="sheet"><h2>🗳️ {T('vVoteTitle')}</h2><div className="card"><p style={{fontSize:18,marginBottom:10}}>{text}</p>
 <button className="mic" onClick={()=>new Audio(v.audio_url).play()}>▶ {T('vPlay')}</button>
 <div className="row"><button className="btn" disabled={busy} onClick={()=>cast(true)}>✅ {T('vYes')}</button><button className="btn red" disabled={busy} onClick={()=>cast(false)}>❌ {T('vNo')}</button></div></div></div>}
function Correction({T,lang,onClose}){
 const phrases=useMemo(()=>clipList(lang),[lang]);const [pid,setPid]=useState(getLastIds()[0]||phrases[0][0]);const [tab,setTab]=useState('phrase');
 const [note,setNote]=useState('');const [rec,setRec]=useState(null);const [dur,setDur]=useState(0);const [exp,setExp]=useState(null);const [live,setLive]=useState(false);
 const [done,setDone]=useState(false);const [err,setErr]=useState('');const [word,setWord]=useState('');const [ph,setPh]=useState('');const mr=useRef(),t0=useRef(0);
 useEffect(()=>{setExp(null);setRec(null);(async()=>{try{const u=await getClip(lang,pid,{mms:false});const a=new Audio(u);a.onloadedmetadata=()=>setExp(isFinite(a.duration)?a.duration:null)}catch{}})()},[pid,lang]);
 const expected=exp||Math.max(1,(clipText(lang,pid)||'').length*0.07); // MMS clip length, else a length based estimate
 const start=async()=>{setErr('');try{const st=await navigator.mediaDevices.getUserMedia({audio:true});const m=new MediaRecorder(st),ch=[];m.ondataavailable=e=>ch.push(e.data);
  m.onstop=()=>{st.getTracks().forEach(t=>t.stop());setDur((Date.now()-t0.current)/1000);setRec(new Blob(ch,{type:m.mimeType}))};mr.current=m;t0.current=Date.now();m.start();setLive(true)}catch{setErr('Mic not allowed')}};
 const stop=()=>{if(mr.current?.state==='recording')mr.current.stop();setLive(false)};
 const submit=async kind=>{const u=await ensureUser();if(!sb||!u){setErr('Not connected');return}let url=null;
  if(kind==='recording'){if(!rec){setErr('Record first');return}
   if(dur<0.7*expected){setErr(`${T('vShort')} (${dur.toFixed(1)}s / ${expected.toFixed(1)}s)`);return} // blocks single-word submissions
   const ext=rec.type.includes('mp4')?'m4a':rec.type.includes('ogg')?'ogg':'webm',path=`pending/${lang}/${pid}/${crypto.randomUUID()}.${ext}`;
   const up=await sb.storage.from('voice-clips').upload(path,rec,{contentType:rec.type});if(up.error){setErr(up.error.message);return}url=sb.storage.from('voice-clips').getPublicUrl(path).data.publicUrl}
  const r=await sb.from('voice_corrections').insert({phrase_id:pid,language:lang,audio_url:url,user_id:u.id,status:'pending',kind,note,duration_sec:kind==='recording'?dur:null,expected_sec:expected});
  if(r.error){setErr(r.error.message);return}setDone(true)};
 const sendWord=async()=>{if(!word||!ph||!sb)return;const u=await ensureUser();if(!u){setErr('Not connected');return}
  const r=await sb.from('pronunciation_dictionary').insert({language:lang,word:word.trim(),phonetic:ph.trim()});if(r.error){setErr(r.error.message);return}setDone(true)};
 return<div className="sheet"><button className="btn alt" style={{width:'auto',padding:'8px 14px'}} onClick={onClose}>←</button><h2>🎙️ {T('vFix')}</h2>
 {done?<div className="say">{T('vThanks')}</div>:<>
 <div className="row"><button className={'btn'+(tab==='phrase'?'':' alt')} onClick={()=>setTab('phrase')}>{T('vReport')}</button><button className={'btn'+(tab==='word'?'':' alt')} onClick={()=>setTab('word')}>{T('vWordFix')}</button></div>
 {tab==='phrase'?<>
 <select style={{marginTop:10}} value={pid} onChange={e=>setPid(e.target.value)}>{phrases.map(([id,t])=><option key={id} value={id}>{id}: {t}</option>)}</select>
 <textarea rows="2" placeholder={T('vReport')} value={note} onChange={e=>setNote(e.target.value)}/>
 <button className="btn alt" style={{width:'100%',marginBottom:8}} onClick={()=>submit('report')}>⚠ {T('vReport')}</button>
 <p className="meta">≈ {expected.toFixed(1)}s</p>
 <button className={'mic'+(live?' live':'')} onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}>🎤 {T('vHold')}</button>
 {rec&&<><audio controls src={URL.createObjectURL(rec)} style={{width:'100%'}}/><p className="meta">{dur.toFixed(1)}s</p></>}
 <button className="btn" style={{width:'100%',marginTop:8}} disabled={!rec} onClick={()=>submit('recording')}>{T('vSend')}</button></>
 :<><input style={{marginTop:10}} placeholder={T('vWord')} value={word} onChange={e=>setWord(e.target.value)}/><input placeholder={T('vPhon')} value={ph} onChange={e=>setPh(e.target.value)}/>
 <button className="btn" style={{width:'100%'}} disabled={!word||!ph} onClick={sendWord}>{T('vSend')}</button></>}
 {err&&<p className="meta" style={{color:'#E63946'}}>{err}</p>}</>}</div>}

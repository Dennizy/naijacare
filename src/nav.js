import {hav,fetchRoute,pointToRoute} from './data';
import {tr} from './i18n';
import {phraseText} from './clips';
const spec=(st,d,now)=>{const mod=st.maneuver.modifier||'straight';
 if(st.maneuver.type==='arrive')return{key:'arrIn',dist:d};
 if(/left/.test(mod))return now?{key:'nl'}:{key:'tl',dist:d};if(/right/.test(mod))return now?{key:'nr'}:{key:'tr',dist:d};
 if(mod==='uturn')return{key:'ut',dist:d};return{key:'st',dist:d}};
const txt=(s,l)=>phraseText(s,l);
export function startNav({route,from,to,lang,mode,speak,onUpdate,onRoute}){
 let r=route,idx=1,s200=false,sNow=false,off=0,lastRe=0,stopped=false;
 const st0=r.legs[0].steps;speak([{key:'start',dist:r.distance},...(st0[1]?[spec(st0[1],st0[0].distance)]:[])]);
 const id=navigator.geolocation.watchPosition(async p=>{if(stopped)return;
  const pos={lat:p.coords.latitude,lon:p.coords.longitude},st=r.legs[0].steps,step=st[idx];if(!step)return;
  const [lo,la]=step.maneuver.location,d=hav(pos.lat,pos.lon,la,lo);
  const rem=d+st.slice(idx).reduce((a,s)=>a+s.distance,0);
  onUpdate({remaining:rem,eta:r.duration*rem/Math.max(r.distance,1),text:txt(spec(step,d),lang),arrived:false,pos});
  if(step.maneuver.type==='arrive'&&d<40){speak({key:'arr'});onUpdate({remaining:0,eta:0,text:tr(lang,'arr'),arrived:true,pos});stop();return}
  if(pointToRoute(pos,r.geometry.coordinates)>100)off++;else off=0;
  if(off>=2&&Date.now()-lastRe>15000){lastRe=Date.now();off=0;speak({key:'rr'});
   try{r=await fetchRoute(pos,to,mode);idx=1;s200=false;sNow=false;onRoute(r)}catch(e){}return}
  if(d<40&&step.maneuver.type!=='arrive'){speak(spec(step,d,true));idx++;s200=false;return}
  if(d<200&&!s200){s200=true;speak(spec(step,d))}
 },()=>{},{enableHighAccuracy:true,maximumAge:2000,timeout:20000});
 function stop(){stopped=true;navigator.geolocation.clearWatch(id)}
 return stop}

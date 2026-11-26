import {createClient} from '@supabase/supabase-js';
const env=import.meta.env;
export const sb=env.VITE_SUPABASE_URL&&env.VITE_SUPABASE_ANON_KEY?createClient(env.VITE_SUPABASE_URL,env.VITE_SUPABASE_ANON_KEY):null;
export const OSRM=env.VITE_OSRM_URL||'https://routing.openstreetmap.de';
const OVP=env.VITE_OVERPASS_URL||'https://overpass-api.de/api/interpreter';
export const STATES=[['Abia',5.53,7.49],['Adamawa',9.20,12.48],['Akwa Ibom',5.03,7.93],['Anambra',6.21,7.07],['Bauchi',10.31,9.84],['Bayelsa',4.92,6.26],['Benue',7.73,8.52],['Borno',11.83,13.15],['Cross River',4.95,8.32],['Delta',6.20,6.73],['Ebonyi',6.32,8.11],['Edo',6.34,5.63],['Ekiti',7.62,5.22],['Enugu',6.46,7.55],['FCT',9.06,7.49],['Gombe',10.29,11.17],['Imo',5.48,7.03],['Jigawa',11.76,9.34],['Kaduna',10.52,7.44],['Kano',12.00,8.52],['Katsina',12.99,7.60],['Kebbi',12.45,4.20],['Kogi',7.80,6.74],['Kwara',8.50,4.55],['Lagos',6.60,3.35],['Nasarawa',8.49,8.52],['Niger',9.61,6.55],['Ogun',7.16,3.35],['Ondo',7.25,5.19],['Osun',7.77,4.56],['Oyo',7.38,3.95],['Plateau',9.90,8.86],['Rivers',4.82,7.05],['Sokoto',13.06,5.24],['Taraba',8.89,11.36],['Yobe',11.75,11.96],['Zamfara',12.17,6.66]];
export const hav=(a,b,c,d)=>{const R=6371000,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p;const h=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(h))};
const D=['Su','Mo','Tu','We','Th','Fr','Sa'];
export function isOpen(h,now=new Date()){
 if(h.is_24hrs)return true;const oh=h.opening_hours;if(!oh)return null;if(/24\/7/.test(oh))return true;
 const day=now.getDay(),mins=now.getHours()*60+now.getMinutes();let seen=false;
 for(const rule of oh.split(';')){const tm=rule.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);if(!tm)continue;seen=true;
  const dm=rule.match(/(Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(Mo|Tu|We|Th|Fr|Sa|Su))?/);let dayOk=true;
  if(dm){const a=D.indexOf(dm[1]),b=dm[2]?D.indexOf(dm[2]):a;dayOk=a<=b?(day>=a&&day<=b):(day>=a||day<=b)}
  const s=+tm[1]*60+ +tm[2],e=+tm[3]*60+ +tm[4];
  if(dayOk&&(s<=e?(mins>=s&&mins<e):(mins>=s||mins<e)))return true}
 return seen?false:null}
const yes=v=>v===true||v==='true'||v==='yes';
function fromOSM(el){const t=el.tags||{},lat=el.lat??el.center?.lat,lon=el.lon??el.center?.lon;if(!lat||!t.name)return null;
 const am=t.amenity,type=am==='pharmacy'?'Pharmacy':am==='clinic'||am==='doctors'?'Clinic':/maternity/i.test(t.name)?'Maternity Home':/primary health|phc/i.test(t.name)?'Primary Health Centre':'Hospital';
 const oh=t.opening_hours||'';const sp=(t['healthcare:speciality']||'')+' '+t.name;
 return{id:'osm-'+el.type[0]+el.id,name:t.name,type,lat,lon,state:t['addr:state']||'',lga:t['addr:city']||t['addr:suburb']||'',phone:t.phone||t['contact:phone']||'',
  is_24hrs:/24\/7/.test(oh)||t.emergency==='yes'&&/24\/7/.test(oh),ownership:/government|public/i.test(t['operator:type']||'')?'Public':/private/i.test(t['operator:type']||'')?'Private':'',
  has_emergency:t.emergency==='yes'||type==='Hospital',has_ambulance:t.emergency==='ambulance_station'||yes(t.ambulance),has_maternity:/matern|obstet|gyn/i.test(sp)||type==='Maternity Home',
  has_children:/paed|pedi|child/i.test(sp),has_pharmacy:type==='Pharmacy'||t.dispensing==='yes',opening_hours:oh,address:[t['addr:street'],t['addr:city']].filter(Boolean).join(', '),src:'osm'}}
async function osm(lat,lon,r){const q=`[out:json][timeout:25];(nwr["amenity"~"^(hospital|clinic|pharmacy|doctors)$"](around:${r},${lat},${lon});nwr["healthcare"="hospital"](around:${r},${lat},${lon}););out center 80;`;
 const res=await fetch(OVP,{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'}});
 if(!res.ok)throw new Error('overpass');const j=await res.json();return j.elements.map(fromOSM).filter(Boolean)}
async function supa(lat,lon,r){if(!sb)return[];const dg=Math.max(0.3,r/100000);
 const {data,error}=await sb.from('hospitals').select('*').gte('lat',lat-dg).lte('lat',lat+dg).gte('lon',lon-dg).lte('lon',lon+dg).limit(500);
 if(error)return[];return data.map(x=>({...x,id:'db-'+x.id,has_children:/child|paed/i.test(x.services||''),has_pharmacy:x.type==='Pharmacy'||/pharm/i.test(x.services||''),src:'db'}))}
const c = st ? { lat: st[1], lon: st[2] } : pos; let out = [];
 const st=STATES.find(s=>s[0]===stateName);const c=st?{lat:st[1],lon:st[2]}:pos;let out=[];
 for(const r of st?[30000]:[8000,25000,60000]){
  const [a,b]=await Promise.allSettled([supa(c.lat,c.lon,r),osm(c.lat,c.lon,r)]);
  out=[...(a.value||[])];for(const o of (b.value||[]))if(!out.some(x=>hav(x.lat,x.lon,o.lat,o.lon)<80))out.push(o);
  if(a.status==='rejected'&&b.status==='rejected')throw new Error('offline');
  if(out.length>=3)break}
 return out.map(h=>({...h,dist:hav(pos.lat,pos.lon,h.lat,h.lon)})).sort((x,y)=>x.dist-y.dist)}
export async function fetchRoute(from,to,mode){
 const prof=mode==='walk'?'routed-foot':'routed-car';
 const url=`${OSRM}/${prof}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=true`;
 const r=await fetch(url);const j=await r.json();if(!j.routes?.length)throw new Error('noroute');const rt=j.routes[0];
 if(mode==='keke')rt.duration*=1.3;return rt}
export function pointToRoute(p,coords){let m=Infinity;for(const [lo,la] of coords){const d=hav(p.lat,p.lon,la,lo);if(d<m)m=d}return m}

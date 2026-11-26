import {sb} from './data';
import {clipList,clipText} from './clips';
import {synthUrl} from './mms';
const SB=import.meta.env.VITE_SUPABASE_URL,CN='nc-voice';
const get=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const over=(l,id)=>get('nc_vover',{})[l+'/'+id];
export const baseUrl=(l,id)=>`${SB}/storage/v1/object/public/voice-clips/${l}/${id}.mp3`;
async function fetchCached(url){const c=await caches.open(CN);let r=await c.match(url);
 if(!r){r=await fetch(url);if(!r.ok||!(r.headers.get('content-type')||'').startsWith('audio'))throw new Error('missing clip');await c.put(url,r.clone())}
 return URL.createObjectURL(await r.blob())}
// Priority per phrase id: 1) admin-approved correction  2) MMS clip (pre-generated in Supabase Storage, else generated on the phone if the user enabled the engine)
export async function getClip(l,id,{mms=false}={}){
 const o=over(l,id);if(o)try{return await fetchCached(o)}catch{}
 if(SB)try{return await fetchCached(baseUrl(l,id))}catch{}
 if(mms)return synthUrl(clipText(l,id),l,6000);
 throw new Error('no clip')}
// Runs on every app open: checks voice_version, downloads newly approved clips in the background, caches base clips for offline use.
export async function syncVoice(l){
 if(!sb)return;
 try{const {data:cfg}=await sb.from('app_config').select('key,value');const ver=+(cfg||[]).find(r=>r.key==='voice_version')?.value||1,local=get('nc_vver',0),c=await caches.open(CN);
  if(ver>local){const {data}=await sb.from('voice_clips').select('*').gt('version',local);const o=get('nc_vover',{});let ok=true;
   for(const row of data||[]){try{await c.add(row.audio_url);o[row.language+'/'+row.phrase_id]=row.audio_url}catch{ok=false}}
   localStorage.setItem('nc_vover',JSON.stringify(o));if(ok)localStorage.setItem('nc_vver',String(ver))}
  const {data:dd}=await sb.from('pronunciation_dictionary').select('language,word,phonetic').eq('status','approved');if(dd)localStorage.setItem('nc_dict',JSON.stringify(dd));
  for(const [id] of clipList(l)){const u=over(l,id)||baseUrl(l,id);if(!await c.match(u))try{await c.add(u)}catch{}}}catch{}}

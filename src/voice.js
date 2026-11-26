import {Capacitor,registerPlugin} from '@capacitor/core';
import {STT} from './i18n';
import {phraseId,phraseText} from './clips';
import {getClip} from './voiceSync';
import {synthUrl} from './mms';
const VS=registerPlugin('VoiceSettings');
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const NAIJA=['ha','yo','ig'];
export const renderText=(s,l)=>typeof s==='string'?s:phraseText(s,l);
// ---------- layer status / setup ----------
export async function voiceStatus(){
 if(!('speechSynthesis' in window))return{en:false,pcm:false,ha:false,yo:false,ig:false};
 let v=speechSynthesis.getVoices();if(!v.length)await new Promise(r=>{speechSynthesis.onvoiceschanged=r;setTimeout(r,1500)});v=speechSynthesis.getVoices();
 const has=p=>v.some(x=>x.lang.replace('_','-').toLowerCase().startsWith(p));return{en:has('en'),pcm:has('en'),ha:has('ha'),yo:has('yo'),ig:has('ig')}}
export async function openVoiceSettings(){
 if(Capacitor.getPlatform()==='android'){try{await VS.openTtsSettings();return true}catch(e){return false}}return false}
// ---------- engines ----------
let tok=0,cur=null,lastIds=[];
export const getLastIds=()=>lastIds;
export function stopSpeech(){tok++;try{speechSynthesis.cancel()}catch{}cur?.pause();cur=null}
const play=url=>new Promise((res,rej)=>{const a=new Audio(url);cur=a;a.onended=res;a.onerror=()=>rej(new Error('audio'));a.play().catch(rej)});
// Layer 1 (+ override): approved corrections, then MMS clips. Dynamic sentences need the on-phone MMS engine (opt-in in Settings).
async function mms(s,l,set){
 if(typeof s==='string'){if(!set.mms)throw new Error('mms engine not enabled');return play(await synthUrl(s,l,6000))}
 return play(await getClip(l,phraseId(s),{mms:!!set.mms}))} // ONE file per phrase: human clip if approved, else MMS clip
// Layer 2: phone TTS. Never an English voice for ha/yo/ig.
function phone(s,l,set){const text=renderText(s,l),code=STT[l].slice(0,2);if(!('speechSynthesis' in window))throw new Error('none');
 const v=speechSynthesis.getVoices().find(x=>x.lang.replace('_','-').toLowerCase().startsWith(code));
 if(!v)throw new Error('no voice for '+l);
 return new Promise((res,rej)=>{const u=new SpeechSynthesisUtterance(text);u.voice=v;u.lang=v.lang;u.rate=set.speed||1;u.onend=res;u.onerror=rej;speechSynthesis.speak(u)})}
export async function speak(spec,l,set={}){stopSpeech();const my=tok;
 for(const s of Array.isArray(spec)?spec:[spec]){let ok=false;if(typeof s!=='string')lastIds=[phraseId(s)];
  for(const e of [mms,phone]){if(tok!==my)return;try{await e(s,l,set);ok=true;break}catch(err){}}
  if(!ok)window.dispatchEvent(new Event('nc-novoice'))}}
// ---------- speech input ----------
const viaSR=lang=>new Promise((res,rej)=>{const r=new SR();r.lang=STT[lang];r.interimResults=false;
 r.onresult=e=>res(e.results[0][0].transcript);r.onerror=e=>rej(e.error);r.onend=()=>rej('end');r.start()});
async function viaWhisper(lang){
 const st=await navigator.mediaDevices.getUserMedia({audio:true});const mr=new MediaRecorder(st);const ch=[];
 mr.ondataavailable=e=>ch.push(e.data);const done=new Promise(r=>mr.onstop=r);mr.start();
 await new Promise(r=>setTimeout(r,5000));mr.stop();await done;st.getTracks().forEach(t=>t.stop());
 const {transcribe}=await import('./stt');const t=await transcribe(new Blob(ch,{type:mr.mimeType}),lang);if(!t)throw new Error('stt');return t}
export async function listen(lang){if(SR){try{return await viaSR(lang)}catch(e){}}return viaWhisper(lang)}
const W={
 mat:/matern|pregnan|labou?r|deliver|haihu|ciki|aboyun|oyun|ibimọ|ibimo|nwa ime|ime nwa|dị ime|di ime|wey dey born/i,
 chi:/child|baby|pikin|yara|yaro|ọmọ|omo|nwa |nwa$|ụmụ|umu/i,
 acc:/accident|emergency|bleed|blood|hatsari|gaggawa|jini|ijamba|pajawiri|pàjáwìrì|ẹjẹ|eje|mberede|ọbara|obara|i get accident/i,
 pha:/pharmac|chemist|kemis|drug store|kantin magani/i};
export function intent(text){const f=[];if(W.mat.test(text))f.push('mat');if(W.chi.test(text))f.push('chi');if(W.acc.test(text))f.push('ae');if(W.pha.test(text))f.push('pha');return f}

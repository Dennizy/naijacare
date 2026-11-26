// Layer 1 engine: Meta MMS-TTS (VITS) running in the phone via transformers.js. CC-BY-NC 4.0 weights: non-commercial use only.
const MODELS={en:'Xenova/mms-tts-eng',pcm:'Xenova/mms-tts-eng', // no Pidgin MMS model: Pidgin text is read by the English model
 yo:'Xenova/mms-tts-yor',ha:import.meta.env.VITE_MMS_HAU||'Xenova/mms-tts-hau',ig:import.meta.env.VITE_MMS_IBO||'Xenova/mms-tts-ibo'};
const dict=()=>{try{return JSON.parse(localStorage.getItem('nc_dict'))||[]}catch{return[]}};
// Approved "Word Pronunciation Fix" entries (e.g. Nnewi -> Neh-weh). Applies to MMS text only; human recordings are untouched.
export const applyDict=(t,l)=>dict().filter(d=>d.language===l).reduce((x,d)=>x.replace(new RegExp('\\b'+d.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi'),d.phonetic),t);
const pipes={},bad=new Set(),CN='nc-mms';
const hash=s=>{let h=5381;for(const c of s)h=((h<<5)+h+c.charCodeAt(0))>>>0;return h.toString(36)};
function wav(f,sr){const b=new ArrayBuffer(44+f.length*2),v=new DataView(b),w=(o,s)=>[...s].forEach((c,i)=>v.setUint8(o+i,c.charCodeAt(0)));
 w(0,'RIFF');v.setUint32(4,36+f.length*2,true);w(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,f.length*2,true);
 f.forEach((x,i)=>v.setInt16(44+i*2,Math.max(-1,Math.min(1,x))*32767,true));return new Blob([b],{type:'audio/wav'})}
function load(l){if(bad.has(l))return Promise.reject(new Error('model unavailable'));
 if(!pipes[l])pipes[l]=(async()=>{const T=await import('@huggingface/transformers');const host=import.meta.env.VITE_MODEL_HOST;
  if(host){T.env.remoteHost=host;T.env.remotePathTemplate='{model}/'}return T.pipeline('text-to-speech',MODELS[l])})().catch(e=>{bad.add(l);delete pipes[l];throw e});
 return pipes[l]}
export const warmMms=l=>load(l).catch(()=>{});
// Returns an object URL. Generated audio is cached on the device so each phrase is synthesised once. If the model is slow to load, `ms` makes the caller fall through to phone voice while loading continues in the background.
export async function synthUrl(raw,l,ms=0){const text=applyDict(raw,l),key=`https://mms.local/${l}/${hash(text)}`,c=await caches.open(CN),hit=await c.match(key);
 if(hit)return URL.createObjectURL(await hit.blob());
 const work=(async()=>{const p=await load(l),o=await p(text),w=wav(o.audio,o.sampling_rate);await c.put(key,new Response(w,{headers:{'Content-Type':'audio/wav'}}));return w})();
 const blob=ms?await Promise.race([work,new Promise((_,rej)=>setTimeout(()=>rej(new Error('mms slow')),ms))]):await work;return URL.createObjectURL(blob)}

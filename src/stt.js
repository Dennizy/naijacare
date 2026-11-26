// Offline-capable speech input (open Whisper via transformers.js). No Whisper model for Igbo: it falls back to auto-detect.
let asr;const NAMES={ha:'hausa',yo:'yoruba',en:'english',pcm:'english'};
export async function transcribe(blob,l){const T=await import('@huggingface/transformers');
 asr??=T.pipeline('automatic-speech-recognition',import.meta.env.VITE_WHISPER_MODEL||'Xenova/whisper-base');
 const ctx=new (window.AudioContext||window.webkitAudioContext)({sampleRate:16000}),a=await ctx.decodeAudioData(await blob.arrayBuffer());ctx.close();
 const p=await asr,o=await p(a.getChannelData(0),NAMES[l]?{language:NAMES[l],task:'transcribe'}:{});return(o.text||'').trim()}

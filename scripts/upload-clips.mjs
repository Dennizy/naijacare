// Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/upload-clips.mjs
// Uploads audio-source/<lang>/<id>.mp3 (the recordings listed in AUDIO_SCRIPT.csv) to the Supabase bucket voice-clips.
import {createClient} from '@supabase/supabase-js';import {readdirSync,readFileSync,existsSync} from 'fs';
const sb=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_KEY);let n=0;
for(const l of ['en','pcm','ha','yo','ig']){const d=`audio-source/${l}`;if(!existsSync(d))continue;
 for(const f of readdirSync(d).filter(f=>f.endsWith('.mp3'))){const {error}=await sb.storage.from('voice-clips').upload(`${l}/${f}`,readFileSync(`${d}/${f}`),{contentType:'audio/mpeg',upsert:true});if(error)console.log(l,f,error.message);else n++}}
console.log('uploaded',n,'clips');

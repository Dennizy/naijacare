import {writeFileSync} from 'fs';import {clipList} from '../src/clips.js';
const rows=['lang,file,text'];for(const l of ['en','pcm','ha','yo','ig'])for(const [id,t] of clipList(l))rows.push(`${l},audio-source/${l}/${id}.mp3,"${t.replace(/"/g,'""')}"`);
writeFileSync('AUDIO_SCRIPT.csv',rows.join('\n')+'\n');console.log(rows.length-1,'clips to record');

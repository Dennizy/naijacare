import {tr} from './i18n.js';
// A "phrase" is ONE complete spoken sentence with a snapped distance, e.g. tl_200 = "Turn left in 200 metres".
// Each phrase is a single audio file (human OR MMS), so voices are never spliced.
export const NB=[50,100,150,200];
export const SB=[50,100,150,200,250,300,400,500,600,700,800,900];
const nearest=(a,d)=>a.reduce((x,y)=>Math.abs(y-d)<Math.abs(x-d)?y:x);
export function snap(s){if(s.dist==null||['nl','nr','arr','rr'].includes(s.key))return{key:s.key};
 if(s.key==='start')return{key:'start',dist:s.dist<1000?nearest(SB,s.dist):Math.min(30,Math.max(1,Math.round(s.dist/1000)))*1000};
 return{key:s.key,dist:nearest(NB,s.dist)}}
export const phraseId=s=>{s=snap(s);return s.dist==null?s.key:`${s.key}_${s.dist}`};
export function phraseText(s,l){s=snap(s);const d=s.dist==null?'':s.dist<1000?`${s.dist} ${tr(l,'m')}`:`${s.dist/1000} ${tr(l,'km')}`;return tr(l,s.key,{m:d,d})}
export function clipList(l){const o=[];for(const k of ['nl','nr','arr','rr'])o.push([k,phraseText({key:k},l)]);
 for(const k of ['tl','tr','st','ut','arrIn'])for(const d of NB)o.push([`${k}_${d}`,phraseText({key:k,dist:d},l)]);
 for(const d of SB)o.push([`start_${d}`,phraseText({key:'start',dist:d},l)]);
 for(let n=1;n<=30;n++)o.push([`start_${n*1000}`,phraseText({key:'start',dist:n*1000},l)]);return o}
export const clipText=(l,id)=>Object.fromEntries(clipList(l))[id];

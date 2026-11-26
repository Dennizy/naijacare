import {sb} from './data';
// Anonymous Supabase Auth gives every device a real user id (enable Auth > Providers > Anonymous in Supabase).
export async function ensureUser(){if(!sb)return null;try{let {data:{session}}=await sb.auth.getSession();if(!session){const r=await sb.auth.signInAnonymously();session=r.data.session}return session?.user||null}catch{return null}}
export async function touchProfile(id,lang,prof){if(!sb||!id)return;await sb.from('profiles').update({language:lang,name:prof?.name||null,state:prof?.state||null,last_seen:new Date().toISOString()}).eq('id',id)}

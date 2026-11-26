// Hidden dashboard: /admin, /admin/login ... No link to it exists in the user app. Real protection = Supabase Auth + RLS (is_admin()).
import React,{useEffect,useMemo,useState} from 'react';
import {sb,STATES} from '../data';
import {clipList} from '../clips';
const go=p=>{history.pushState({},'',p);window.dispatchEvent(new Event('popstate'))};
const T7=()=>new Date(Date.now()-7*864e5).toISOString();
const cnt=async q=>(await q).count||0;
const H=(t,f)=>sb.from(t).select('*',{count:'exact',head:true});
export default function Admin(){
 const [path,setPath]=useState(location.pathname);const [me,setMe]=useState(undefined);
 useEffect(()=>{document.body.classList.add('admin');document.title='Admin';const m=document.createElement('meta');m.name='robots';m.content='noindex';document.head.appendChild(m);
  const f=()=>setPath(location.pathname);addEventListener('popstate',f);check();return()=>removeEventListener('popstate',f)},[]);
 async function check(){if(!sb){setMe(null);return}const {data:{user}}=await sb.auth.getUser();if(!user||user.is_anonymous){setMe(null);return}
  const {data}=await sb.from('profiles').select('role,email').eq('id',user.id).single();setMe(data?.role==='admin'?data:'denied')}
 useEffect(()=>{if(me===undefined)return;const ok=me&&me!=='denied';if(!ok&&path!=='/admin/login')go('/admin/login');else if(ok&&path==='/admin/login')go('/admin')},[me,path]);
 if(me===undefined)return null;
 if(!me||me==='denied')return<Login denied={me==='denied'} onDone={check}/>;
 const page=path.replace(/\/$/,'');
 return<div className="adm"><div className="c"><b style={{fontSize:20}}>NaijaCare Admin</b><br/>
  {[['/admin','Home'],['/admin/corrections','Corrections'],['/admin/hospitals','Hospitals'],['/admin/users','Users']].map(([p,n])=><a key={p} onClick={()=>go(p)}>{n}</a>)}
  <button className="lnk" onClick={async()=>{const p=prompt('New password (min 8 chars)');if(p&&p.length>=8){const r=await sb.auth.updateUser({password:p});alert(r.error?r.error.message:'Password changed')}}}>Change password</button>
  <button className="lnk" onClick={async()=>{await sb.auth.signOut();setMe(null);go('/admin/login')}}>Log out</button></div>
  {page==='/admin/corrections'?<Corrections/>:page==='/admin/hospitals'?<Hospitals/>:page==='/admin/users'?<Users/>:<Home/>}</div>}
function Login({denied,onDone}){const [e,setE]=useState('');const [p,setP]=useState('');const [err,setErr]=useState('');
 const submit=async()=>{setErr('');const r=await sb.auth.signInWithPassword({email:e,password:p});if(r.error)setErr(r.error.message);else onDone()};
 return<div className="adm" style={{maxWidth:380,margin:'60px auto'}}><img src="/icons/logo-192.png" width="110" alt=""/><h2>Admin login</h2>
  {denied&&<p className="bad">Access Denied</p>}<input placeholder="Email" value={e} onChange={x=>setE(x.target.value)}/><input type="password" placeholder="Password" value={p} onChange={x=>setP(x.target.value)} onKeyDown={x=>x.key==='Enter'&&submit()}/>
  <button className="b" onClick={submit}>Log in</button>{err&&<p className="bad">{err}</p>}</div>}
function Home(){const [s,setS]=useState({});
 useEffect(()=>{(async()=>{setS({users:await cnt(H('profiles')),active:await cnt(H('profiles').gt('last_seen',T7())),pend:await cnt(H('voice_corrections').eq('status','pending')),
  dict:await cnt(H('pronunciation_dictionary').eq('status','pending')),hosp:await cnt(H('hospitals')),rep:await cnt(H('reports').eq('status','new')),
  ver:(await sb.from('app_config').select('value').eq('key','voice_version').single()).data?.value})})()},[]);
 return<div className="grid">{[['Users',s.users],['Active (7 days)',s.active],['Corrections waiting',s.pend],['Word fixes waiting',s.dict],['Hospitals',s.hosp],['New reports',s.rep],['Live voice version',s.ver]].map(([k,v])=><div className="c" key={k}>{k}<div className="big">{v??'…'}</div></div>)}</div>}
function Corrections(){const [rows,setRows]=useState([]);const [dict,setDict]=useState([]);const [tx,setTx]=useState({});
 const en=useMemo(()=>Object.fromEntries(clipList('en')),[]);const nat=useMemo(()=>{const o={};for(const l of ['en','pcm','ha','yo','ig'])o[l]=Object.fromEntries(clipList(l));return o},[]);
 const load=async()=>{const a=await sb.from('voice_corrections').select('*, correction_votes(vote)').eq('status','pending').order('created_at');setRows(a.data||[]);
  setDict((await sb.from('pronunciation_dictionary').select('*').eq('status','pending')).data||[])};
 useEffect(()=>{load()},[]);
 async function approve(r){if(r.audio_url){const blob=await (await fetch(r.audio_url)).blob();const cur=await sb.from('app_config').select('value').eq('key','voice_version').single();const ver=(+cur.data.value||1)+1;
   const ext=r.audio_url.split('?')[0].split('.').pop(),path=`${r.language}/${r.phrase_id}_v${ver}.${ext}`;
   const up=await sb.storage.from('voice-clips').upload(path,blob,{contentType:blob.type,upsert:true});if(up.error)return alert(up.error.message);
   await sb.from('voice_clips').upsert({phrase_id:r.phrase_id,language:r.language,audio_url:sb.storage.from('voice-clips').getPublicUrl(path).data.publicUrl,version:ver});
   await sb.from('app_config').update({value:String(ver)}).eq('key','voice_version')}
  await sb.from('voice_corrections').update({status:'approved'}).eq('id',r.id);load()}
 const reject=async(r,note)=>{await sb.from('voice_corrections').update({status:'rejected',admin_note:note||'Record the FULL sentence'}).eq('id',r.id);load()};
 const transcribe=async r=>{try{const {transcribe:t}=await import('../stt');setTx({...tx,[r.id]:await t(await (await fetch(r.audio_url)).blob(),r.language)})}catch(e){setTx({...tx,[r.id]:'(could not transcribe)'})}};
 return<><h2>Voice corrections</h2>{!rows.length&&<p>Nothing waiting.</p>}
 {rows.map(r=>{const v=r.correction_votes||[],yes=v.filter(x=>x.vote===true).length,no=v.filter(x=>x.vote===false).length,done=yes+no;
  const sug=done<3?`Waiting for votes (${done}/${Math.max(v.length,0)} cast${v.length<3?', fewer than 3 voters were available':''})`:yes>=2?'Suggest APPROVE':'Suggest REJECT';
  const ratio=r.duration_sec&&r.expected_sec?r.duration_sec/r.expected_sec:null,short=ratio!=null&&ratio<0.7;
  return<div className="c" key={r.id}><b>{r.language.toUpperCase()} · {r.phrase_id}</b> ({r.kind})
   <p>English: <b>{en[r.phrase_id]||'?'}</b><br/>Phrase in {r.language}: {nat[r.language]?.[r.phrase_id]||'?'}</p>
   {r.audio_url?<><audio controls src={r.audio_url} style={{width:'100%'}}/>
    <p>Length: {r.duration_sec?.toFixed(1)}s vs expected {r.expected_sec?.toFixed(1)}s {ratio!=null&&<span className={short?'bad':'ok'}>({Math.round(ratio*100)}%{short?' TOO SHORT, reject and ask for the full sentence':''})</span>}</p>
    <p>Community votes: Yes {yes} · No {no} · not yet {v.length-done}<br/><b className={sug.includes('REJECT')?'bad':sug.includes('APPROVE')?'ok':''}>{sug}</b> (recommendation only, you decide)</p>
    <button className="b" onClick={()=>transcribe(r)}>Transcribe (beta)</button>{tx[r.id]!=null&&<i> {tx[r.id]||'(empty)'} (unreliable for Hausa, Yoruba, Igbo)</i>}</>:<p>Report only: {r.note||'(no note)'}</p>}
   <p>{r.note}</p><button className="b" disabled={short} onClick={()=>approve(r)}>Approve</button><button className="b r" onClick={()=>reject(r,prompt('Reason for the user (optional)','Record the FULL sentence'))}>Reject</button></div>})}
 <h2>Word pronunciation fixes</h2>{!dict.length&&<p>Nothing waiting.</p>}
 {dict.map(d=><div className="c" key={d.id}><b>{d.language}</b>: {d.word} → <b>{d.phonetic}</b><br/>
  <button className="b" onClick={async()=>{await sb.from('pronunciation_dictionary').update({status:'approved'}).eq('id',d.id);load()}}>Approve</button>
  <button className="b r" onClick={async()=>{await sb.from('pronunciation_dictionary').update({status:'rejected'}).eq('id',d.id);load()}}>Reject</button></div>)}</>}
const EMPTY={name:'',type:'Hospital',lat:'',lon:'',state:'',lga:'',phone:'',ownership:'Public',opening_hours:'',is_24hrs:false,has_emergency:false,has_ambulance:false,has_maternity:false};
function Hospitals(){const [q,setQ]=useState('');const [list,setList]=useState([]);const [f,setF]=useState(null);const [reps,setReps]=useState([]);const [rid,setRid]=useState(null);
 const load=async()=>{let a=sb.from('hospitals').select('*').order('name').limit(40);if(q)a=a.ilike('name','%'+q+'%');setList((await a).data||[]);setReps((await sb.from('reports').select('*').eq('status','new').limit(50)).data||[])};
 useEffect(()=>{load()},[]);
 const save=async()=>{const {id,...rest}=f;const row={...rest,lat:+rest.lat,lon:+rest.lon};const r=id?await sb.from('hospitals').update(row).eq('id',id):await sb.from('hospitals').insert(row);
  if(r.error)return alert(r.error.message);if(rid)await sb.from('reports').update({status:'resolved'}).eq('id',rid);setF(null);setRid(null);load()};
 const set=(k,v)=>setF({...f,[k]:v});
 return<><h2>Hospitals</h2><input placeholder="Search name" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()}/>
 <button className="b" onClick={load}>Search</button><button className="b" onClick={()=>{setRid(null);setF({...EMPTY})}}>+ Add hospital</button>
 {f&&<div className="c">{['name','type','lat','lon','state','lga','phone','ownership','opening_hours'].map(k=><div key={k}>{k==='state'?<select value={f.state||''} onChange={e=>set('state',e.target.value)}><option value="">State</option>{STATES.map(s=><option key={s[0]}>{s[0]}</option>)}</select>:<input placeholder={k} value={f[k]??''} onChange={e=>set(k,e.target.value)}/>}</div>)}
  {['is_24hrs','has_emergency','has_ambulance','has_maternity'].map(k=><label key={k} style={{marginRight:12}}><input type="checkbox" style={{width:'auto'}} checked={!!f[k]} onChange={e=>set(k,e.target.checked)}/> {k}</label>)}
  <br/><button className="b" onClick={save}>Save</button><button className="b r" onClick={()=>setF(null)}>Cancel</button></div>}
 {list.map(h=><div className="c" key={h.id}><b>{h.name}</b> · {h.type} · {h.state}<br/><button className="b" onClick={()=>{setRid(null);setF(h)}}>Edit</button>
  <button className="b r" onClick={async()=>{if(confirm('Delete '+h.name+'?')){await sb.from('hospitals').delete().eq('id',h.id);load()}}}>Delete</button></div>)}
 <h2>Reports and suggestions</h2>{!reps.length&&<p>None.</p>}
 {reps.map(r=><div className="c" key={r.id}><b>{r.kind==='new'?'New hospital':'Wrong info'}: {r.name}</b><br/>{r.message}<br/>{r.contact&&<small>Contact: {r.contact}</small>}<br/>
  {r.kind==='new'&&<button className="b" onClick={()=>{setRid(r.id);setF({...EMPTY,name:r.name,lat:r.lat??'',lon:r.lon??''})}}>Approve as new hospital</button>}
  <button className="b r" onClick={async()=>{await sb.from('reports').update({status:'resolved'}).eq('id',r.id);load()}}>Resolve / dismiss</button></div>)}</>}
function Users(){const [rows,setRows]=useState([]);
 const load=async()=>setRows((await sb.from('profiles').select('*').order('last_seen',{ascending:false}).limit(200)).data||[]);useEffect(()=>{load()},[]);
 return<><h2>Users</h2>{rows.map(u=><div className="c" key={u.id}><b>{u.name||u.email||u.id.slice(0,8)}</b> {u.role==='admin'&&<span className="ok">ADMIN</span>} {u.blocked&&<span className="bad">BLOCKED</span>}<br/>
  <small>{u.language||'no language'} · {u.state||'no state'} · last seen {u.last_seen?new Date(u.last_seen).toLocaleDateString():'?'}</small><br/>
  {u.role!=='admin'&&<button className={'b'+(u.blocked?'':' r')} onClick={async()=>{await sb.from('profiles').update({blocked:!u.blocked}).eq('id',u.id);load()}}>{u.blocked?'Unblock':'Block spam user'}</button>}</div>)}</>}

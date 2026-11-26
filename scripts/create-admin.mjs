// One time: creates the single admin account. Run on your own computer.
// SUPABASE_URL=... SUPABASE_SERVICE_KEY=... ADMIN_PASSWORD='the password you were given' node scripts/create-admin.mjs
import {createClient} from '@supabase/supabase-js';
const {SUPABASE_URL,SUPABASE_SERVICE_KEY,ADMIN_PASSWORD}=process.env,EMAIL='musadennizy@gmail.com';
if(!SUPABASE_URL||!SUPABASE_SERVICE_KEY||!ADMIN_PASSWORD)throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD');
const sb=createClient(SUPABASE_URL,SUPABASE_SERVICE_KEY);
let {data,error}=await sb.auth.admin.createUser({email:EMAIL,password:ADMIN_PASSWORD,email_confirm:true});
if(error&&/already|registered/i.test(error.message)){const l=await sb.auth.admin.listUsers({perPage:1000});const u=l.data.users.find(x=>x.email===EMAIL);await sb.auth.admin.updateUserById(u.id,{password:ADMIN_PASSWORD});data={user:u}}else if(error)throw error;
await sb.from('profiles').update({role:'user'}).eq('role','admin').neq('id',data.user.id);
const r=await sb.from('profiles').upsert({id:data.user.id,email:EMAIL,role:'admin'});if(r.error)throw r.error;
console.log('Admin ready:',EMAIL,'- log in at /admin/login and change the password.');

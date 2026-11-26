create table if not exists hospitals(
 id bigint generated always as identity primary key, name text not null, type text, lat double precision not null, lon double precision not null,
 state text, lga text, services text, phone text, is_24hrs boolean default false, ownership text, operational_status text,
 has_emergency boolean default false, has_ambulance boolean default false, has_maternity boolean default false, opening_hours text, address text);
create index if not exists hospitals_geo on hospitals(lat,lon);
create index if not exists hospitals_state on hospitals(state);
create table if not exists reports(id bigint generated always as identity primary key, kind text, hospital_key text, name text, message text, lat double precision, lon double precision, contact text, created_at timestamptz default now());
create table if not exists favourites(id bigint generated always as identity primary key, device_id text, hospital_key text, name text, unique(device_id,hospital_key));
alter table hospitals enable row level security; alter table reports enable row level security; alter table favourites enable row level security;
create policy "read hospitals" on hospitals for select using (true);
create policy "insert reports" on reports for insert with check (true);
create policy "fav insert" on favourites for insert with check (true);
create policy "fav read" on favourites for select using (true);
create policy "fav delete" on favourites for delete using (true);
-- Then: Table Editor > hospitals > Import data from CSV > data/hospitals.csv

-- ===== Accounts and roles (enable Auth > Providers > Anonymous, and Email, in Supabase) =====
create table if not exists profiles(id uuid primary key references auth.users on delete cascade, email text, name text, state text, language text,
 role text not null default 'user' check (role in ('user','admin')), blocked boolean not null default false, last_seen timestamptz default now(), created_at timestamptz default now());
create unique index if not exists one_admin on profiles(role) where role='admin';   -- only ONE admin can exist
create or replace function public.my_role() returns text language sql security definer stable set search_path=public as $$ select role from profiles where id=auth.uid() $$;
create or replace function public.my_blocked() returns boolean language sql security definer stable set search_path=public as $$ select coalesce((select blocked from profiles where id=auth.uid()),false) $$;
create or replace function public.is_admin() returns boolean language sql security definer stable set search_path=public as $$ select coalesce((select role='admin' from profiles where id=auth.uid()),false) $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into profiles(id,email) values(new.id,new.email) on conflict do nothing; return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
alter table profiles enable row level security;
create policy "read own profile" on profiles for select using (id=auth.uid() or is_admin());
create policy "update own profile" on profiles for update using (id=auth.uid()) with check (id=auth.uid() and role=my_role() and blocked=my_blocked());  -- users cannot make themselves admin or unblock themselves
create policy "admin updates profiles" on profiles for update using (is_admin()) with check (is_admin());

-- ===== Voice system =====
create table if not exists app_config(key text primary key, value text);
insert into app_config values('voice_version','1') on conflict do nothing;
create table if not exists voice_clips(phrase_id text, language text, audio_url text, version int, primary key(phrase_id,language));
create table if not exists voice_corrections(id bigint generated always as identity primary key, phrase_id text, language text, audio_url text, user_id uuid default auth.uid(),
 status text default 'pending', kind text default 'recording', note text, duration_sec real, expected_sec real, admin_note text, created_at timestamptz default now());
create table if not exists correction_votes(id bigint generated always as identity primary key, correction_id bigint references voice_corrections(id) on delete cascade,
 voter_id uuid references profiles(id) on delete cascade, vote boolean, voted_at timestamptz, unique(correction_id,voter_id));
create table if not exists pronunciation_dictionary(id bigint generated always as identity primary key, language text, word text, phonetic text, status text default 'pending', submitted_by uuid default auth.uid(), created_at timestamptz default now());
alter table app_config enable row level security; alter table voice_clips enable row level security; alter table voice_corrections enable row level security;
alter table correction_votes enable row level security; alter table pronunciation_dictionary enable row level security;
create policy "read voice version" on app_config for select using (key='voice_version');
create policy "admin sets voice version" on app_config for update using (is_admin()) with check (is_admin());
create policy "read clips" on voice_clips for select using (true);
create policy "admin adds clips" on voice_clips for insert with check (is_admin());
create policy "admin updates clips" on voice_clips for update using (is_admin()) with check (is_admin());
create policy "submit corrections" on voice_corrections for insert to authenticated with check (user_id=auth.uid() and status='pending' and not my_blocked());
create policy "admin corrections" on voice_corrections for all using (is_admin()) with check (is_admin());
create policy "admin reads votes" on correction_votes for select using (is_admin());   -- voters only use the two functions below
create policy "read approved words" on pronunciation_dictionary for select using (status='approved' or is_admin());
create policy "submit words" on pronunciation_dictionary for insert to authenticated with check (status='pending' and submitted_by=auth.uid() and not my_blocked());
create policy "admin updates words" on pronunciation_dictionary for update using (is_admin()) with check (is_admin());
create policy "admin deletes words" on pronunciation_dictionary for delete using (is_admin());
-- Each new recording gets 3 random active voters who use the same language (not the submitter, not blocked, seen in last 30 days)
create or replace function public.assign_voters() returns trigger language plpgsql security definer set search_path=public as $$ begin
 insert into correction_votes(correction_id,voter_id) select new.id,p.id from profiles p where p.language=new.language and p.id<>new.user_id and not p.blocked and p.last_seen>now()-interval '30 days' order by random() limit 3;
 return new; end $$;
drop trigger if exists voters_after_insert on voice_corrections;
create trigger voters_after_insert after insert on voice_corrections for each row when (new.audio_url is not null) execute function public.assign_voters();
create or replace function public.my_pending_votes() returns table(vote_id bigint, phrase_id text, language text, audio_url text) language sql security definer set search_path=public as $$
 select v.id,c.phrase_id,c.language,c.audio_url from correction_votes v join voice_corrections c on c.id=v.correction_id where v.voter_id=auth.uid() and v.vote is null and c.status='pending' and not my_blocked() limit 1 $$;
create or replace function public.cast_vote(p_vote_id bigint, p_yes boolean) returns void language sql security definer set search_path=public as $$
 update correction_votes set vote=p_yes, voted_at=now() where id=p_vote_id and voter_id=auth.uid() and vote is null $$;
insert into storage.buckets(id,name,public) values('voice-clips','voice-clips',true) on conflict do nothing;
drop policy if exists "anon upload pending corrections" on storage.objects;
create policy "users upload pending" on storage.objects for insert to authenticated with check (bucket_id='voice-clips' and name like 'pending/%' and not my_blocked());
create policy "admin manages clips" on storage.objects for all to authenticated using (bucket_id='voice-clips' and is_admin()) with check (bucket_id='voice-clips' and is_admin());

-- ===== Hospitals / reports: admin control =====
alter table reports add column if not exists status text default 'new';
drop policy if exists "insert reports" on reports;
create policy "signed in users report" on reports for insert to authenticated with check (not my_blocked());
create policy "admin reads reports" on reports for select using (is_admin());
create policy "admin updates reports" on reports for update using (is_admin()) with check (is_admin());
create policy "admin adds hospitals" on hospitals for insert with check (is_admin());
create policy "admin edits hospitals" on hospitals for update using (is_admin()) with check (is_admin());
create policy "admin deletes hospitals" on hospitals for delete using (is_admin());

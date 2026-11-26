# NaijaCare - Voice Emergency Hospital Finder (v1.0.0, com.naijacare.app)
One codebase, one Netlify deploy: `/` is the user app, `/admin` is the hidden dashboard (no link to it exists in the user app).

## Deploy to Netlify in 5 minutes
1. Push to GitHub. 2. Netlify > Add new site > Import from Git. 3. Add the "Browser" variables from `.env.example`. 4. Deploy.

## Supabase setup (required for admin, voting and corrections)
1. SQL Editor: run `supabase/schema.sql`. Read any error it prints; I could not run it against a live database.
2. Authentication > Providers: enable **Anonymous** (every phone gets a user id) and **Email**.
3. Table Editor > `hospitals` > import `data/hospitals.csv` (small approximate seed; the app also reads live OpenStreetMap data).
4. Create the one admin (on your computer): `SUPABASE_URL=... SUPABASE_SERVICE_KEY=... ADMIN_PASSWORD='<password given to you>' node scripts/create-admin.mjs`. Then open `/admin/login`, log in with musadennizy@gmail.com and use "Change password" immediately.

## Dashboard (`/admin`, only the admin)
Protection is Supabase Auth plus database rules (RLS, `is_admin()`), not the hidden link. A unique index allows only one `role='admin'` row. Anyone else sees "Access Denied" and the database refuses their reads and writes.
- `/admin` stats. `/admin/corrections` approve/reject recordings and word fixes. `/admin/hospitals` add, edit, delete, approve user suggestions. `/admin/users` view users, block spam. `/admin/login`.
- Corrections show the English meaning of the phrase (from the phrase table, so no language knowledge is needed), recording length vs expected length, the community vote and a suggestion (2 or 3 Yes = approve, otherwise reject). You decide. Approve is disabled when a recording is under 70% of expected length.
- "Transcribe (beta)" runs open Whisper in your browser for a rough transcript. It is unreliable for Hausa, Yoruba and Igbo and is information only. N-ATLAS ASR was not integrated because I could not verify an API for it.

## Voice system (100% free, no voice API)
Per phrase: **1. approved human correction > 2. Meta MMS TTS > 3. phone voice.** If nothing can speak Hausa/Yoruba/Igbo the app shows text and a notice; it never uses an English voice for them.
- A phrase is one complete sentence with a snapped distance (e.g. `tl_200` = "Turn left in 200 metres"), stored as ONE audio file per language (330 phrases: 66 x 5 languages, listed in `AUDIO_SCRIPT.csv`). Playback is one voice per phrase, never spliced. Distances beyond 30 km are announced as 30 km.
- MMS clips are generated on your computer: `node scripts/audio-script.mjs`, `python scripts/pregen_mms.py`, then `node scripts/upload-clips.mjs`. Phones download and cache them, then work offline. Spoken sentences with hospital names need the optional on-phone engine (Settings > Download offline voice engine, large, off by default). Those are cached per phone only, not shared, so nobody can poison a shared cache.
- **Word Pronunciation Fix:** users submit a word and phonetic spelling (Nnewi -> Neh-weh). After you approve it, it is stored in `pronunciation_dictionary` and applied to on-phone MMS synthesis for all phrases. Pre-generated clips pick it up when you re-run `pregen_mms.py` (it reads the approved list if you set SUPABASE_URL and SUPABASE_ANON_KEY). Human recordings are never changed by the dictionary.
- **Corrections:** "Voice No Correct? Fix Am" is on the map route and navigation panels. Users hold to record the FULL phrase. The app measures length and blocks anything under 70% of the expected length ("Too short, record FULL sentence"). This client-side check can be bypassed, so the dashboard re-flags and blocks approval. The recording goes to `voice-clips/pending/...` and `voice_corrections`.
- **Community vote, in-app only:** a database trigger picks 3 random users with the same language (seen in the last 30 days, not blocked, not the submitter). On their next app open they get one card: Play, Yes Correct, No Not Correct. Voters never see the dashboard. If fewer than 3 such users exist, fewer votes arrive and the dashboard says so. Anonymous devices can be faked by one person, which is why the vote is only a recommendation.
- Approval copies the audio to a live path, bumps `voice_version`, and every phone downloads it in the background on its next open. No redeploy.
- After submitting the user sees "Thanks, your voice go help others".

### Read before launch
- **Licence:** MMS-TTS weights are CC-BY-NC 4.0: non-commercial use only.
- **Models (untested downloads):** ONNX ports exist for English and Yoruba (`Xenova/mms-tts-eng`, `-yor`). Hausa and Igbo ONNX ports were not confirmed, and no Pidgin MMS model was found (Pidgin text is read by the English model). `pregen_mms.py` uses the original `facebook/mms-tts-hau` / `-ibo` checkpoints and skips any it cannot load. For in-app Hausa/Igbo you must convert and host the models and set `VITE_MMS_HAU`, `VITE_MMS_IBO`, `VITE_MODEL_HOST`.
- MMS voices are single speaker and robotic, and tone marks may be lost in Yoruba and Igbo.
- Speech input: Web Speech API, then open Whisper on the phone. Whisper has no Igbo model; typing always works.

## Voice setup screen
First open checks phone voices for English, Hausa, Yoruba and Igbo. On the APK the button opens Android's Text-to-speech settings via a native plugin: after `npx cap add android` copy `native/android/*.java` into `android/app/src/main/java/com/naijacare/app/` (overwrite MainActivity.java), then `npm run cap:sync`. iOS and the PWA show Settings > Accessibility > Spoken Content > Voices. It re-checks on return and shows "Voice Ready ✅". Also in Settings > Check voices.

## Build the APK (no Play Store)
```
npm install && npm run build
npx cap add android
npx @capacitor/assets generate --android
npm run cap:sync && npx cap open android      # Build > Build APK(s)
```
Add INTERNET, ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, RECORD_AUDIO, CALL_PHONE, WAKE_LOCK permissions to AndroidManifest.xml and set minSdkVersion 26.

## Share on WhatsApp
Send the Netlify link. Android Chrome: menu > Install app. iPhone: Safari > Share > Add to Home Screen.

## Known limits
Spoken Hausa/Yoruba/Igbo needs a phone voice or MMS clips; translations in `src/i18n.js` (about 80 phrases) need native speaker review; locked screen guidance needs a native foreground service plugin (the app only keeps the screen awake); no hospital photos, ratings or reviews; check emergency numbers in `CONTACTS` in `src/App.jsx`.

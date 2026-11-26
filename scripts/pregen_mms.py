"""Pre-generate every navigation clip with Meta MMS-TTS on YOUR computer (free, CC-BY-NC 4.0 weights, non-commercial only).
Needs: pip install torch transformers scipy ; ffmpeg on PATH.   Run: node scripts/audio-script.mjs && python scripts/pregen_mms.py
Then upload: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/upload-clips.mjs
Pidgin is read by the English model (no Pidgin MMS model). Missing models are skipped with a message."""
import csv, os, re, json, subprocess, urllib.request, torch, scipy.io.wavfile as wf
from transformers import VitsModel, AutoTokenizer
MODELS = {'en': 'facebook/mms-tts-eng', 'pcm': 'facebook/mms-tts-eng', 'ha': 'facebook/mms-tts-hau', 'yo': 'facebook/mms-tts-yor', 'ig': 'facebook/mms-tts-ibo'}
loaded = {}
dic = {}  # approved Word Pronunciation Fixes (optional): set SUPABASE_URL and SUPABASE_ANON_KEY
if os.environ.get('SUPABASE_URL') and os.environ.get('SUPABASE_ANON_KEY'):
    k = os.environ['SUPABASE_ANON_KEY']
    req = urllib.request.Request(os.environ['SUPABASE_URL'] + '/rest/v1/pronunciation_dictionary?status=eq.approved&select=language,word,phonetic', headers={'apikey': k, 'Authorization': 'Bearer ' + k})
    for d in json.load(urllib.request.urlopen(req)): dic.setdefault(d['language'], []).append((d['word'], d['phonetic']))
def fix(l, t):
    for w, p in dic.get(l, []): t = re.sub(r'\b' + re.escape(w) + r'\b', p, t, flags=re.I)
    return t
for r in csv.DictReader(open('AUDIO_SCRIPT.csv', encoding='utf-8')):
    l = r['lang']
    if l not in loaded:
        try: loaded[l] = (VitsModel.from_pretrained(MODELS[l]), AutoTokenizer.from_pretrained(MODELS[l]))
        except Exception as e: print('SKIP', l, e); loaded[l] = None
    if not loaded[l]: continue
    m, t = loaded[l]; torch.manual_seed(555)
    with torch.no_grad(): wav = m(**t(fix(l, r['text']), return_tensors='pt')).waveform[0].numpy()
    out = os.path.join('audio-source', l); os.makedirs(out, exist_ok=True)
    wf.write('tmp.wav', m.config.sampling_rate, wav)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', 'tmp.wav', '-b:a', '48k', os.path.join(out, os.path.basename(r['file']))], check=True)
    print(l, r['file'])

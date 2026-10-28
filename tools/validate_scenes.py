#!/usr/bin/env python3
"""
Periksa public/<video>/scenes.src.json sebelum render (mis. hasil Gemini).
    python3 tools/validate_scenes.py video2
Keluar dengan kode 1 bila ada KESALAHAN (Action berhenti); peringatan tidak menghentikan.
"""
import difflib, json, os, re, sys

name = sys.argv[1] if len(sys.argv) > 1 else 'video1'
D = f'public/{name}'
try:
    d = json.load(open(f'{D}/scenes.src.json', encoding='utf-8'))
except FileNotFoundError:
    sys.exit(f'GAGAL: {D}/scenes.src.json tidak ditemukan')
except json.JSONDecodeError as e:
    sys.exit(f'GAGAL: scenes.src.json bukan JSON valid: {e}')

BG = {'dawn', 'dusk', 'room', 'stage', 'night', 'day', 'office'}
PROP = {'bulb', 'confetti', 'crowd', 'fork', 'laptop', 'money', 'orb', 'phone', 'shadow', 'think', 'trophy'}
POSE = {'idle', 'point', 'shock', 'sad', 'cheer', 'wave', 'walk', 'tremble', 'think'}
CARD = {'list', 'stat', 'bars', 'tool'}
CT = {'girl', 'boss', 'robot', 'block', 'sprite'}
STYLE = {'stick', 'robot', 'block', 'sprite'}
err, warn = [], []
sc = d.get('scenes')
if not isinstance(sc, list) or not sc: sys.exit('GAGAL: "scenes" kosong atau bukan array')
if d.get('style', 'stick') not in STYLE: err.append(f"style '{d.get('style')}' tidak dikenal")

for i, s in enumerate(sc):
    for k in ('title', 'start', 'accent', 'bg', 'chars'):
        if k not in s: err.append(f'adegan {i}: field "{k}" hilang')
    if not isinstance(s.get('title', ''), str) or not s.get('title', '').strip(): err.append(f'adegan {i}: title kosong')
    if not re.match(r'^#[0-9a-fA-F]{6}$', str(s.get('accent', ''))): err.append(f'adegan {i}: accent harus #RRGGBB')
    bg = str(s.get('bg', ''))
    if bg not in BG and not re.search(r'[./]', bg): err.append(f"adegan {i}: bg '{bg}' tidak dikenal")
    if re.search(r'[./]', bg) and not os.path.exists(f'{D}/{bg}'): warn.append(f"adegan {i}: file latar '{bg}' belum ada di {D}/")
    if s.get('prop') and s['prop'] not in PROP: err.append(f"adegan {i}: prop '{s['prop']}' tidak dikenal")
    card = s.get('card')
    if card:
        if card.get('type') not in CARD: err.append(f"adegan {i}: card type '{card.get('type')}' tidak dikenal")
        if s.get('chars'): err.append(f'adegan {i}: kartu dan karakter tidak boleh bersamaan (chars harus [])')
    for c in s.get('chars') or []:
        if c.get('pose') not in POSE: err.append(f"adegan {i}: pose '{c.get('pose')}' tidak dikenal")
        if c.get('type', 'girl') not in CT: err.append(f"adegan {i}: tipe karakter '{c.get('type')}' tidak dikenal")
        if not isinstance(c.get('x'), (int, float)) or not 100 <= c['x'] <= 980: err.append(f'adegan {i}: x karakter harus 100-980')
        if c.get('pose') == 'walk' and 'walkTo' not in c: warn.append(f'adegan {i}: pose walk tanpa walkTo')
    for v in s.get('visuals') or []:
        if not isinstance(v, dict) or not v.get('word'): err.append(f'adegan {i}: visuals harus berisi {{word,en,emoji}}')
        elif norm_w := re.sub(r'[^a-z0-9]', '', v['word'].lower()):
            if not any(re.sub(r'[^a-z0-9]', '', w.lower()).startswith(norm_w) for w in s['title'].replace('*', '').split()):
                warn.append(f"adegan {i}: visuals.word '{v['word']}' tidak ada di title (gambar akan muncul di awal adegan)")
    if i and isinstance(s.get('start'), (int, float)) and isinstance(sc[i - 1].get('start'), (int, float)):
        if s['start'] <= sc[i - 1]['start']: err.append(f'adegan {i}: start harus naik terus')
        elif s['start'] - sc[i - 1]['start'] < 1.0: warn.append(f'adegan {i}: jarak start < 1 dtk (prepare.py akan memaksa min 0.8 dtk)')

# kesesuaian teks dengan SRT (prepare.py mencocokkan kata persis)
srt_path = f'{D}/voiceover.srt'
if os.path.exists(srt_path):
    norm = lambda w: re.sub(r'[^a-z0-9]', '', w.lower())
    srt = open(srt_path, encoding='utf-8').read().replace('\r', '')
    words = []
    for blk in re.split(r'\n\s*\n', srt.strip()):
        ln = blk.split('\n'); i0 = next((k for k, l in enumerate(ln) if '-->' in l), None)
        if i0 is None: continue
        words += [norm(w) for l in ln[i0 + 1:] for w in l.split()]
    mine = [norm(w) for s in sc for w in str(s.get('title', '')).replace('*', '').split()]
    words, mine = [w for w in words if w], [w for w in mine if w]
    r = difflib.SequenceMatcher(None, words, mine, autojunk=False).ratio()
    print(f'kemiripan teks vs SRT: {r:.1%} ({len(mine)} kata di layar, {len(words)} kata di SRT)')
    if r < 0.97: err.append('teks adegan menyimpang dari SRT: kata harus persis sama dan berurutan (minta Gemini memperbaiki)')
    elif r < 0.995: warn.append('ada sedikit selisih kata dengan SRT (masih ditoleransi, kata yang beda akan diinterpolasi)')
else:
    warn.append('voiceover.srt tidak ada: kecocokan teks tidak dicek')

for w in warn: print('peringatan:', w)
for e in err: print('KESALAHAN:', e)
print(f'{len(sc)} adegan, {len(err)} kesalahan, {len(warn)} peringatan')
print('OK, siap prepare.py' if not err else 'GAGAL: perbaiki dulu scenes.src.json')
sys.exit(1 if err else 0)

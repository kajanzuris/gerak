#!/usr/bin/env python3
"""
Periksa public/<video>/scenes.src.json sebelum render (mis. hasil Gemini).
    python3 tools/validate_scenes.py video2
Keluar dengan kode 1 bila ada KESALAHAN (Action berhenti); peringatan tidak menghentikan.
Mendukung style lama (stick/robot/block/sprite) dan style baru "explainer".
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
STYLE = {'stick', 'robot', 'block', 'sprite', 'explainer'}
STAGE = {'window', 'compare', 'tree', 'files', 'dialog', 'callout', 'list', 'stat', 'image'}
ROW = {'bubble', 'check', 'input', 'note', 'buttons', 'files'}
MASCOT = {'left', 'center', 'right'}
err, warn = [], []
sc = d.get('scenes')
if not isinstance(sc, list) or not sc: sys.exit('GAGAL: "scenes" kosong atau bukan array')
style = d.get('style', 'stick')
if style not in STYLE: err.append(f"style '{style}' tidak dikenal")
EX = style == 'explainer'

def title_words(s): return [re.sub(r'[^a-z0-9]', '', w.lower()) for w in str(s.get('title', '')).replace('*', '').split()]

def check_at(i, where, at, s):
    if isinstance(at, str):
        k = re.sub(r'[^a-z0-9]', '', at.lower())
        if k and not any(w.startswith(k) for w in title_words(s)):
            warn.append(f"adegan {i}: {where}.at '{at}' bukan kata di title (akan muncul di awal adegan)")
    elif at is not None and not isinstance(at, (int, float)):
        err.append(f'adegan {i}: {where}.at harus kata (string) atau detik (angka)')

for i, s in enumerate(sc):
    for k in (('title', 'start') if EX else ('title', 'start', 'accent', 'bg', 'chars')):
        if k not in s: err.append(f'adegan {i}: field "{k}" hilang')
    if not isinstance(s.get('title', ''), str) or not s.get('title', '').strip(): err.append(f'adegan {i}: title kosong')

    if EX:
        n = len(title_words(s))
        sm = s.get('small', 0)
        if not isinstance(sm, int) or sm < 0 or sm > n: err.append(f'adegan {i}: small harus bilangan 0..{n} (jumlah kata baris kecil)')
        if isinstance(sm, int) and (sm > 3 or sm > n - 2) and sm > 0: warn.append(f'adegan {i}: small={sm} terlalu besar (maks 3 dan sisakan >=2 kata untuk judul besar); renderer akan mengabaikannya')
        if not s.get('stage'): warn.append(f'adegan {i}: stage kosong (hanya teks); pakai sesekali saja')
        if s.get('mascot') is not None and s['mascot'] not in MASCOT: err.append(f"adegan {i}: mascot '{s['mascot']}' harus left/center/right")
        if s.get('pose') is not None and s['pose'] not in POSE: err.append(f"adegan {i}: pose '{s['pose']}' tidak dikenal")
        for j, b in enumerate(s.get('stage') or []):
            if b.get('type') not in STAGE: err.append(f"adegan {i}: stage[{j}] type '{b.get('type')}' tidak dikenal")
            check_at(i, f'stage[{j}]', b.get('at'), s)
            if b.get('type') == 'window':
                if not b.get('rows'): err.append(f'adegan {i}: stage[{j}] window butuh rows')
                for r_i, r in enumerate(b.get('rows') or []):
                    if r.get('k') not in ROW: err.append(f"adegan {i}: stage[{j}].rows[{r_i}] k '{r.get('k')}' tidak dikenal")
                    check_at(i, f'stage[{j}].rows[{r_i}]', r.get('at'), s)
            if b.get('type') == 'image':
                src = b.get('src')
                if not src: err.append(f'adegan {i}: stage[{j}] image butuh src')
                elif not os.path.exists(f'{D}/{src}'): err.append(f"adegan {i}: file gambar '{src}' belum ada di {D}/ (upload ke folder itu, nama harus persis)")
            if b.get('type') == 'compare' and not (b.get('left') and b.get('right')): err.append(f'adegan {i}: stage[{j}] compare butuh left dan right')
            if b.get('type') == 'tree' and not b.get('cols'): err.append(f'adegan {i}: stage[{j}] tree butuh cols')
    else:
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

if EX:
    if d.get('charStyle') == 'sprite':
        for k in ('charImg', 'charTalkImg'):
            if d.get(k) and not os.path.exists(f'{D}/{d[k]}'): err.append(f"file karakter '{d[k]}' belum ada di {D}/ (upload PNG transparan ke folder itu)")
        if not d.get('charImg'): err.append('charStyle sprite butuh charImg')
    for n in d.get('backgrounds') or []:
        if n not in {'cream', 'mint', 'sky', 'sunset', 'paper', 'grid', 'dark', 'navy'}: err.append(f"background '{n}' tidak dikenal")
    for n in d.get('transitions') or []:
        if n not in {'fade', 'slide-left', 'slide-up', 'zoom', 'wipe', 'none'}: err.append(f"transisi '{n}' tidak dikenal")

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

if not os.path.exists(f'{D}/voiceover.mp3'): err.append(f'{D}/voiceover.mp3 tidak ada (video akan bisu)')

for w in warn: print('peringatan:', w)
for e in err: print('KESALAHAN:', e)
print(f'{len(sc)} adegan, {len(err)} kesalahan, {len(warn)} peringatan')
print('OK, siap prepare.py' if not err else 'GAGAL: perbaiki dulu scenes.src.json')
sys.exit(1 if err else 0)

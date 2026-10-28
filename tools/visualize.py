#!/usr/bin/env python3
"""
Tambahkan gambar objek (kucing, ikan, dst.) ke public/<video>/scenes.src.json.

    python3 tools/visualize.py video2

Sumber daftar objek, berurutan:
  1. field "visuals" per adegan (dari Gemini)        -> tanpa API
  2. Claude API bila ANTHROPIC_API_KEY ada (opsional) -> untuk adegan tanpa "visuals"
  3. KAMUS kecil di bawah                             -> cadangan terakhir
Gambar diambil dari Twemoji -> OpenMoji -> Iconify, disimpan di tools/.piccache/ lalu disalin ke public/<video>/pics/.
Adegan yang sudah punya "pics" tidak diproses ulang (edit manual aman). Tidak ada yang gagal total: gambar yang tak ketemu dilewati.
"""
import json, os, re, sys, urllib.parse, urllib.request

name = sys.argv[1] if len(sys.argv) > 1 else 'video1'
D = f'public/{name}'; SRC = f'{D}/scenes.src.json'; CACHE = 'tools/.piccache'
os.makedirs(CACHE, exist_ok=True); os.makedirs(f'{D}/pics', exist_ok=True)
data = json.load(open(SRC, encoding='utf-8')); scenes = data['scenes']

# cadangan tanpa LLM: awalan kata -> (nama Inggris, emoji). Tambah sesukamu.
KAMUS = {'kucing': ('cat', '🐱'), 'ikan': ('fish', '🐟'), 'anjing': ('dog', '🐶'), 'burung': ('bird', '🐦'),
         'rumah': ('house', '🏠'), 'uang': ('money', '💰'), 'hati': ('heart', '❤️'), 'ide': ('idea', '💡'),
         'buku': ('book', '📖'), 'waktu': ('clock', '⏰'), 'mobil': ('car', '🚗'), 'makan': ('food', '🍽️'),
         'takut': ('fear', '😨'), 'bunga': ('flower', '🌸'), 'matahari': ('sun', '☀️'), 'hujan': ('rain', '🌧️'),
         'api': ('fire', '🔥'), 'kopi': ('coffee', '☕'), 'laptop': ('laptop', '💻'), 'ponsel': ('phone', '📱')}

def plain(t): return re.sub(r'\*', '', t)

def ask_llm(titles):
    import anthropic
    prompt = ("Berikut narasi video per adegan (bahasa Indonesia). Untuk TIAP adegan pilih 0-2 objek/hewan/benda "
              "konkret (atau emosi yang jelas) yang layak ditampilkan sebagai gambar saat kata itu diucapkan.\n"
              "Balas HANYA JSON array sepanjang jumlah adegan; tiap elemen = array objek "
              '{"word": kata persis dari narasi, "en": kata benda Inggris untuk cari ikon, "emoji": 1 emoji}. '
              "Adegan tanpa objek visual -> [].\n\n" + json.dumps(titles, ensure_ascii=False))
    msg = anthropic.Anthropic().messages.create(model=os.environ.get('VIS_MODEL', 'claude-haiku-5-5'),
                                                max_tokens=4000, messages=[{'role': 'user', 'content': prompt}])
    return json.loads(re.search(r'\[.*\]', msg.content[0].text, re.S).group(0))

def fallback(titles):
    out = []
    for t in titles:
        hits = []
        for w in re.findall(r'\w+', t.lower()):
            for k, (en, em) in KAMUS.items():
                if w.startswith(k) and len(hits) < 2 and all(h['en'] != en for h in hits):
                    hits.append(dict(word=w, en=en, emoji=em))
        out.append(hits)
    return out

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'vectorstory'}), timeout=20).read()

def cps(e): return [f'{ord(c):x}' for c in e if ord(c) != 0xFE0F]

def twemoji(e):
    return get(f"https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/{'-'.join(cps(e))}.svg")

def openmoji(e):
    return get(f"https://cdn.jsdelivr.net/npm/openmoji@15.0.0/color/svg/{'-'.join(cps(e)).upper()}.svg")

def iconify(q):
    r = json.loads(get('https://api.iconify.design/search?limit=1&query=' + urllib.parse.quote(q)))
    pre, nm = r['icons'][0].split(':')
    return get(f'https://api.iconify.design/{pre}/{nm}.svg')

def fetch_pic(en, emoji):
    slug = re.sub(r'[^a-z0-9]+', '_', (en or emoji or 'pic').lower()).strip('_')
    if not slug.isascii() or not slug: slug = 'pic_' + '_'.join(cps(emoji)) if emoji else 'pic'
    cp = f'{CACHE}/{slug}.svg'
    if not os.path.exists(cp):
        svg = None
        for fn, arg in ((twemoji, emoji), (openmoji, emoji), (iconify, en)):
            if not arg: continue
            try:
                svg = fn(arg)
                if svg and b'<svg' in svg[:2000]: break
                svg = None
            except Exception as ex:
                print(f'  gagal {fn.__name__}({arg}): {ex}')
        if not svg: return None
        open(cp, 'wb').write(svg)
    open(f'{D}/pics/{slug}.svg', 'wb').write(open(cp, 'rb').read())
    return f'pics/{slug}.svg'

# "visuals" dari Gemini dipakai langsung; LLM/KAMUS hanya untuk adegan yang belum punya
given = {i: s.pop('visuals') for i, s in enumerate(scenes) if 'pics' not in s and s.get('visuals') is not None}
todo = [i for i, s in enumerate(scenes) if 'pics' not in s and i not in given]
res = []
if todo:
    titles = [plain(scenes[i]['title']) for i in todo]
    try:
        res = ask_llm(titles) if os.environ.get('ANTHROPIC_API_KEY') else fallback(titles)
        if len(res) != len(todo): raise ValueError('jumlah hasil LLM tidak sama')
    except Exception as ex:
        print('LLM tidak dipakai, pakai KAMUS:', ex); res = fallback(titles)

for i, items in list(zip(todo, res)) + list(given.items()):
    pics = []
    for it in (items or [])[:2]:
        if not isinstance(it, dict) or not it.get('word'): continue
        img = fetch_pic(it.get('en', ''), it.get('emoji', ''))
        if img: pics.append(dict(img=img, word=it['word'], anim='pop'))
        else: print(f"  adegan {i}: gambar untuk '{it['word']}' tidak ditemukan, dilewati")
    n = len(pics)
    for k, p in enumerate(pics): p['x'] = 540 if n == 1 else (300, 780)[k]
    scenes[i]['pics'] = pics            # [] = sudah diproses, tidak diulang
    print(f'adegan {i}:', [p['word'] for p in pics])

json.dump(data, open(SRC, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(f'selesai: {sum(len(s.get("pics", [])) for s in scenes)} gambar di {len(scenes)} adegan')

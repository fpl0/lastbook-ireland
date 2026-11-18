# Builds <LIB>/data/cd3wd.json: the CD3WD catalogue (every publication, its subject and its real title) for the
# app's native CD3WD shelf. Reads the archive through the running engine. Usage: build_cd3wd.py http://127.0.0.1:PORT
import concurrent.futures as cf, html, json, os, re, subprocess, sys, urllib.parse

BASE = sys.argv[1].rstrip("/")
LIB = os.path.expanduser("~/Library/Application Support/Lastbook Ireland")

def get(url):
    r = subprocess.run(["curl", "-s", "-L", "-m", "60", url], capture_output=True)
    b = r.stdout
    try: return b.decode("utf-8")
    except UnicodeDecodeError: return b.decode("cp1252", "replace")

books = json.loads(get(f"{BASE}/api/books"))
book = next(b["book"] for b in books if b["name"].startswith("cd3wd"))
root = f"/kiwix/content/{book}/www.cd3wdproject.org/CD3WD/"
index = get(BASE + root + "INDEX.HTM")
entries = []
for href, label in re.findall(r'<a\b[^>]*href="([^"#]+)"[^>]*>(.*?)</a>', index, re.I | re.S):
    label = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", label))).strip()
    if " - " not in label or href.startswith(("http", "mailto")): continue
    cat, code = label.split(" - ", 1)
    entries.append({"cat": cat.strip().title(), "code": code.strip(), "path": urllib.parse.urljoin(root, href)})

def title_of(e):
    page = get(BASE + e["path"])
    m = re.search(r"<title>(.*?)</title>", page, re.I | re.S)
    t = re.sub(r"\s+", " ", html.unescape(m.group(1))).strip() if m else ""
    if not t or t.lower().startswith("cd3wd"):
        t = e["code"].replace("_", " ")
    # "Neem: A Tree for Solving Global Problems (BOSTID, 1992, 127 p.)" -> title + details
    mm = re.match(r"(.*?)\s*\(([^()]*\d{4}[^()]*)\)\s*$", t)
    e["title"], e["meta"] = (mm.group(1).strip(), mm.group(2).strip()) if mm else (t, "")
    e["title"] = re.sub(r"\s*-\s*(Contents?|Coontents|Contenido|Table des mati[eè]res|Inhalt|Sommaire)\s*$", "", e["title"], flags=re.I)
    return e

with cf.ThreadPoolExecutor(12) as ex:
    out = list(ex.map(title_of, entries))
# subjects that occur only once or twice are really mis-split titles: file them under Miscellaneous
from collections import Counter
cnt = Counter(e["cat"] for e in out)
for e in out:
    if cnt[e["cat"]] < 3 or e["cat"].lower() == "miscell": e["cat"] = "Miscellaneous"
    e["cat"] = {"Sme/Small Business": "Small Business", "Vet Tech": "Veterinary", "Electric": "Electrical"}.get(e["cat"], e["cat"])
out.sort(key=lambda e: (e["cat"], e["title"].lower()))
os.makedirs(os.path.join(LIB, "data"), exist_ok=True)
json.dump({"book": book, "items": out}, open(os.path.join(LIB, "data", "cd3wd.json"), "w"), ensure_ascii=False)
cats = {}
for e in out: cats[e["cat"]] = cats.get(e["cat"], 0) + 1
print(len(out), "publications;", cats)

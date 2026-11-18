# Offline audit: for every library, open N random pages and every asset they reference.
# Reports per library: pages OK, internal assets missing from the archive, and assets that point at the internet
# (which the app blocks, so they would show as broken). Usage: audit_offline.py http://127.0.0.1:PORT [N]
import json, re, subprocess, sys, urllib.parse, collections, concurrent.futures as cf

BASE = sys.argv[1].rstrip("/"); N = int(sys.argv[2]) if len(sys.argv) > 2 else 30
LOCAL = re.compile(r"^(localhost|127\.0\.0\.1)(:\d+)?$")

def fetch(url, body=True):
    a = ["curl", "-s", "-L", "-m", "60", "-w", "\n@@%{http_code}@@%{url_effective}@@%{content_type}", url]
    if not body: a[1:1] = ["-o", "/dev/null"]
    r = subprocess.run(a, capture_output=True)
    out = r.stdout.decode("utf-8", "replace")
    page, _, meta = out.rpartition("\n@@")
    code, final, ct = (meta.split("@@") + ["", "", ""])[:3]
    return (page if body else ""), int(code or 0), final, ct

ASSET = re.compile(r"""<(img|script|source|video|audio|iframe|embed|track)\b[^>]*?\s(?:src|data-src)\s*=\s*["']([^"']+)["']""", re.I)
CSS = re.compile(r"""<link\b[^>]*rel=["']?(?:stylesheet|icon|preload)[^>]*?href=["']([^"']+)["']|<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']?stylesheet""", re.I)
SRCSET = re.compile(r"""srcset=["']([^"']+)["']""", re.I)
CSSURL = re.compile(r"""url\(\s*['"]?([^'")]+)['"]?\s*\)""", re.I)

def assets(html, page_url):
    out = []
    for tag, u in ASSET.findall(html): out.append((tag.lower(), u))
    for a, b in CSS.findall(html): out.append(("css", a or b))
    for s in SRCSET.findall(html):
        for part in s.split(","):
            u = part.strip().split(" ")[0]
            if u: out.append(("img", u))
    for u in CSSURL.findall(html): out.append(("css-url", u))
    res = []
    for kind, u in out:
        u = u.strip()
        if not u or u.startswith(("data:", "blob:", "javascript:", "#", "about:")): continue
        res.append((kind, urllib.parse.urljoin(page_url, u)))
    return res

def audit_book(b):
    bk = b["book"]; pages_ok = pages_bad = 0
    missing = collections.Counter(); external = collections.Counter(); samples_missing = []
    seen_assets = set(); css_checked = set()
    urls = []
    for _ in range(N):
        _, code, final, ct = fetch(f"{BASE}/kiwix/random?content={bk}", body=False)
        if code == 200 and final not in urls: urls.append(final)
    urls.append(f"{BASE}/kiwix/content/{bk}/")
    for u in urls:
        html, code, final, ct = fetch(u)
        if code != 200: pages_bad += 1; continue
        pages_ok += 1
        if "html" not in ct: continue
        for kind, a in assets(html, final):
            host = urllib.parse.urlparse(a).netloc
            if host and not LOCAL.match(host):
                external[f"{host} [{kind}]"] += 1; continue
            if a in seen_assets: continue
            seen_assets.add(a)
            body, c, f2, ct2 = fetch(a, body=(kind == "css"))
            if c != 200:
                missing[kind] += 1
                if len(samples_missing) < 3: samples_missing.append(a.replace(BASE, "")[:120])
            elif kind == "css" and a not in css_checked:   # follow url() inside stylesheets (fonts, backgrounds)
                css_checked.add(a)
                for cu in CSSURL.findall(body):
                    if cu.startswith("data:"): continue
                    full = urllib.parse.urljoin(f2, cu.strip())
                    h = urllib.parse.urlparse(full).netloc
                    if h and not LOCAL.match(h): external[f"{h} [css-url]"] += 1; continue
                    if full in seen_assets: continue
                    seen_assets.add(full)
                    _, c3, _, _ = fetch(full, body=False)
                    if c3 != 200:
                        missing["css-url"] += 1
                        if len(samples_missing) < 3: samples_missing.append(full.replace(BASE, "")[:120])
    return {"book": b["name"], "pages_ok": pages_ok, "pages_bad": pages_bad, "assets_checked": len(seen_assets),
            "missing": dict(missing), "missing_examples": samples_missing, "external": dict(external.most_common(6))}

books = json.loads(fetch(f"{BASE}/api/books")[0])
if len(sys.argv) > 3: books = [b for b in books if re.search(sys.argv[3], b["name"])]   # optional name filter (regex)
docs = [b for b in books if b["name"].startswith("zimgit")]
with cf.ThreadPoolExecutor(4) as ex:
    results = list(ex.map(audit_book, [b for b in books if not b["name"].startswith("zimgit")]))
# document libraries: every PDF must open
doclist = json.loads(fetch(f"{BASE}/api/doclist")[0])
pdf_bad = []
def chk(d):
    _, c, _, ct = fetch(BASE + d["URL"].split("#")[0], body=False)
    return None if c == 200 else (d["Title"], c)
with cf.ThreadPoolExecutor(8) as ex:
    pdf_bad = [x for x in ex.map(chk, doclist) if x]
print(json.dumps({"libraries": results, "documents_checked": len(doclist), "documents_failing": pdf_bad}, indent=1))

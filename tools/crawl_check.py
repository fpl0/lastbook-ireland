# Link crawl for one library: breadth-first from its home page, following in-archive links (a, frame, iframe, area),
# and checking every target exists offline. Usage: crawl_check.py http://127.0.0.1:PORT BOOK [max_pages]
import re, subprocess, sys, urllib.parse, collections

BASE, BOOK = sys.argv[1].rstrip("/"), sys.argv[2]
MAX = int(sys.argv[3]) if len(sys.argv) > 3 else 400
ROOT = f"{BASE}/kiwix/content/{BOOK}/"
LINK = re.compile(r"""<(a|frame|iframe|area)\b[^>]*?\s(?:href|src)\s*=\s*["']([^"'#]+)""", re.I)

def get(url):
    r = subprocess.run(["curl", "-s", "-L", "-m", "60", "-w", "\n@@%{http_code}@@%{url_effective}@@%{content_type}", url], capture_output=True)
    out = r.stdout.decode("latin-1")
    body, _, meta = out.rpartition("\n@@")
    code, final, ct = (meta.split("@@") + ["", "", ""])[:3]
    return body, int(code or 0), final, ct

seen, q = set(), collections.deque([ROOT])
ok = bad = 0; broken = []; kinds = collections.Counter(); external = collections.Counter()
while q and len(seen) < MAX:
    u = q.popleft()
    if u in seen: continue
    seen.add(u)
    body, code, final, ct = get(u)
    kind = (ct.split(";")[0] or "?")
    if code != 200:
        bad += 1; broken.append((code, u.replace(BASE, ""))); continue
    ok += 1; kinds[kind] += 1
    if "html" not in kind: continue
    for tag, href in LINK.findall(body):
        href = href.strip()
        if href.lower().startswith(("mailto:", "javascript:", "data:")): continue
        full = urllib.parse.urljoin(final, href)
        p = urllib.parse.urlparse(full)
        if p.netloc and not p.netloc.startswith(("127.0.0.1", "localhost")):
            # absolute link back to the archived site: the replay script maps it into the archive — check that copy
            local = f"{BASE}/kiwix/content/{BOOK}/{p.netloc}{p.path or '/'}" + (("?" + p.query) if p.query else "")
            if sys.argv[4:] and p.netloc in sys.argv[4].split(","):
                if local not in seen: q.append(local)
            else:
                external[p.netloc] += 1
            continue
        full = full.split("#")[0]
        if f"/kiwix/content/{BOOK}/" in full and full not in seen: q.append(full)
print(f"{BOOK}: checked {len(seen)} targets — {ok} ok, {bad} missing")
print("content types:", dict(kinds.most_common(8)))
print("links pointing to the internet (not followed):", dict(external.most_common(6)) or "none")
for c, u in broken[:15]: print("  MISSING", c, u[:150])

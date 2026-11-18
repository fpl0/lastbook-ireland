# Snapshots official emergency guidance (Ireland, Northern Ireland/UK, Nordic civil-protection agencies)
# into clean offline HTML + original PDFs.  Output: <LIB>/guidance/{index.json, pages/*.html, pdf/*.pdf}
import html, json, os, re, socket, sys, time, urllib.parse, urllib.request
from html.parser import HTMLParser

_g = socket.getaddrinfo
socket.getaddrinfo = lambda *a, **k: [r for r in _g(*a, **k) if r[0] == socket.AF_INET]
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
LIB = os.path.expanduser("~/Library/Application Support/Lastbook Ireland/guidance")
os.makedirs(f"{LIB}/pages", exist_ok=True); os.makedirs(f"{LIB}/pdf", exist_ok=True)

# (seed url, source label, follow-prefix or None, max depth)
SEEDS = [
 ("https://www.gov.ie/en/office-of-emergency-planning/campaigns/be-emergency-ready/", "gov.ie · Office of Emergency Planning", "https://www.gov.ie/en/office-of-emergency-planning/", 2),
 ("https://www.gov.ie/en/office-of-emergency-planning/campaigns/what-to-do/", "gov.ie · Office of Emergency Planning", "https://www.gov.ie/en/office-of-emergency-planning/", 2),
 ("https://www.nidirect.gov.uk/campaigns/be-ready-emergencies", "nidirect (Northern Ireland)", "https://www.nidirect.gov.uk/articles/", 1),
 ("https://www.nidirect.gov.uk/articles/power-cuts", "nidirect (Northern Ireland)", None, 0),
 ("https://www.nidirect.gov.uk/articles/flooding", "nidirect (Northern Ireland)", None, 0),
 ("https://beready.campaign.gov.uk/", "UK Government · Be Ready", "https://beready.campaign.gov.uk/", 2),
 ("https://www.met.ie/weather-warnings", "Met Éireann", None, 0),
 ("https://www.met.ie/warnings-explained", "Met Éireann", None, 0),
 ("https://www.hse.ie/eng/health/hl/water/drinkingwater/boilwaternotices/", "HSE", None, 0),
 ("https://www.hse.ie/eng/health/hl/water/drinkingwater/", "HSE", "https://www.hse.ie/eng/health/hl/water/drinkingwater/", 1),
 ("https://www2.hse.ie/conditions/anaphylaxis/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/asthma/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/carbon-monoxide-poisoning/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/dehydration/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/diarrhoea-vomiting/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/diarrhoea-babies-children/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/epilepsy/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/febrile-seizures/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/flu/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/food-poisoning/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/head-injury-concussion/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/heart-attack/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/heat-exhaustion-heatstroke/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/insect-bites-stings/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/lyme-disease/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/meningitis-and-septicaemia/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/norovirus/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/nosebleed/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/sepsis/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/stroke/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/sunburn/", "HSE", None, 0),
 ("https://www2.hse.ie/conditions/diabetes/", "HSE", None, 0),
 ("https://www.fsai.ie/consumers/food-safety-at-home/power-cuts-and-food-safety", "Food Safety Authority of Ireland", None, 0),
 ("https://www.watersafety.ie/", "Water Safety Ireland", None, 0),
 ("https://www.gov.ie/en/department-of-transport/services/irish-coast-guard/", "Irish Coast Guard", None, 0),
 ("https://www.epa.ie/environment-and-you/radiation/", "EPA Ireland · Radiation", "https://www.epa.ie/environment-and-you/radiation/", 1),
 ("https://www.civildefence.ie/", "Civil Defence Ireland", None, 0),
 ("https://www.cdc.gov/water-emergency/about/index.html", "US CDC", "https://www.cdc.gov/water-emergency/", 1),
 ("https://www.cdc.gov/carbon-monoxide/about/index.html", "US CDC", None, 0),
]
PDFS = [
 ("https://assets.gov.ie/static/documents/749e8ee7/JAV16262_OEP_Preparedness_Campaign_Accessible_EN_V4_Web.pdf", "Be Emergency Ready — household booklet (2026)", "gov.ie · Office of Emergency Planning"),
 ("https://assets.gov.ie/static/documents/cbe65d91/JAV16262_OEP_Preparedness_Campaign_Checklist_EN.pdf", "Be Emergency Ready — checklist", "gov.ie · Office of Emergency Planning"),
 ("https://assets.gov.ie/static/documents/65370a9b/JAV16262_OEP_Preparedness_Campaign_Numbers_EN.pdf", "Be Emergency Ready — important numbers", "gov.ie · Office of Emergency Planning"),
 ("https://beready.campaign.gov.uk/wp-content/uploads/sites/252/2026/10/Be-Ready-Checklist_English.pdf", "Be Ready checklist (UK / NI)", "UK Government · Be Ready"),
 ("https://www.nidirect.gov.uk/sites/default/files/2021-11/household-severe-weather-plan.pdf", "Household severe weather plan (NI)", "nidirect (Northern Ireland)"),
 ("https://rib.msb.se/filer/pdf/31523.pdf", "In case of crisis or war (Sweden, English)", "Swedish Civil Defence & Resilience Agency"),
]
SKIP = re.compile(r"(crown-copyright|care-registers|major-incidents-affecting-business|personal-safety|about-this-website|thoron|/emf|cookie|privacy|accessib|terms|sitemap|contact-us|/ga/|/cy/|login|search|feedback|\.(jpg|png|gif|svg|css|js|zip|docx?)$)", re.I)
DROP = {"script","style","nav","footer","header","form","svg","noscript","iframe","button","aside","select","template"}
KEEP = {"h1","h2","h3","h4","h5","p","ul","ol","li","table","thead","tbody","tr","td","th","strong","b","em","i","blockquote","br","dl","dt","dd","a","details","summary"}

class Clean(HTMLParser):
    def __init__(s, base):
        super().__init__(convert_charrefs=True); s.base=base; s.out=[]; s.drop=0; s.inmain=0; s.mainseen=False; s.title=""; s.intitle=False; s.links=[]; s.pdfs=[]; s.h1=""; s.inh1=False
    def handle_starttag(s, t, a):
        a = dict(a)
        if t == "title": s.intitle=True
        if t in ("main",) or a.get("role")=="main" or a.get("id") in ("main-content","maincontent","content-main","main"):
            s.inmain += 1; s.mainseen=True
        if t == "a" and a.get("href"):
            u = urllib.parse.urljoin(s.base, a["href"]).split("#")[0]
            (s.pdfs if u.lower().endswith(".pdf") else s.links).append((u, ""))
        if t in DROP: s.drop += 1; return
        if s.drop: return
        if t == "h1": s.inh1=True
        if t in KEEP:
            if t == "a":
                u = urllib.parse.urljoin(s.base, a.get("href","")); s.out.append(f'<a href="{html.escape(u)}">')
            else: s.out.append(f"<{t}>")
    def handle_endtag(s, t):
        if t == "title": s.intitle=False
        if t in DROP: s.drop = max(0, s.drop-1); return
        if s.drop: return
        if t == "h1": s.inh1=False
        if t in KEEP and t != "br": s.out.append(f"</{t}>")
    def handle_data(s, d):
        if s.intitle: s.title += d
        if s.drop: return
        if s.inh1: s.h1 += d
        s.out.append(html.escape(d))

import subprocess
def get(url, tries=3):
    for i in range(tries):
        try: return _get(url)
        except Exception as e:
            if "HTTP 4" in str(e) or i == tries - 1: raise
            time.sleep(3 * (i + 1))

def _get(url):
    r = subprocess.run(["curl","-4","-sSL","-m","60","-A",UA,"-H","Accept-Language: en-IE,en","-w","\n@@%{url_effective}@@%{content_type}@@%{http_code}",url], capture_output=True)
    if r.returncode: raise Exception(r.stderr.decode()[:200])
    body, meta = r.stdout.rsplit(b"\n@@",1); final, ct, code = meta.decode().split("@@")
    if not code.startswith("2"): raise Exception("HTTP "+code)
    return body, final, ct

def slug(u): return re.sub(r"[^a-z0-9]+", "-", re.sub(r"^https?://(www\d?\.)?", "", u.lower())).strip("-")[:120]

def main_html(raw, url):
    p = Clean(url); p.feed(raw.decode("utf-8", "replace"))
    body = "".join(p.out)
    # if the page marks a <main>, keep only the text after the first <h1> (cheap readability)
    m = re.search(r"<h1>", body)
    if m: body = body[m.start():]
    body = re.sub(r"(\s*\n\s*)+", "\n", body)
    body = re.sub(r"<(p|li|h\d|td|strong|em|b|i|a[^>]*)>\s*</\1>", "", body)
    title = (p.h1 or p.title).strip().split("|")[0].split(" - ")[0].strip() or url
    return title, body, p.links, p.pdfs

def text_of(h): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", h))).strip()

index, seen = [], set()
def add_pdf(u, title, src):
    if u in seen: return
    seen.add(u)
    fn = slug(u.rsplit("/",1)[-1][:-4]) + ".pdf"
    try:
        if not os.path.exists(f"{LIB}/pdf/{fn}"):
            d, _, ct = get(u)
            if not d.startswith(b"%PDF"): print("not pdf", u); return
            open(f"{LIB}/pdf/{fn}", "wb").write(d)
        index.append({"type":"pdf","title":title,"source":src,"url":u,"file":f"pdf/{fn}"}); print("PDF", title, flush=True)
    except Exception as e: print("FAIL", u, e, flush=True)

def crawl(url, src, prefix, depth):
    if url in seen or len(index) > 260: return
    seen.add(url)
    try: raw, final, ct = get(url)
    except Exception as e: print("FAIL", url, e, flush=True); return
    if "html" not in ct: return
    title, body, links, pdfs = main_html(raw, final)
    if len(text_of(body)) > 300:
        fn = slug(final) + ".html"
        open(f"{LIB}/pages/{fn}", "w").write(body)
        index.append({"type":"page","title":title,"source":src,"url":final,"file":f"pages/{fn}","text":text_of(body)[:20000]})
        print("PAGE", title, flush=True)
    for pu,_ in pdfs:
        if prefix and (pu.startswith(prefix) or "assets.gov.ie" in pu or "nidirect.gov.uk/sites" in pu or "beready.campaign.gov.uk/wp-content" in pu):
            add_pdf(pu, pu.rsplit("/",1)[-1][:-4].replace("_"," ").replace("-"," "), src)
    if depth > 0 and prefix:
        for lu,_ in links:
            if lu.startswith(prefix) and not SKIP.search(lu): crawl(lu, src, prefix, depth-1); time.sleep(0.3)

for u,t,s in PDFS: add_pdf(u,t,s)
for u,s,p,d in SEEDS: crawl(u,s,p,d)
json.dump(index, open(f"{LIB}/index.json","w"), ensure_ascii=False, indent=0)
print("DONE", len(index), "items")

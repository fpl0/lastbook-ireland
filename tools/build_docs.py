# Builds <LIB>/data/docs.json: page-level text of every survival manual (PDFs inside the Kiwix "zimgit" libraries)
# and every official-guidance snapshot, for the app's full-text search.
# Needs a running kiwix-serve (pass its base URL) and build/pdftext.
import ast, json, os, re, subprocess, sys, tempfile, urllib.parse
KIWIX = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8091"
LIB = os.path.expanduser("~/Library/Application Support/Lastbook Ireland")
PDFTEXT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../build/pdftext")

def curl(url, out=None):
    a = ["curl", "-sSfL", "-m", "300", url] + (["-o", out] if out else [])
    r = subprocess.run(a, capture_output=True)
    if r.returncode: raise Exception(f"{url}: {r.stderr[:200]}")
    return r.stdout

BOOKS = {  # book -> shelf name
 "zimgit-post-disaster_en_2024-05": "Post-disaster library",
 "zimgit-medicine_en_2024-08": "Medical library",
 "zimgit-water_en_2024-08": "Water treatment",
 "zimgit-food-preparation_en_2025-04": "Food & preserving",
 "zimgit-knots_en_2024-08": "Knots & rope",
}
# Pirated commercial books and weapon/explosive manuals are left out of the curated index.
EXCLUDE = re.compile(r"AppNee|SAS Self-Defense|Black-Powder|Prepper-Phone|gift mixes|Dove-Hunting|Duck-Hunting|deer|whitetail|wdfw|Waterfowling|Tongue|Dutch oven|Dutch Oven|Virginia|nordic-ware|Unusual Old World|60 gift|Colonial-New-England|Colonial New England|Ontario|wfsriverside|Worm-Factory", re.I)
NICE = {
 "ENEWER US ARMY FM-21-76-Survival-2002": "US Army Survival Manual FM 21-76 (2002)",
 "Wilderness-Survival-FM-2176": "US Army FM 21-76 — Survival (1970 edition)",
 "Full-First-Aid-Manual-FM-2111": "US Army First Aid FM 21-11",
 "Emergency-War-Surgery": "Emergency War Surgery (Borden Institute)",
 "Emergency War Surgery": "Emergency War Surgery (Borden Institute)",
 "Where-there-is-no-Doctor-book": "Where There Is No Doctor (Hesperian)",
 "Where there is no Doctor ": "Where There Is No Doctor (Hesperian)",
 "Where-There-is-No-Dentist-Murray-Dickson": "Where There Is No Dentist (Hesperian)",
 "Where There is No Dentist": "Where There Is No Dentist (Hesperian)",
 "First Aid and Medicine_midwife_2011_Full_Book": "A Book for Midwives (Hesperian)",
 "A Book for Midwives": "A Book for Midwives (Hesperian)",
 "Survival-and-Austere-Medicine": "Survival and Austere Medicine",
 "Medical-Survival-Wound-Closure-Manual": "Wound Closure Manual",
 "Stitches_Sutures_ETHICON_Wound_Closure_Manual_2004": "Ethicon Wound Closure Manual",
 "Wilderness-Medicine-Course": "Wilderness Medicine Course",
 "survival-personal-wilderness-medical-kit": "Personal Wilderness Medical Kit",
 "US-Marine-Corps-Summer-Survival-Course": "USMC Summer Survival Course",
 "USMC-Winter-Survival-Course": "USMC Winter Survival Course",
 "How-to-Find-Your-Way": "How to Find Your Way (navigation)",
 "FEMA-nuclear-survival": "FEMA — Nuclear Survival",
 "Nuclear Survival Skills": "Nuclear War Survival Skills (Cresson Kearny)",
 "FEMA_REP_Program_Manual_Dec_2019": "FEMA Radiological Emergency Preparedness Manual",
 "MP-15.fam_.1959": "Family Shelter Designs (1959)",
 "How-to-Build-a-Debris-Hut": "How to Build a Debris Hut",
 "taking-shelter-building-a-safe-room": "Taking Shelter — Building a Safe Room (FEMA)",
 "Survival-Water-Purification": "Survival Water Purification",
 "DOH Pub 821-031 Purifying Water During an Emergency": "Purifying Water During an Emergency",
 "GUIDE06_HomeCan_rev0715": "USDA Complete Guide to Home Canning",
 "Preservation_of_Fish_and_Meat_2004": "Preservation of Fish and Meat (Agrodok)",
 "SmallScale-Food-Drying-Technologies": "Small-scale Food Drying Technologies",
 "seed_saving_guide": "Seed Saving Guide",
 "JG-Complete-Guide-to-Home-Composting": "Complete Guide to Home Composting",
 "dead falls snares b00harduoft": "Deadfalls and Snares (1907)",
 "Handbook-of-Knots-Splices": "Handbook of Knots & Splices",
 "Encyclopedia-of-Knots": "Encyclopedia of Knots",
 "Knots-for-Mountaineering-Camping-Climbing-Utility-Rescue-Etc": "Knots for Mountaineering, Camping, Climbing & Rescue",
 "Ropes-Knots-Ladders-Lashings-Anchorages": "Ropes, Knots, Ladders, Lashings & Anchorages (US Army)",
 "Foxfire-One": "The Foxfire Book (1)", "Foxfire-Two": "Foxfire 2", "Foxfire-Three": "Foxfire 3",
 "Field Guide to Mushrooms": "Field Guide to Mushrooms", "Mushroom Guide": "Mushroom Guide",
 "shellfish-foraging-guide-1-5-14-final": "Shellfish Foraging Guide",
 "2011 wild edible directory": "Wild Edible Plants Directory",
 "Pocket-Guide-to-Urban-Foraging": "Pocket Guide to Urban Foraging",
 "the-ten-bushcraft-books": "The Ten Bushcraft Books",
 "bushcraft leather work PDF": "Bushcraft Leatherwork",
 "Traditional fermented food and beverages for improved livelihoods": "Traditional Fermented Foods (FAO)",
 "HHS Pandemic Influenza Plan": "HHS Pandemic Influenza Plan",
 "Three Days Emergency Preparedness": "Three Days Emergency Preparedness",
 "_173165": "Nuclear emergency guide",
}
def nice(t):
    if t in NICE: return NICE[t]
    t = re.sub(r"[_]+", " ", t); t = re.sub(r"(?<=\w)-(?=\w)", " ", t)
    t = re.sub(r"\s+PDF$", "", t).strip()
    return t[:1].upper() + t[1:]

def pages_of(path):
    r = subprocess.run([PDFTEXT, path], capture_output=True, timeout=600)
    try: pages = json.loads(r.stdout or b"[]")
    except Exception: pages = []
    return [re.sub(r"\s+", " ", p).strip() for p in pages]

docs, seen_titles, seen_text = [], set(), set()
tmp = tempfile.mkdtemp()
for book, shelf in BOOKS.items():
    js = curl(f"{KIWIX}/kiwix/content/{book}/database.js").decode("utf-8", "replace")
    body = js[js.index("["): js.rindex("]") + 1]
    entries = ast.literal_eval(body)
    for e in entries:
        ti = e.get("ti", ""); dsc = e.get("dsc", "")
        if EXCLUDE.search(ti) or EXCLUDE.search(" ".join(e.get("fp", []))): continue
        title = nice(ti)
        cat = re.split(r"[:_“”]", dsc)[0].strip() or shelf
        desc = ""
        if len(cat) > 40: desc, cat = dsc.strip(), shelf      # some libraries put a description where the category goes
        if cat.lower() in ("various", "") or cat == title: cat = shelf
        for fp in e.get("fp", [])[:1]:
            if not fp.lower().endswith(".pdf"): continue
            url = f"/kiwix/content/{book}/files/" + urllib.parse.quote(fp)
            local = os.path.join(tmp, "x.pdf")
            try: curl(KIWIX + url, local)
            except Exception as ex: print("skip", title, ex); continue
            pg = pages_of(local)
            if sum(len(p) for p in pg) < 200: print("no text", title); pg = pg or [""]
            # the same manual often ships in several libraries: keep it on every shelf, but index its text only once
            sig = hash(" ".join(pg[:3])[:4000])
            dup = sig in seen_text or title.lower() in seen_titles
            seen_text.add(sig); seen_titles.add(title.lower())
            docs.append({"id": f"{book}:{e['_id']}", "title": title, "cat": cat, "source": shelf, "url": url, "pages": pg, "dup": dup, "desc": desc[:220]})
            if dup: print("dup (shelf only)", title)
            print(f"{len(pg):4d}p  {title}", flush=True)

g = os.path.join(LIB, "guidance", "index.json")
if os.path.exists(g):
    for i, it in enumerate(json.load(open(g))):
        if it["type"] == "pdf":
            pg = pages_of(os.path.join(LIB, "guidance", it["file"]))
        else:
            pg = [it.get("text", "")]
        docs.append({"id": f"guidance:{i}", "title": it["title"], "cat": "Official guidance", "source": it["source"],
                     "url": "/guidance/" + it["file"], "pages": pg})
        print(f"{len(pg):4d}p  {it['title']}", flush=True)

os.makedirs(os.path.join(LIB, "data"), exist_ok=True)
json.dump(docs, open(os.path.join(LIB, "data", "docs.json"), "w"), ensure_ascii=False)
print("DONE", len(docs), "documents", sum(len(d["pages"]) for d in docs), "pages")

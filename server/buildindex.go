// Builds the search indexes inside the app (Go ports of tools/build_docs.py and tools/build_cd3wd.py):
//
//	<data>/data/docs.json   page-level text of every manual (PDFs in the document libraries) and official guidance
//	<data>/data/cd3wd.json  the CD3WD catalogue (subject, real title, details) for its native shelf
package main

import (
	"context"
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

var pdftextBin = ""

var docShelves = []struct{ prefix, shelf string }{
	{"zimgit-post-disaster_en", "Post-disaster library"},
	{"zimgit-medicine_en", "Medical library"},
	{"zimgit-water_en", "Water treatment"},
	{"zimgit-food-preparation_en", "Food & preserving"},
	{"zimgit-knots_en", "Knots & rope"},
}

// Pirated commercial books and weapon/explosive manuals are left out of the curated index.
var docExclude = regexp.MustCompile(`(?i)AppNee|SAS Self-Defense|Black-Powder|Prepper-Phone|gift mixes|Dove-Hunting|Duck-Hunting|deer|whitetail|wdfw|Waterfowling|Tongue|Dutch oven|Virginia|nordic-ware|Unusual Old World|60 gift|Colonial-New-England|Colonial New England|Ontario|wfsriverside|Worm-Factory`)

var docNice = map[string]string{
	"ENEWER US ARMY FM-21-76-Survival-2002": "US Army Survival Manual FM 21-76 (2002)", "Wilderness-Survival-FM-2176": "US Army FM 21-76 — Survival (1970 edition)",
	"Full-First-Aid-Manual-FM-2111": "US Army First Aid FM 21-11", "Emergency-War-Surgery": "Emergency War Surgery (Borden Institute)",
	"Emergency War Surgery": "Emergency War Surgery (Borden Institute)", "Where-there-is-no-Doctor-book": "Where There Is No Doctor (Hesperian)",
	"Where there is no Doctor ": "Where There Is No Doctor (Hesperian)", "Where-There-is-No-Dentist-Murray-Dickson": "Where There Is No Dentist (Hesperian)",
	"Where There is No Dentist": "Where There Is No Dentist (Hesperian)", "First Aid and Medicine_midwife_2011_Full_Book": "A Book for Midwives (Hesperian)",
	"A Book for Midwives": "A Book for Midwives (Hesperian)", "Survival-and-Austere-Medicine": "Survival and Austere Medicine",
	"Medical-Survival-Wound-Closure-Manual": "Wound Closure Manual", "Stitches_Sutures_ETHICON_Wound_Closure_Manual_2004": "Ethicon Wound Closure Manual",
	"Wilderness-Medicine-Course": "Wilderness Medicine Course", "survival-personal-wilderness-medical-kit": "Personal Wilderness Medical Kit",
	"US-Marine-Corps-Summer-Survival-Course": "USMC Summer Survival Course", "USMC-Winter-Survival-Course": "USMC Winter Survival Course",
	"How-to-Find-Your-Way": "How to Find Your Way (navigation)", "FEMA-nuclear-survival": "FEMA — Nuclear Survival",
	"Nuclear Survival Skills": "Nuclear War Survival Skills (Cresson Kearny)", "FEMA_REP_Program_Manual_Dec_2019": "FEMA Radiological Emergency Preparedness Manual",
	"MP-15.fam_.1959": "Family Shelter Designs (1959)", "How-to-Build-a-Debris-Hut": "How to Build a Debris Hut",
	"taking-shelter-building-a-safe-room": "Taking Shelter — Building a Safe Room (FEMA)", "Survival-Water-Purification": "Survival Water Purification",
	"DOH Pub 821-031 Purifying Water During an Emergency": "Purifying Water During an Emergency", "GUIDE06_HomeCan_rev0715": "USDA Complete Guide to Home Canning",
	"Preservation_of_Fish_and_Meat_2004": "Preservation of Fish and Meat (Agrodok)", "SmallScale-Food-Drying-Technologies": "Small-scale Food Drying Technologies",
	"seed_saving_guide": "Seed Saving Guide", "JG-Complete-Guide-to-Home-Composting": "Complete Guide to Home Composting",
	"dead falls snares b00harduoft": "Deadfalls and Snares (1907)", "Handbook-of-Knots-Splices": "Handbook of Knots & Splices",
	"Encyclopedia-of-Knots": "Encyclopedia of Knots", "Knots-for-Mountaineering-Camping-Climbing-Utility-Rescue-Etc": "Knots for Mountaineering, Camping, Climbing & Rescue",
	"Ropes-Knots-Ladders-Lashings-Anchorages": "Ropes, Knots, Ladders, Lashings & Anchorages (US Army)", "Foxfire-One": "The Foxfire Book (1)",
	"Foxfire-Two": "Foxfire 2", "Foxfire-Three": "Foxfire 3", "shellfish-foraging-guide-1-5-14-final": "Shellfish Foraging Guide",
	"2011 wild edible directory": "Wild Edible Plants Directory", "Pocket-Guide-to-Urban-Foraging": "Pocket Guide to Urban Foraging",
	"the-ten-bushcraft-books": "The Ten Bushcraft Books", "bushcraft leather work PDF": "Bushcraft Leatherwork",
	"Traditional fermented food and beverages for improved livelihoods": "Traditional Fermented Foods (FAO)", "_173165": "Nuclear emergency guide",
}

var (
	reUnderscore = regexp.MustCompile(`_+`)
	reHyphen     = regexp.MustCompile(`(\w)-(\w)`)
	reEntry      = regexp.MustCompile(`\{[^{}]*'_id'[^{}]*\}`)
	reField      = regexp.MustCompile(`'(\w+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")`)
	reFP         = regexp.MustCompile(`'fp':\s*\[([^\]]*)\]`)
	reStr        = regexp.MustCompile(`'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"`)
	reCatSplit   = regexp.MustCompile(`[:_“”]`)
)

func niceTitle(t string) string {
	if n, ok := docNice[t]; ok {
		return n
	}
	t = reUnderscore.ReplaceAllString(t, " ")
	t = reHyphen.ReplaceAllString(reHyphen.ReplaceAllString(t, "$1 $2"), "$1 $2")
	t = strings.TrimSpace(strings.TrimSuffix(t, " PDF"))
	if t != "" {
		r, n := utf8.DecodeRuneInString(t)
		t = strings.ToUpper(string(r)) + t[n:]
	}
	return t
}

func unq(a, b string) string {
	s := a
	if s == "" {
		s = b
	}
	return strings.NewReplacer(`\'`, `'`, `\"`, `"`, `\\`, `\`).Replace(s)
}

func kiwixGet(ctx context.Context, p string) ([]byte, error) {
	base := kiwix.target()
	if base == "" {
		return nil, fmt.Errorf("library engine not running")
	}
	req, _ := http.NewRequestWithContext(ctx, "GET", base+p, nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d for %s", resp.StatusCode, p)
	}
	return io.ReadAll(resp.Body)
}

func pdfPages(ctx context.Context, file string) []string {
	if pdftextBin == "" {
		return nil
	}
	cctx, cancel := context.WithTimeout(ctx, 10*time.Minute)
	defer cancel()
	out, err := exec.CommandContext(cctx, pdftextBin, file).Output()
	if err != nil {
		return nil
	}
	var pages []string
	json.Unmarshal(out, &pages)
	for i, p := range pages {
		pages[i] = strings.TrimSpace(gWsRe.ReplaceAllString(p, " "))
	}
	return pages
}

func installedBooks() map[string]string { // name prefix -> full book id (file stem)
	m := map[string]string{}
	files, _ := filepath.Glob(filepath.Join(*dataDir, "zim", "*.zim"))
	for _, f := range files {
		if isFile(f + ".ok") {
			stem := strings.TrimSuffix(filepath.Base(f), ".zim")
			m[stem] = stem
		}
	}
	return m
}

func bookWithPrefix(prefix string) string {
	for stem := range installedBooks() {
		if strings.HasPrefix(stem, prefix) {
			return stem
		}
	}
	return ""
}

func buildIndexes(ctx context.Context, progress func(done, total int)) error {
	var docs []Doc
	type job struct {
		book, shelf, id, title, cat, desc, url string
	}
	var jobs []job
	for _, s := range docShelves {
		book := bookWithPrefix(s.prefix)
		if book == "" {
			continue
		}
		js, err := kiwixGet(ctx, "/kiwix/content/"+book+"/database.js")
		if err != nil {
			log.Printf("index: %s: %v", book, err)
			continue
		}
		for _, obj := range reEntry.FindAllString(string(js), -1) {
			f := map[string]string{}
			for _, m := range reField.FindAllStringSubmatch(obj, -1) {
				f[m[1]] = unq(m[2], m[3])
			}
			var fps []string
			if m := reFP.FindStringSubmatch(obj); m != nil {
				for _, sm := range reStr.FindAllStringSubmatch(m[1], -1) {
					fps = append(fps, unq(sm[1], sm[2]))
				}
			}
			ti, dsc := f["ti"], f["dsc"]
			if docExclude.MatchString(ti) || docExclude.MatchString(strings.Join(fps, " ")) || len(fps) == 0 || !strings.HasSuffix(strings.ToLower(fps[0]), ".pdf") {
				continue
			}
			title := niceTitle(ti)
			cat := strings.TrimSpace(reCatSplit.Split(dsc, 2)[0])
			desc := ""
			if len(cat) > 40 {
				desc, cat = strings.TrimSpace(dsc), s.shelf
			}
			if cat == "" || strings.EqualFold(cat, "various") || cat == title {
				cat = s.shelf
			}
			if len(desc) > 220 {
				desc = desc[:220]
			}
			jobs = append(jobs, job{book, s.shelf, book + ":" + f["_id"], title, cat, desc, "/kiwix/content/" + book + "/files/" + url.PathEscape(fps[0])})
		}
	}
	gIdx := []gItem{}
	if b, err := os.ReadFile(filepath.Join(*dataDir, "guidance", "index.json")); err == nil {
		json.Unmarshal(b, &gIdx)
	}
	total := len(jobs) + len(gIdx) + 1
	done := 0
	seenSig, seenTitle := map[string]bool{}, map[string]bool{}
	tmp, _ := os.MkdirTemp("", "lastbook-index")
	defer os.RemoveAll(tmp)
	for _, j := range jobs {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		b, err := kiwixGet(ctx, j.url)
		done++
		progress(done, total)
		if err != nil {
			log.Printf("index: %s: %v", j.title, err)
			continue
		}
		p := filepath.Join(tmp, "x.pdf")
		os.WriteFile(p, b, 0o644)
		pages := pdfPages(ctx, p)
		if len(pages) == 0 {
			pages = []string{""}
		}
		first := strings.Join(pages[:min(3, len(pages))], " ")
		if len(first) > 4000 {
			first = first[:4000]
		}
		sig := fmt.Sprintf("%x", sha1.Sum([]byte(first)))
		dup := seenSig[sig] || seenTitle[strings.ToLower(j.title)]
		seenSig[sig], seenTitle[strings.ToLower(j.title)] = true, true
		docs = append(docs, Doc{ID: j.id, Title: j.title, Cat: j.cat, Source: j.shelf, URL: j.url, Pages: pages, Dup: dup, Desc: j.desc})
	}
	for i, it := range gIdx {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		var pages []string
		if it.Type == "pdf" {
			pages = pdfPages(ctx, filepath.Join(*dataDir, "guidance", it.File))
		} else {
			pages = []string{it.Text}
		}
		docs = append(docs, Doc{ID: fmt.Sprintf("guidance:%d", i), Title: it.Title, Cat: "Official guidance", Source: it.Source, URL: "/guidance/" + it.File, Pages: pages})
		done++
		progress(done, total)
	}
	os.MkdirAll(filepath.Join(*dataDir, "data"), 0o755)
	b, _ := json.Marshal(docs)
	if err := os.WriteFile(filepath.Join(*dataDir, "data", "docs.json"), b, 0o644); err != nil {
		return err
	}
	if book := bookWithPrefix("cd3wdproject.org"); book != "" {
		if err := buildCD3WD(ctx, book); err != nil {
			log.Printf("index: cd3wd: %v", err)
		}
	}
	progress(total, total)
	return nil
}

// ---------------------------------------------------------------- CD3WD catalogue

var (
	reAnchor  = regexp.MustCompile(`(?is)<a\b[^>]*href="([^"#]+)"[^>]*>(.*?)</a>`)
	reTitle   = regexp.MustCompile(`(?is)<title>(.*?)</title>`)
	reMeta    = regexp.MustCompile(`^(.*?)\s*\(([^()]*\d{4}[^()]*)\)\s*$`)
	reToc     = regexp.MustCompile(`(?i)\s*-\s*(Contents?|Coontents|Contenido|Table des mati[eè]res|Inhalt|Sommaire)\s*$`)
	cd3Rename = map[string]string{"Sme/Small Business": "Small Business", "Vet Tech": "Veterinary", "Electric": "Electrical"}
)

func toUTF8(b []byte) string {
	if utf8.Valid(b) {
		return string(b)
	}
	r := make([]rune, len(b)) // Windows-1252/Latin-1 pages
	for i, c := range b {
		r[i] = rune(c)
	}
	return string(r)
}

func buildCD3WD(ctx context.Context, book string) error {
	root := "/kiwix/content/" + book + "/www.cd3wdproject.org/CD3WD/"
	idx, err := kiwixGet(ctx, root+"INDEX.HTM")
	if err != nil {
		return err
	}
	base, _ := url.Parse(root)
	type entry struct{ Cat, Code, Path, Title, Meta string }
	var es []*entry
	seen := map[string]bool{}
	for _, m := range reAnchor.FindAllStringSubmatch(toUTF8(idx), -1) {
		label := strings.TrimSpace(gWsRe.ReplaceAllString(html.UnescapeString(gTagRe.ReplaceAllString(m[2], "")), " "))
		if !strings.Contains(label, " - ") || strings.HasPrefix(m[1], "http") || strings.HasPrefix(m[1], "mailto") {
			continue
		}
		parts := strings.SplitN(label, " - ", 2)
		ref, err := base.Parse(m[1])
		if err != nil || seen[ref.Path] {
			continue
		}
		seen[ref.Path] = true
		cat := titleCase(strings.TrimSpace(parts[0]))
		es = append(es, &entry{Cat: cat, Code: strings.TrimSpace(parts[1]), Path: ref.Path})
	}
	var wg sync.WaitGroup
	sem := make(chan struct{}, 12)
	for _, e := range es {
		wg.Add(1)
		sem <- struct{}{}
		go func(e *entry) {
			defer wg.Done()
			defer func() { <-sem }()
			t := ""
			if b, err := kiwixGet(ctx, e.Path); err == nil {
				if m := reTitle.FindStringSubmatch(toUTF8(b)); m != nil {
					t = strings.TrimSpace(gWsRe.ReplaceAllString(html.UnescapeString(m[1]), " "))
				}
			}
			if t == "" || strings.HasPrefix(strings.ToLower(t), "cd3wd") {
				t = strings.ReplaceAll(e.Code, "_", " ")
			}
			if m := reMeta.FindStringSubmatch(t); m != nil {
				e.Title, e.Meta = strings.TrimSpace(m[1]), strings.TrimSpace(m[2])
			} else {
				e.Title = t
			}
			e.Title = reToc.ReplaceAllString(e.Title, "")
		}(e)
	}
	wg.Wait()
	count := map[string]int{}
	for _, e := range es {
		count[e.Cat]++
	}
	for _, e := range es {
		if count[e.Cat] < 3 || strings.EqualFold(e.Cat, "miscell") {
			e.Cat = "Miscellaneous"
		}
		if n, ok := cd3Rename[e.Cat]; ok {
			e.Cat = n
		}
	}
	sort.Slice(es, func(i, j int) bool {
		if es[i].Cat != es[j].Cat {
			return es[i].Cat < es[j].Cat
		}
		return strings.ToLower(es[i].Title) < strings.ToLower(es[j].Title)
	})
	items := make([]map[string]string, len(es))
	for i, e := range es {
		items[i] = map[string]string{"cat": e.Cat, "code": e.Code, "path": e.Path, "title": e.Title, "meta": e.Meta}
	}
	b, _ := json.Marshal(map[string]any{"book": book, "items": items})
	return os.WriteFile(filepath.Join(*dataDir, "data", "cd3wd.json"), b, 0o644)
}

// titleCase mirrors Python's str.title(): upper-case the first letter of every run of letters.
func titleCase(s string) string {
	out := []rune(strings.ToLower(s))
	prevLetter := false
	for i, r := range out {
		isL := (r >= 'a' && r <= 'z') || r >= 0xC0
		if isL && !prevLetter {
			out[i] = []rune(strings.ToUpper(string(r)))[0]
		}
		prevLetter = isL
	}
	return string(out)
}

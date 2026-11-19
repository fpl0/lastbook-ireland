// Snapshots official emergency guidance (Ireland, Northern Ireland/UK, Sweden) into clean offline HTML plus the
// original PDFs: <data>/guidance/{index.json, pages/*.html, pdf/*.pdf}. Go port of tools/fetch_guidance.py.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	xhtml "golang.org/x/net/html"
	"html"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type gSeed struct {
	URL, Source, Prefix string
	Depth               int
}

var guidanceSeeds = []gSeed{
	{"https://www.gov.ie/en/office-of-emergency-planning/campaigns/be-emergency-ready/", "gov.ie · Office of Emergency Planning", "https://www.gov.ie/en/office-of-emergency-planning/", 2},
	{"https://www.gov.ie/en/office-of-emergency-planning/campaigns/what-to-do/", "gov.ie · Office of Emergency Planning", "https://www.gov.ie/en/office-of-emergency-planning/", 2},
	{"https://www.nidirect.gov.uk/campaigns/be-ready-emergencies", "nidirect (Northern Ireland)", "https://www.nidirect.gov.uk/articles/", 1},
	{"https://www.nidirect.gov.uk/articles/flooding", "nidirect (Northern Ireland)", "", 0},
	{"https://beready.campaign.gov.uk/", "UK Government · Be Ready", "https://beready.campaign.gov.uk/", 2},
	{"https://www.met.ie/weather-warnings", "Met Éireann", "", 0},
	{"https://www.hse.ie/eng/health/hl/water/drinkingwater/boilwaternotices/", "HSE", "", 0},
	{"https://www.hse.ie/eng/health/hl/water/drinkingwater/", "HSE", "https://www.hse.ie/eng/health/hl/water/drinkingwater/", 1},
	{"https://www.watersafety.ie/", "Water Safety Ireland", "", 0},
	{"https://www.epa.ie/environment-and-you/radiation/", "EPA Ireland · Radiation", "https://www.epa.ie/environment-and-you/radiation/", 1},
	{"https://www.civildefence.ie/", "Civil Defence Ireland", "", 0},
}

func init() {
	for _, c := range []string{"anaphylaxis", "asthma", "carbon-monoxide-poisoning", "dehydration", "diarrhoea-vomiting", "diarrhoea-babies-children",
		"epilepsy", "febrile-seizures", "flu", "food-poisoning", "head-injury-concussion", "heart-attack", "heat-exhaustion-heatstroke",
		"insect-bites-stings", "lyme-disease", "meningitis-and-septicaemia", "norovirus", "nosebleed", "sepsis", "stroke", "sunburn", "diabetes"} {
		guidanceSeeds = append(guidanceSeeds, gSeed{"https://www2.hse.ie/conditions/" + c + "/", "HSE", "", 0})
	}
}

var guidancePDFs = [][3]string{
	{"https://assets.gov.ie/static/documents/749e8ee7/JAV16262_OEP_Preparedness_Campaign_Accessible_EN_V4_Web.pdf", "Be Emergency Ready — household booklet (2026)", "gov.ie · Office of Emergency Planning"},
	{"https://assets.gov.ie/static/documents/cbe65d91/JAV16262_OEP_Preparedness_Campaign_Checklist_EN.pdf", "Be Emergency Ready — checklist", "gov.ie · Office of Emergency Planning"},
	{"https://assets.gov.ie/static/documents/65370a9b/JAV16262_OEP_Preparedness_Campaign_Numbers_EN.pdf", "Be Emergency Ready — important numbers", "gov.ie · Office of Emergency Planning"},
	{"https://beready.campaign.gov.uk/wp-content/uploads/sites/252/2026/10/Be-Ready-Checklist_English.pdf", "Be Ready checklist (UK / NI)", "UK Government · Be Ready"},
	{"https://rib.msb.se/filer/pdf/31523.pdf", "In case of crisis or war (Sweden, English)", "Swedish Civil Defence & Resilience Agency"},
}

var (
	gSkip    = regexp.MustCompile(`(?i)(crown-copyright|care-registers|major-incidents-affecting-business|personal-safety|about-this-website|thoron|/emf|cookie|privacy|accessib|terms|sitemap|contact-us|/ga/|/cy/|login|search|feedback|\.(jpg|png|gif|svg|css|js|zip|docx?)$)`)
	gDrop    = map[string]bool{"script": true, "style": true, "nav": true, "footer": true, "header": true, "form": true, "svg": true, "noscript": true, "iframe": true, "button": true, "aside": true, "select": true, "template": true}
	gKeep    = map[string]bool{"h1": true, "h2": true, "h3": true, "h4": true, "h5": true, "p": true, "ul": true, "ol": true, "li": true, "table": true, "thead": true, "tbody": true, "tr": true, "td": true, "th": true, "strong": true, "b": true, "em": true, "i": true, "blockquote": true, "br": true, "dl": true, "dt": true, "dd": true, "a": true, "details": true, "summary": true}
	gVoid    = map[string]bool{"br": true, "img": true, "input": true, "meta": true, "link": true, "hr": true, "source": true, "area": true, "col": true, "wbr": true, "base": true, "embed": true, "param": true, "track": true}
	gSlugRe  = regexp.MustCompile(`[^a-z0-9]+`)
	gEmptyRe = regexp.MustCompile(`<(p|li|h\d|td|strong|em|b|i)>\s*</(p|li|h\d|td|strong|em|b|i)>`)
	gSpaceRe = regexp.MustCompile(`(\s*\n\s*)+`)
	gTagRe   = regexp.MustCompile(`<[^>]+>`)
	gWsRe    = regexp.MustCompile(`\s+`)
	gHTTP    = &http.Client{Timeout: 60 * time.Second}
)

type gItem struct {
	Type   string `json:"type"`
	Title  string `json:"title"`
	Source string `json:"source"`
	URL    string `json:"url"`
	File   string `json:"file"`
	Text   string `json:"text,omitempty"`
}

func gSlug(u string) string {
	s := strings.ToLower(u)
	s = regexp.MustCompile(`^https?://(www\d?\.)?`).ReplaceAllString(s, "")
	s = strings.Trim(gSlugRe.ReplaceAllString(s, "-"), "-")
	if len(s) > 120 {
		s = s[:120]
	}
	return s
}

func gGet(ctx context.Context, u string) ([]byte, string, string, error) {
	var last error
	for attempt := 0; attempt < 3; attempt++ {
		req, _ := http.NewRequestWithContext(ctx, "GET", u, nil)
		req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15")
		req.Header.Set("Accept-Language", "en-IE,en")
		resp, err := gHTTP.Do(req)
		if err != nil {
			last = err
		} else {
			b, err := io.ReadAll(resp.Body)
			resp.Body.Close()
			if err == nil && resp.StatusCode == 200 {
				return b, resp.Request.URL.String(), resp.Header.Get("Content-Type"), nil
			}
			if resp.StatusCode >= 400 && resp.StatusCode < 500 {
				return nil, "", "", fmt.Errorf("HTTP %d", resp.StatusCode)
			}
			last = fmt.Errorf("HTTP %d %v", resp.StatusCode, err)
		}
		select {
		case <-ctx.Done():
			return nil, "", "", ctx.Err()
		case <-time.After(time.Duration(3*(attempt+1)) * time.Second):
		}
	}
	return nil, "", "", last
}

// cleanHTML keeps the readable content of a page (headings, paragraphs, lists, tables, links), dropping navigation,
// scripts and chrome, and starting from the first <h1>. Returns title, body fragment, links and PDF links.
func cleanHTML(raw []byte, base *url.URL) (title, body string, links, pdfs []string) {
	z := xhtml.NewTokenizer(strings.NewReader(string(raw)))
	var out strings.Builder
	drop, inTitle, inH1 := 0, false, false
	var pageTitle, h1 strings.Builder
	for {
		tt := z.Next()
		if tt == xhtml.ErrorToken {
			break
		}
		tok := z.Token()
		name := strings.ToLower(tok.Data)
		attr := func(k string) string {
			for _, a := range tok.Attr {
				if strings.EqualFold(a.Key, k) {
					return a.Val
				}
			}
			return ""
		}
		switch tt {
		case xhtml.StartTagToken, xhtml.SelfClosingTagToken:
			if name == "title" {
				inTitle = true
			}
			if name == "a" {
				if h := attr("href"); h != "" {
					if ref, err := base.Parse(h); err == nil {
						ref.Fragment = ""
						if strings.HasSuffix(strings.ToLower(ref.Path), ".pdf") {
							pdfs = append(pdfs, ref.String())
						} else {
							links = append(links, ref.String())
						}
					}
				}
			}
			if gDrop[name] {
				if !gVoid[name] && tt == xhtml.StartTagToken {
					drop++
				}
				continue
			}
			if drop > 0 {
				continue
			}
			if name == "h1" {
				inH1 = true
			}
			if gKeep[name] {
				if name == "a" {
					ref, _ := base.Parse(attr("href"))
					href := ""
					if ref != nil {
						href = ref.String()
					}
					out.WriteString(`<a href="` + html.EscapeString(href) + `">`)
				} else {
					out.WriteString("<" + name + ">")
				}
			}
		case xhtml.EndTagToken:
			if name == "title" {
				inTitle = false
			}
			if gDrop[name] {
				if drop > 0 && !gVoid[name] {
					drop--
				}
				continue
			}
			if drop > 0 {
				continue
			}
			if name == "h1" {
				inH1 = false
			}
			if gKeep[name] && name != "br" {
				out.WriteString("</" + name + ">")
			}
		case xhtml.TextToken:
			s := tok.Data
			if inTitle {
				pageTitle.WriteString(s)
			}
			if drop > 0 {
				continue
			}
			if inH1 {
				h1.WriteString(s)
			}
			out.WriteString(html.EscapeString(s))
		}
	}
	body = out.String()
	if i := strings.Index(body, "<h1>"); i >= 0 {
		body = body[i:]
	}
	body = gSpaceRe.ReplaceAllString(body, "\n")
	body = gEmptyRe.ReplaceAllString(body, "")
	title = strings.TrimSpace(h1.String())
	if title == "" {
		title = strings.TrimSpace(strings.Split(strings.Split(pageTitle.String(), "|")[0], " - ")[0])
	}
	return title, body, links, pdfs
}

func gText(h string) string {
	return strings.TrimSpace(gWsRe.ReplaceAllString(html.UnescapeString(gTagRe.ReplaceAllString(h, " ")), " "))
}

func fetchGuidance(ctx context.Context, progress func(done, total int)) error {
	dir := filepath.Join(*dataDir, "guidance")
	os.MkdirAll(filepath.Join(dir, "pages"), 0o755)
	os.MkdirAll(filepath.Join(dir, "pdf"), 0o755)
	var index []gItem
	seen := map[string]bool{}
	total := len(guidanceSeeds) + len(guidancePDFs)
	done := 0
	tick := func() { done++; progress(done, total) }

	addPDF := func(u, title, src string) {
		if seen[u] {
			return
		}
		seen[u] = true
		name := gSlug(strings.TrimSuffix(path.Base(u), ".pdf")) + ".pdf"
		p := filepath.Join(dir, "pdf", name)
		if !isFile(p) {
			b, _, _, err := gGet(ctx, u)
			if err != nil || len(b) < 5 || string(b[:4]) != "%PDF" {
				log.Printf("guidance: pdf %s: %v", u, err)
				return
			}
			os.WriteFile(p, b, 0o644)
		}
		index = append(index, gItem{Type: "pdf", Title: title, Source: src, URL: u, File: "pdf/" + name})
	}
	var crawl func(u, src, prefix string, depth int)
	crawl = func(u, src, prefix string, depth int) {
		if seen[u] || len(index) > 260 || ctx.Err() != nil {
			return
		}
		seen[u] = true
		b, final, ct, err := gGet(ctx, u)
		if err != nil {
			log.Printf("guidance: %s: %v", u, err)
			return
		}
		if mt, _, _ := mime.ParseMediaType(ct); !strings.Contains(mt, "html") {
			return
		}
		base, _ := url.Parse(final)
		title, body, links, pdfs := cleanHTML(b, base)
		if text := gText(body); len(text) > 300 {
			name := gSlug(final) + ".html"
			os.WriteFile(filepath.Join(dir, "pages", name), []byte(body), 0o644)
			if len(text) > 20000 {
				text = text[:20000]
			}
			if title == "" {
				title = final
			}
			index = append(index, gItem{Type: "page", Title: title, Source: src, URL: final, File: "pages/" + name, Text: text})
		}
		for _, pu := range pdfs {
			if prefix != "" && (strings.HasPrefix(pu, prefix) || strings.Contains(pu, "assets.gov.ie") || strings.Contains(pu, "nidirect.gov.uk/sites") || strings.Contains(pu, "beready.campaign.gov.uk/wp-content")) {
				addPDF(pu, strings.NewReplacer("_", " ", "-", " ").Replace(strings.TrimSuffix(path.Base(pu), ".pdf")), src)
			}
		}
		if depth > 0 && prefix != "" {
			for _, l := range links {
				if strings.HasPrefix(l, prefix) && !gSkip.MatchString(l) {
					crawl(l, src, prefix, depth-1)
					time.Sleep(300 * time.Millisecond)
				}
			}
		}
	}
	for _, p := range guidancePDFs {
		addPDF(p[0], p[1], p[2])
		tick()
	}
	for _, s := range guidanceSeeds {
		crawl(s.URL, s.Source, s.Prefix, s.Depth)
		tick()
	}
	if ctx.Err() != nil {
		return ctx.Err()
	}
	if len(index) == 0 {
		return fmt.Errorf("couldn't reach any of the guidance sites")
	}
	b, _ := json.MarshalIndent(index, "", " ")
	return os.WriteFile(filepath.Join(dir, "index.json"), b, 0o644)
}

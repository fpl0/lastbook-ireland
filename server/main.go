// lastbook-server: the offline engine behind Lastbook Ireland.
//
//	/            the web app (static files from -web)
//	/kiwix/...   reverse proxy to a bundled kiwix-serve (Wikipedia, WikiMed, survival libraries…)
//	/data/...    app data (-data/data), then the data folder itself (/data/map/: PMTiles + terrain, HTTP Range)
//	/guidance/   official guidance snapshots (-data/guidance)
//	/api/docs    full-text search across survival manuals (PDF pages) and official guidance
//	/api/books   the Kiwix catalogue as JSON
package main

import (
	"encoding/json"
	"encoding/xml"
	"flag"
	"fmt"
	"log"
	"math"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"
	"unicode"
)

var (
	dataDir = flag.String("data", filepath.Join(os.Getenv("HOME"), "Library/Application Support/Lastbook Ireland"), "data folder")
	webDir  = flag.String("web", "web", "web app folder")
	port    = flag.Int("port", 0, "port (0 = any free port)")
	kiwix   = flag.String("kiwix", "", "path to kiwix-serve (default: <data>/bin/kiwix-serve)")
	portOut = flag.String("portfile", "", "write the chosen port to this file once listening")
)

// ---------------------------------------------------------------- documents index

type Doc struct {
	ID     string   `json:"id"`
	Title  string   `json:"title"`
	Cat    string   `json:"cat"`
	Source string   `json:"source"`
	URL    string   `json:"url"` // app-relative URL to open
	Pages  []string `json:"pages"`
	Dup    bool     `json:"dup"` // same manual as one already indexed: listed on its shelf, not searched twice
	Desc   string   `json:"desc"`
}

type posting struct{ doc, page int32 }

type tposting struct {
	posting
	tf float32
}

type index struct {
	docs  []Doc
	terms map[string][]tposting
}

var idx *index

func tokenize(s string) []string {
	return strings.FieldsFunc(strings.ToLower(s), func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) })
}

func loadIndex() {
	var docs []Doc
	b, err := os.ReadFile(filepath.Join(*dataDir, "data", "docs.json"))
	if err == nil {
		if err := json.Unmarshal(b, &docs); err != nil {
			log.Printf("docs.json: %v", err)
		}
	}
	ix := &index{docs: docs, terms: map[string][]tposting{}}
	for di, d := range docs {
		if d.Dup {
			continue
		}
		for pi, p := range d.Pages {
			cnt := map[string]int{}
			toks := tokenize(p)
			for ti, t := range toks {
				if len(t) < 2 {
					continue
				}
				cnt[t]++
				if ti < 25 { // words near the top of a page are usually headings
					cnt[t] += 2
				}
			}
			norm := 1 + math.Log(1+float64(len(toks))/400)
			for t, c := range cnt {
				ix.terms[t] = append(ix.terms[t], tposting{posting{int32(di), int32(pi)}, float32((1 + math.Log(float64(c))) / norm)})
			}
		}
	}
	idx = ix
	log.Printf("indexed %d documents, %d terms", len(docs), len(ix.terms))
}

type hit struct {
	Doc     string  `json:"doc"`
	Title   string  `json:"title"`
	Cat     string  `json:"cat"`
	Source  string  `json:"source"`
	URL     string  `json:"url"`
	Page    int     `json:"page"`
	Pages   int     `json:"pages"`
	Snippet string  `json:"snippet"`
	Score   float64 `json:"score"`
}

func snippet(text string, terms []string) string {
	low := strings.ToLower(text)
	at := -1
	for _, t := range terms {
		if i := strings.Index(low, t); i >= 0 && (at < 0 || i < at) {
			at = i
		}
	}
	if at < 0 {
		at = 0
	}
	start := at - 90
	if start < 0 {
		start = 0
	}
	end := start + 260
	if end > len(text) {
		end = len(text)
	}
	// keep valid UTF-8 boundaries
	for start > 0 && !utf8Start(text[start]) {
		start--
	}
	for end < len(text) && !utf8Start(text[end]) {
		end++
	}
	s := strings.Join(strings.Fields(text[start:end]), " ")
	if start > 0 {
		s = "…" + s
	}
	if end < len(text) {
		s += "…"
	}
	return s
}
func utf8Start(b byte) bool { return b&0xC0 != 0x80 }

func searchDocs(q string, limit int) []hit {
	terms := []string{}
	for _, t := range tokenize(q) {
		if len(t) >= 2 {
			terms = append(terms, t)
		}
	}
	if len(terms) == 0 || idx == nil {
		return nil
	}
	// AND across terms (prefix match for the last term so search-as-you-type works)
	var cand map[posting]float64
	for i, t := range terms {
		lists := [][]tposting{idx.terms[t]}
		if i == len(terms)-1 && len(t) >= 3 {
			lists = nil
			for k, v := range idx.terms {
				if strings.HasPrefix(k, t) {
					lists = append(lists, v)
				}
			}
		}
		next := map[posting]float64{}
		n := 0
		for _, l := range lists {
			n += len(l)
		}
		w := math.Log(1 + float64(len(idx.docs)*40)/float64(n+1))
		for _, l := range lists {
			for _, p := range l {
				sc := w * float64(p.tf)
				if cand == nil {
					if sc > next[p.posting] {
						next[p.posting] = sc
					}
				} else if s, ok := cand[p.posting]; ok && s+sc > next[p.posting] {
					next[p.posting] = s + sc
				}
			}
		}
		cand = next
		if len(cand) == 0 {
			return nil
		}
	}
	// title boost, then keep the best page per document
	best := map[int32]hit{}
	for p, s := range cand {
		d := idx.docs[p.doc]
		tl := strings.ToLower(d.Title)
		for _, t := range terms {
			if strings.Contains(tl, t) {
				s += 1.5
			}
		}
		if h, ok := best[p.doc]; !ok || s > h.Score || (s == h.Score && int(p.page) < h.Page-1) {
			best[p.doc] = hit{Doc: d.ID, Title: d.Title, Cat: d.Cat, Source: d.Source, URL: d.URL, Page: int(p.page) + 1, Pages: len(d.Pages), Score: s}
		}
	}
	out := make([]hit, 0, len(best))
	for di, h := range best {
		h.Snippet = snippet(idx.docs[di].Pages[h.Page-1], terms)
		out = append(out, h)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Score > out[j].Score })
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}

// ---------------------------------------------------------------- kiwix

type opdsFeed struct {
	Entries []struct {
		Title    string `xml:"title"`
		Name     string `xml:"name"`
		Summary  string `xml:"summary"`
		Count    int    `xml:"articleCount"`
		Media    int    `xml:"mediaCount"`
		Tags     string `xml:"tags"`
		Category string `xml:"category"`
		Links    []struct {
			Rel  string `xml:"rel,attr"`
			Type string `xml:"type,attr"`
			Href string `xml:"href,attr"`
		} `xml:"link"`
	} `xml:"entry"`
}

func startKiwix() (string, *exec.Cmd) {
	bin := *kiwix
	if bin == "" {
		bin = filepath.Join(*dataDir, "bin", "kiwix-serve")
	}
	lib := filepath.Join(*dataDir, "library.xml")
	if _, err := os.Stat(bin); err != nil {
		log.Printf("kiwix-serve not found at %s — library disabled", bin)
		return "", nil
	}
	l, _ := net.Listen("tcp", "127.0.0.1:0")
	kp := l.Addr().(*net.TCPAddr).Port
	l.Close()
	cmd := exec.Command(bin, "--library", "--address", "127.0.0.1", "--port", fmt.Sprint(kp),
		"--urlRootLocation", "/kiwix", "--nodatealiases", "--threads", "8", "--searchLimit", "50", lib)
	cmd.Stdout, cmd.Stderr = os.Stderr, os.Stderr
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if err := cmd.Start(); err != nil {
		log.Printf("kiwix-serve: %v", err)
		return "", nil
	}
	target := fmt.Sprintf("http://127.0.0.1:%d", kp)
	for i := 0; i < 100; i++ {
		if c, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", kp), 100*time.Millisecond); err == nil {
			c.Close()
			break
		}
		time.Sleep(50 * time.Millisecond)
	}
	log.Printf("kiwix-serve on %s", target)
	return target, cmd
}

// ---------------------------------------------------------------- http

func jsonOut(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(v)
}

type noDirFS struct{ http.FileSystem }

func (f noDirFS) Open(name string) (http.File, error) {
	file, err := f.FileSystem.Open(name)
	if err != nil {
		return nil, err
	}
	if st, _ := file.Stat(); st != nil && st.IsDir() {
		if idx, err := f.FileSystem.Open(strings.TrimSuffix(name, "/") + "/index.html"); err == nil {
			idx.Close()
		} else {
			file.Close()
			return nil, os.ErrNotExist
		}
	}
	return file, nil
}

func static(prefix, dir string, cache string) http.Handler {
	fs := http.StripPrefix(prefix, http.FileServer(noDirFS{http.Dir(dir)}))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if cache != "" {
			w.Header().Set("Cache-Control", cache)
		}
		if strings.HasSuffix(r.URL.Path, ".webp") {
			w.Header().Set("Content-Type", "image/webp")
		}
		if strings.HasSuffix(r.URL.Path, ".pbf") || strings.HasSuffix(r.URL.Path, ".pmtiles") {
			w.Header().Set("Content-Type", "application/x-protobuf")
		}
		fs.ServeHTTP(w, r)
	})
}

func main() {
	flag.Parse()
	loadIndex()
	kt, kcmd := startKiwix()
	mux := http.NewServeMux()

	var books []map[string]any
	var booksMu sync.Mutex
	if kt != "" {
		ku, _ := url.Parse(kt)
		proxy := httputil.NewSingleHostReverseProxy(ku)
		proxy.ModifyResponse = func(r *http.Response) error {
			r.Header.Del("Content-Security-Policy")
			r.Header.Del("X-Frame-Options")
			return nil
		}
		mux.Handle("/kiwix/", proxy)
		mux.HandleFunc("/api/books", func(w http.ResponseWriter, r *http.Request) {
			booksMu.Lock()
			defer booksMu.Unlock()
			if books == nil {
				resp, err := http.Get(kt + "/kiwix/catalog/v2/entries?count=-1")
				if err != nil {
					http.Error(w, err.Error(), 502)
					return
				}
				var f opdsFeed
				xml.NewDecoder(resp.Body).Decode(&f)
				resp.Body.Close()
				books = []map[string]any{}
				for _, e := range f.Entries {
					b := map[string]any{"title": e.Title, "name": e.Name, "summary": e.Summary, "articles": e.Count, "media": e.Media, "tags": e.Tags, "category": e.Category}
					for _, l := range e.Links {
						switch {
						case l.Type == "text/html":
							b["href"] = l.Href
							b["book"] = strings.TrimPrefix(l.Href, "/kiwix/content/")
						case strings.Contains(l.Rel, "illustration"):
							b["icon"] = l.Href
						}
					}
					b["ftindex"] = strings.Contains(e.Tags, "_ftindex:yes")
					books = append(books, b)
				}
			}
			jsonOut(w, books)
		})
	}
	mux.HandleFunc("/api/docs", func(w http.ResponseWriter, r *http.Request) {
		jsonOut(w, searchDocs(r.URL.Query().Get("q"), 40))
	})
	mux.HandleFunc("/api/doclist", func(w http.ResponseWriter, r *http.Request) {
		type d struct {
			ID, Title, Cat, Source, URL, Desc string
			Pages                             int
			Dup                               bool
		}
		out := []d{}
		if idx != nil {
			for _, x := range idx.docs {
				out = append(out, d{ID: x.ID, Title: x.Title, Cat: x.Cat, Source: x.Source, URL: x.URL, Desc: x.Desc, Pages: len(x.Pages), Dup: x.Dup})
			}
		}
		jsonOut(w, out)
	})
	mux.HandleFunc("/api/log", func(w http.ResponseWriter, r *http.Request) {
		b := make([]byte, 4096)
		n, _ := r.Body.Read(b)
		log.Printf("[page] %s", strings.TrimSpace(string(b[:n])))
		w.WriteHeader(204)
	})
	mux.HandleFunc("/api/status", func(w http.ResponseWriter, r *http.Request) {
		jsonOut(w, map[string]any{"kiwix": kt != "", "docs": idx != nil && len(idx.docs) > 0})
	})
	dataMine := static("/data/", filepath.Join(*dataDir, "data"), "no-cache")
	dataRoot := static("/data/", *dataDir, "max-age=86400")
	mux.HandleFunc("/data/", func(w http.ResponseWriter, r *http.Request) {
		rel := filepath.Clean("/" + strings.TrimPrefix(r.URL.Path, "/data/"))
		if st, err := os.Stat(filepath.Join(*dataDir, "data", rel)); err == nil && !st.IsDir() {
			dataMine.ServeHTTP(w, r)
			return
		}
		dataRoot.ServeHTTP(w, r)
	})
	mux.Handle("/guidance/", static("/guidance/", filepath.Join(*dataDir, "guidance"), "max-age=3600"))
	mux.Handle("/", static("/", *webDir, "no-cache"))

	l, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", *port))
	if err != nil {
		log.Fatal(err)
	}
	p := l.Addr().(*net.TCPAddr).Port
	log.Printf("Lastbook on http://127.0.0.1:%d", p)
	if *portOut != "" {
		os.WriteFile(*portOut, []byte(fmt.Sprint(p)), 0o644)
	}
	stop := func() {
		if kcmd != nil && kcmd.Process != nil {
			syscall.Kill(-kcmd.Process.Pid, syscall.SIGTERM)
		}
	}
	go func() {
		c := make(chan os.Signal, 1)
		signal.Notify(c, os.Interrupt, syscall.SIGTERM, syscall.SIGHUP)
		<-c
		stop()
		os.Exit(0)
	}()
	// exit if our parent (the app) goes away
	go func() {
		pp := os.Getppid()
		for range time.Tick(2 * time.Second) {
			if os.Getppid() != pp {
				stop()
				os.Exit(0)
			}
		}
	}()
	log.Fatal(http.Serve(l, mux))
}

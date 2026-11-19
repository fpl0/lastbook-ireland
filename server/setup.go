// In-app setup: downloads the offline data (libraries, map, terrain, official guidance) and builds the search
// indexes, with no developer tools. Runs inside the engine so it continues while the window shows other screens,
// resumes interrupted downloads, verifies every library against its published SHA-256, and picks up again when the
// app is reopened after an interruption.
package main

import (
	"bufio"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

const userAgent = "Lastbook-Ireland/2.1 (offline setup; +https://github.com/fpl0/lastbook-ireland)"

var mapBBox = [4]float64{-12.0, 50.8, -4.3, 56.0} // island + Atlantic edge, North Channel, Isle of Man, Galloway

const (
	kiwixBase      = "https://download.kiwix.org/zim/"
	protomapsMeta  = "https://build-metadata.protomaps.dev/builds.json"
	protomapsBuild = "https://build.protomaps.com/"
	terrainSource  = "https://download.mapterhorn.com/planet.pmtiles"
)

type libDef struct {
	Path, Title, Group string
	Size               int64 // approximate, for planning; the real size comes from the server
	Default            bool
}

const gMed, gSurv, gBuild, gRef = "Emergency & medicine", "Survival & preparedness", "Rebuilding: skills, energy & science", "General knowledge"

var libraryCatalog = []libDef{
	{"wikipedia/wikipedia_en_medicine_maxi_2026-10.zim", "WikiMed Medical Encyclopedia", gMed, 1_800_000_000, true},
	{"zimit/nhs.uk_en_medicines_2026-09b.zim", "NHS Medicines A–Z", gMed, 15_000_000, true},
	{"other/zimgit-medicine_en_2024-08.zim", "Austere Medicine Library", gMed, 81_000_000, true},
	{"zimit/irp.fas.org_en_military-medicine_2026-10.zim", "Military Medicine", gMed, 62_000_000, true},
	{"libretexts/libretexts.org_en_med_2025-01.zim", "Medicine Textbooks", gMed, 1_100_000_000, false},
	{"other/zimgit-post-disaster_en_2024-05.zim", "Post-Disaster Library", gSurv, 624_000_000, true},
	{"other/zimgit-water_en_2024-08.zim", "Water Treatment Library", gSurv, 21_000_000, true},
	{"other/zimgit-food-preparation_en_2025-04.zim", "Food & Preserving", gSurv, 96_000_000, true},
	{"other/zimgit-knots_en_2024-08.zim", "Knots & Rope", gSurv, 27_000_000, true},
	{"other/gardenology.org_en_all_2026-09.zim", "Gardenology", gSurv, 112_000_000, true},
	{"zimit/cd3wdproject.org_en_all_2026-11.zim", "CD3WD — Rebuild & Development", gBuild, 560_000_000, true},
	{"other/appropedia_en_all_maxi_2026-02.zim", "Appropedia", gBuild, 560_000_000, true},
	{"other/energypedia_en_all_maxi_2026-06.zim", "Energypedia", gBuild, 768_000_000, true},
	{"libretexts/libretexts.org_en_workforce_2026-01.zim", "Trades & Workforce", gBuild, 496_000_000, true},
	{"libretexts/libretexts.org_en_eng_2025-01.zim", "Engineering", gBuild, 656_000_000, false},
	{"ifixit/ifixit_en_all_2025-12.zim", "iFixit Repair Guides", gBuild, 3_300_000_000, false},
	{"libretexts/libretexts.org_en_chem_2025-01.zim", "Chemistry", gBuild, 2_000_000_000, false},
	{"libretexts/libretexts.org_en_phys_2026-01.zim", "Physics", gBuild, 544_000_000, false},
	{"libretexts/libretexts.org_en_bio_2025-01.zim", "Biology", gBuild, 2_100_000_000, false},
	{"libretexts/libretexts.org_en_math_2026-01.zim", "Mathematics", gBuild, 800_000_000, false},
	{"libretexts/libretexts.org_en_socialsci_2025-01.zim", "Social Science", gBuild, 1_900_000_000, false},
	{"wikipedia/wikipedia_en_top_maxi_2026-09.zim", "Wikipedia (most-read articles)", gRef, 6_500_000_000, true},
	{"wikibooks/wikibooks_en_all_maxi_2026-10.zim", "Wikibooks", gRef, 4_400_000_000, false},
	{"wikivoyage/wikivoyage_en_all_maxi_2026-06.zim", "Wikivoyage", gRef, 1_100_000_000, false},
	{"zimit/internet-encyclopedia-philosophy_en_all_2026-05.zim", "Internet Encyclopedia of Philosophy", gRef, 128_000_000, false},
}

type setupItem struct {
	ID, Kind, Title, Group string
	Size, Done             int64
	Status                 string // installed | queued | active | verifying | done | error | stopped
	Error                  string `json:",omitempty"`
	Default, Selected      bool
}

type setupMgr struct {
	mu      sync.Mutex
	items   []*setupItem
	running bool
	phase   string
	cancel  context.CancelFunc
	onLib   func()       // a library finished: refresh the Kiwix reader
	onIndex func()       // indexes rebuilt: reload them
	speed   atomic.Int64 // bytes/s, smoothed
	moved   atomic.Int64 // bytes since last tick
}

var setup = &setupMgr{}

func zimFile(path string) string { return filepath.Join(*dataDir, "zim", filepath.Base(path)) }
func isFile(p string) bool       { st, err := os.Stat(p); return err == nil && !st.IsDir() }

func (m *setupMgr) installed(it *setupItem) bool {
	switch it.Kind {
	case "library":
		return isFile(zimFile(it.ID) + ".ok")
	case "map":
		return isFile(filepath.Join(*dataDir, "map", "ireland.pmtiles"))
	case "terrain":
		return isFile(filepath.Join(*dataDir, "map", "terrain", "5", "15", "10.webp"))
	case "guidance":
		return isFile(filepath.Join(*dataDir, "guidance", "index.json"))
	case "index":
		return isFile(filepath.Join(*dataDir, "data", "docs.json"))
	}
	return false
}

func (m *setupMgr) init() {
	m.items = []*setupItem{
		{ID: "map", Kind: "map", Title: "Map of Ireland (OpenStreetMap, street level)", Group: "Map", Size: 680_000_000, Default: true},
		{ID: "terrain", Kind: "terrain", Title: "Terrain (hill shading, contours, heights)", Group: "Map", Size: 300_000_000, Default: true},
	}
	for _, l := range libraryCatalog {
		m.items = append(m.items, &setupItem{ID: l.Path, Kind: "library", Title: l.Title, Group: l.Group, Size: l.Size, Default: l.Default})
	}
	m.items = append(m.items,
		&setupItem{ID: "guidance", Kind: "guidance", Title: "Official guidance (gov.ie, nidirect, HSE, Met Éireann…)", Group: "Guidance & search", Size: 15_000_000, Default: true},
		&setupItem{ID: "index", Kind: "index", Title: "Search index for manuals and guidance", Group: "Guidance & search", Size: 0, Default: true})
	for _, it := range m.items {
		if m.installed(it) {
			it.Status, it.Done = "installed", it.Size
		}
	}
	go m.ticker()
	// an interrupted run resumes when the app reopens (a run the user stopped does not)
	var saved struct {
		Selected   []string
		Unfinished bool
	}
	if b, err := os.ReadFile(m.stateFile()); err == nil && json.Unmarshal(b, &saved) == nil && saved.Unfinished && len(saved.Selected) > 0 {
		log.Printf("setup: resuming %d items", len(saved.Selected))
		m.start(saved.Selected)
	}
}

func (m *setupMgr) stateFile() string { return filepath.Join(*dataDir, "setup.json") }

func (m *setupMgr) saveState(sel []string, unfinished bool) {
	os.MkdirAll(*dataDir, 0o755)
	b, _ := json.Marshal(map[string]any{"Selected": sel, "Unfinished": unfinished})
	os.WriteFile(m.stateFile(), b, 0o644)
}

func (m *setupMgr) ticker() {
	for range time.Tick(time.Second) {
		n := m.moved.Swap(0)
		m.speed.Store((m.speed.Load()*3 + n) / 4)
	}
}

func freeBytes() int64 {
	var st syscall.Statfs_t
	p := *dataDir
	for !isDir(p) && p != "/" {
		p = filepath.Dir(p)
	}
	if syscall.Statfs(p, &st) != nil {
		return -1
	}
	return int64(st.Bavail) * int64(st.Bsize)
}
func isDir(p string) bool { st, err := os.Stat(p); return err == nil && st.IsDir() }

func (m *setupMgr) snapshot() map[string]any {
	m.mu.Lock()
	defer m.mu.Unlock()
	items := make([]setupItem, len(m.items))
	for i, it := range m.items {
		items[i] = *it
	}
	return map[string]any{"running": m.running, "phase": m.phase, "items": items, "free": freeBytes(), "speed": m.speed.Load(), "dataDir": *dataDir}
}

func (m *setupMgr) find(id string) *setupItem {
	for _, it := range m.items {
		if it.ID == id {
			return it
		}
	}
	return nil
}

func (m *setupMgr) set(it *setupItem, f func(*setupItem)) { m.mu.Lock(); f(it); m.mu.Unlock() }

func (m *setupMgr) stop() {
	m.mu.Lock()
	if m.cancel != nil {
		m.cancel()
	}
	m.mu.Unlock()
}

// start runs the selected items (ids). Map items first, then libraries smallest-first so useful things arrive early,
// then guidance and the search index.
func (m *setupMgr) start(ids []string) {
	m.mu.Lock()
	if m.running {
		m.mu.Unlock()
		return
	}
	want := map[string]bool{}
	for _, id := range ids {
		want[id] = true
	}
	var queue []*setupItem
	for _, it := range m.items {
		it.Selected = want[it.ID]
		if it.Selected && !m.installed(it) {
			it.Status, it.Error = "queued", ""
			queue = append(queue, it)
		}
	}
	// always rebuild the index when anything it covers is (re)installed
	if ix := m.find("index"); len(queue) > 0 && !want["index"] {
		ix.Selected, ix.Status = true, "queued"
		queue = append(queue, ix)
		ids = append(ids, "index")
	}
	ctx, cancel := context.WithCancel(context.Background())
	m.cancel, m.running = cancel, true
	m.mu.Unlock()
	m.saveState(ids, true)
	go func() {
		stoppedByUser := false
		var failed []string
		for _, it := range queue {
			if ctx.Err() != nil {
				stoppedByUser = true
				m.set(it, func(i *setupItem) { i.Status = "stopped" })
				continue
			}
			m.set(it, func(i *setupItem) { i.Status, i.Done = "active", 0 })
			m.mu.Lock()
			m.phase = it.Title
			m.mu.Unlock()
			err := m.run(ctx, it)
			switch {
			case err == nil:
				m.set(it, func(i *setupItem) { i.Status, i.Done = "done", i.Size })
			case ctx.Err() != nil:
				stoppedByUser = true
				m.set(it, func(i *setupItem) { i.Status = "stopped" })
			default:
				log.Printf("setup: %s: %v", it.ID, err)
				failed = append(failed, it.ID)
				m.set(it, func(i *setupItem) { i.Status, i.Error = "error", err.Error() })
			}
		}
		m.mu.Lock()
		m.running, m.cancel, m.phase = false, nil, ""
		m.mu.Unlock()
		m.saveState(ids, false)
		_ = stoppedByUser
		if len(failed) > 0 {
			log.Printf("setup: finished with %d errors", len(failed))
		}
	}()
}

func (m *setupMgr) run(ctx context.Context, it *setupItem) error {
	switch it.Kind {
	case "library":
		if err := m.downloadLibrary(ctx, it); err != nil {
			return err
		}
		if m.onLib != nil {
			m.onLib()
		}
		return nil
	case "map":
		build, err := latestProtomapsBuild(ctx)
		if err != nil {
			return err
		}
		os.MkdirAll(filepath.Join(*dataDir, "map"), 0o755)
		return m.extract(ctx, it, func(p *extractProgress) error {
			return extractPMTiles(ctx, protomapsBuild+build, filepath.Join(*dataDir, "map", "ireland.pmtiles"), mapBBox, 15, p)
		})
	case "terrain":
		os.MkdirAll(filepath.Join(*dataDir, "map"), 0o755)
		return m.extract(ctx, it, func(p *extractProgress) error {
			return extractTileFiles(ctx, terrainSource, filepath.Join(*dataDir, "map", "terrain"), "webp", mapBBox, 12, p)
		})
	case "guidance":
		return fetchGuidance(ctx, func(done, total int) { m.set(it, func(i *setupItem) { i.Size, i.Done = int64(total), int64(done) }) })
	case "index":
		err := buildIndexes(ctx, func(done, total int) { m.set(it, func(i *setupItem) { i.Size, i.Done = int64(total), int64(done) }) })
		if err == nil && m.onIndex != nil {
			m.onIndex()
		}
		return err
	}
	return fmt.Errorf("unknown item kind %q", it.Kind)
}

func (m *setupMgr) extract(ctx context.Context, it *setupItem, f func(*extractProgress) error) error {
	var p extractProgress
	done := make(chan error, 1)
	go func() { done <- f(&p) }()
	var last int64
	for {
		select {
		case err := <-done:
			return err
		case <-time.After(400 * time.Millisecond):
			d := p.Done.Load()
			m.moved.Add(d - last)
			last = d
			m.set(it, func(i *setupItem) {
				if t := p.Total.Load(); t > 0 {
					i.Size = t
				}
				i.Done = d
			})
		}
	}
}

func latestProtomapsBuild(ctx context.Context) (string, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", protomapsMeta, nil)
	req.Header.Set("User-Agent", userAgent)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var builds []struct{ Key string }
	if err := json.NewDecoder(resp.Body).Decode(&builds); err != nil || len(builds) == 0 {
		return "", fmt.Errorf("couldn't read the list of map builds: %v", err)
	}
	return builds[len(builds)-1].Key, nil
}

// ---------------------------------------------------------------- library downloads

var dlClient = &http.Client{Timeout: 0, Transport: &http.Transport{Proxy: http.ProxyFromEnvironment, ResponseHeaderTimeout: 60 * time.Second, IdleConnTimeout: 90 * time.Second}}

type countingWriter struct {
	w  io.Writer
	n  *int64
	m  *setupMgr
	it *setupItem
}

func (c countingWriter) Write(p []byte) (int, error) {
	n, err := c.w.Write(p)
	atomic.AddInt64(c.n, int64(n))
	c.m.moved.Add(int64(n))
	return n, err
}

func (m *setupMgr) downloadLibrary(ctx context.Context, it *setupItem) error {
	dest := zimFile(it.ID)
	os.MkdirAll(filepath.Dir(dest), 0o755)
	part := dest + ".part"
	if isFile(dest) && !isFile(part) { // a file left by an older, interrupted download: resume it
		os.Rename(dest, part)
	}
	url := kiwixBase + it.ID
	want, err := fetchChecksum(ctx, url+".sha256")
	if err != nil {
		return fmt.Errorf("couldn't get the checksum: %w", err)
	}
	for attempt := 0; ; attempt++ {
		err := m.fetchResume(ctx, url, part, it)
		if err != nil {
			if ctx.Err() != nil || attempt >= 4 {
				return err
			}
			time.Sleep(time.Duration(attempt+1) * 5 * time.Second)
			continue
		}
		m.set(it, func(i *setupItem) { i.Status = "verifying" })
		got, err := sha256File(ctx, part)
		if err != nil {
			return err
		}
		if got != want {
			os.Remove(part)
			if attempt >= 1 {
				return errors.New("checksum mismatch — the download was corrupted")
			}
			m.set(it, func(i *setupItem) { i.Status, i.Done = "active", 0 })
			continue
		}
		if err := os.Rename(part, dest); err != nil {
			return err
		}
		return os.WriteFile(dest+".ok", []byte(want+"\n"), 0o644)
	}
}

func fetchChecksum(ctx context.Context, url string) (string, error) {
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	req.Header.Set("User-Agent", userAgent)
	resp, err := dlClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	line, _ := bufio.NewReader(resp.Body).ReadString('\n')
	f := strings.Fields(line)
	if len(f) == 0 || len(f[0]) != 64 {
		return "", errors.New("unexpected checksum format")
	}
	return strings.ToLower(f[0]), nil
}

func (m *setupMgr) fetchResume(ctx context.Context, url, part string, it *setupItem) error {
	var have int64
	if st, err := os.Stat(part); err == nil {
		have = st.Size()
	}
	req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
	req.Header.Set("User-Agent", userAgent)
	if have > 0 {
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-", have))
	}
	resp, err := dlClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	flags := os.O_CREATE | os.O_WRONLY
	switch {
	case resp.StatusCode == 206:
		flags |= os.O_APPEND
	case resp.StatusCode == 200:
		flags |= os.O_TRUNC
		have = 0
	case resp.StatusCode == 416: // already complete
		return nil
	default:
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	total := have + resp.ContentLength
	done := have
	m.set(it, func(i *setupItem) { i.Size, i.Done = total, have })
	f, err := os.OpenFile(part, flags, 0o644)
	if err != nil {
		return err
	}
	defer f.Close()
	stop := make(chan struct{})
	defer close(stop)
	go func() {
		for {
			select {
			case <-stop:
				return
			case <-time.After(400 * time.Millisecond):
				d := atomic.LoadInt64(&done)
				m.set(it, func(i *setupItem) { i.Done = d })
			}
		}
	}()
	_, err = io.Copy(countingWriter{f, &done, m, it}, resp.Body)
	if err == nil && resp.ContentLength > 0 && atomic.LoadInt64(&done) != total {
		err = io.ErrUnexpectedEOF
	}
	return err
}

func sha256File(ctx context.Context, p string) (string, error) {
	f, err := os.Open(p)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	buf := make([]byte, 4<<20)
	for {
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		n, err := f.Read(buf)
		h.Write(buf[:n])
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", err
		}
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// ---------------------------------------------------------------- HTTP API

func setupRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/setup", func(w http.ResponseWriter, r *http.Request) { jsonOut(w, setup.snapshot()) })
	mux.HandleFunc("/api/setup/start", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "POST", 405)
			return
		}
		var body struct{ Items []string }
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		setup.start(body.Items)
		jsonOut(w, setup.snapshot())
	})
	mux.HandleFunc("/api/setup/stop", func(w http.ResponseWriter, r *http.Request) {
		setup.stop()
		jsonOut(w, setup.snapshot())
	})
}

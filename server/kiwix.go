// Runs kiwix-serve over every verified library (zim/*.zim with a .ok checksum marker) and restarts it when the
// in-app setup finishes a new library, so each one becomes readable as soon as it arrives.
package main

import (
	"encoding/xml"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"
)

type kiwixMgr struct {
	mu    sync.Mutex
	url   string
	cmd   *exec.Cmd
	books []map[string]any
}

var kiwix = &kiwixMgr{}

func (k *kiwixMgr) target() string { k.mu.Lock(); defer k.mu.Unlock(); return k.url }

func verifiedZims() []string {
	files, _ := filepath.Glob(filepath.Join(*dataDir, "zim", "*.zim"))
	var out []string
	for _, f := range files {
		if isFile(f + ".ok") {
			out = append(out, f)
		}
	}
	sort.Strings(out)
	return out
}

func (k *kiwixMgr) restart() {
	k.mu.Lock()
	defer k.mu.Unlock()
	k.stopLocked()
	k.books = nil
	zims := verifiedZims()
	if len(zims) == 0 {
		log.Printf("no libraries installed yet — use Set up offline data in the app")
		return
	}
	bin := *kiwixPath
	if bin == "" {
		bin = filepath.Join(*dataDir, "bin", "kiwix-serve")
	}
	if !isFile(bin) {
		log.Printf("kiwix-serve not found at %s — library disabled", bin)
		return
	}
	l, _ := net.Listen("tcp", "127.0.0.1:0")
	kp := l.Addr().(*net.TCPAddr).Port
	l.Close()
	args := append([]string{"--address", "127.0.0.1", "--port", fmt.Sprint(kp), "--urlRootLocation", "/kiwix",
		"--nodatealiases", "--threads", "8", "--searchLimit", "50"}, zims...)
	cmd := exec.Command(bin, args...)
	cmd.Stdout, cmd.Stderr = os.Stderr, os.Stderr
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	if err := cmd.Start(); err != nil {
		log.Printf("kiwix-serve: %v", err)
		return
	}
	exited := make(chan struct{})
	go func() { cmd.Wait(); close(exited) }()
	for i := 0; i < 300; i++ {
		select {
		case <-exited:
			log.Printf("kiwix-serve exited — library disabled")
			return
		default:
		}
		if c, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", kp), 100*time.Millisecond); err == nil {
			c.Close()
			k.url, k.cmd = fmt.Sprintf("http://127.0.0.1:%d", kp), cmd
			log.Printf("kiwix-serve on %s with %d libraries", k.url, len(zims))
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM)
	log.Printf("kiwix-serve did not start — library disabled")
}

func (k *kiwixMgr) stopLocked() {
	if k.cmd != nil && k.cmd.Process != nil {
		syscall.Kill(-k.cmd.Process.Pid, syscall.SIGTERM)
	}
	k.cmd, k.url = nil, ""
}

func (k *kiwixMgr) stop() { k.mu.Lock(); k.stopLocked(); k.mu.Unlock() }

func (k *kiwixMgr) routes(mux *http.ServeMux) {
	proxy := &httputil.ReverseProxy{
		Rewrite: func(r *httputil.ProxyRequest) {
			u, _ := url.Parse(k.target())
			r.SetURL(u)
			r.Out.Host = u.Host
		},
		ModifyResponse: func(r *http.Response) error {
			r.Header.Del("Content-Security-Policy")
			r.Header.Del("X-Frame-Options")
			return nil
		},
	}
	mux.HandleFunc("/kiwix/", func(w http.ResponseWriter, r *http.Request) {
		if k.target() == "" {
			http.Error(w, "No libraries are installed yet.", http.StatusServiceUnavailable)
			return
		}
		proxy.ServeHTTP(w, r)
	})
	mux.HandleFunc("/api/books", func(w http.ResponseWriter, r *http.Request) {
		k.mu.Lock()
		cached, base := k.books, k.url
		k.mu.Unlock()
		if cached == nil && base != "" {
			resp, err := http.Get(base + "/kiwix/catalog/v2/entries?count=-1")
			if err != nil {
				http.Error(w, err.Error(), 502)
				return
			}
			var f opdsFeed
			xml.NewDecoder(resp.Body).Decode(&f)
			resp.Body.Close()
			cached = []map[string]any{}
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
				cached = append(cached, b)
			}
			k.mu.Lock()
			if k.url == base {
				k.books = cached
			}
			k.mu.Unlock()
		}
		if cached == nil {
			cached = []map[string]any{}
		}
		jsonOut(w, cached)
	})
}

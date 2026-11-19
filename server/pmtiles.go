// Regional extraction from a PMTiles v3 archive (local file or HTTP range requests), with no external tools.
// Used by the in-app setup to pull the Ireland basemap out of the Protomaps planet build (written as a new
// .pmtiles archive) and the terrain out of Mapterhorn (written as {z}/{x}/{y}.webp files).
// Spec: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// ---------------------------------------------------------------- sources

type rangeSource interface {
	ReadRange(ctx context.Context, off, n uint64) ([]byte, error)
}

type fileSource struct{ f *os.File }

func (s fileSource) ReadRange(_ context.Context, off, n uint64) ([]byte, error) {
	b := make([]byte, n)
	_, err := s.f.ReadAt(b, int64(off))
	return b, err
}

type httpSource struct {
	url    string
	client *http.Client
}

func (s httpSource) ReadRange(ctx context.Context, off, n uint64) ([]byte, error) {
	var last error
	for attempt := 0; attempt < 6; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(time.Duration(attempt*attempt) * time.Second):
			}
		}
		req, _ := http.NewRequestWithContext(ctx, "GET", s.url, nil)
		req.Header.Set("Range", fmt.Sprintf("bytes=%d-%d", off, off+n-1))
		req.Header.Set("User-Agent", userAgent)
		resp, err := s.client.Do(req)
		if err != nil {
			last = err
			continue
		}
		b, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			last = err
			continue
		}
		if resp.StatusCode != 206 || uint64(len(b)) != n {
			last = fmt.Errorf("range %d+%d: HTTP %d, %d bytes", off, n, resp.StatusCode, len(b))
			continue
		}
		return b, nil
	}
	return nil, last
}

// ---------------------------------------------------------------- format

type pmHeader struct {
	RootOff, RootLen, MetaOff, MetaLen, LeafOff, LeafLen, DataOff, DataLen uint64
	Addressed, Entries, Contents                                           uint64
	Clustered                                                              bool
	InternalComp, TileComp, TileType, MinZ, MaxZ                           uint8
	MinLon, MinLat, MaxLon, MaxLat                                         int32
	CenterZ                                                                uint8
	CenterLon, CenterLat                                                   int32
}

func parseHeader(b []byte) (pmHeader, error) {
	var h pmHeader
	if len(b) < 127 || string(b[0:7]) != "PMTiles" || b[7] != 3 {
		return h, errors.New("not a PMTiles v3 archive")
	}
	u := func(i int) uint64 { return binary.LittleEndian.Uint64(b[i:]) }
	i32 := func(i int) int32 { return int32(binary.LittleEndian.Uint32(b[i:])) }
	h = pmHeader{RootOff: u(8), RootLen: u(16), MetaOff: u(24), MetaLen: u(32), LeafOff: u(40), LeafLen: u(48), DataOff: u(56), DataLen: u(64),
		Addressed: u(72), Entries: u(80), Contents: u(88), Clustered: b[96] == 1, InternalComp: b[97], TileComp: b[98], TileType: b[99],
		MinZ: b[100], MaxZ: b[101], MinLon: i32(102), MinLat: i32(106), MaxLon: i32(110), MaxLat: i32(114), CenterZ: b[118], CenterLon: i32(119), CenterLat: i32(123)}
	return h, nil
}

func (h pmHeader) bytes() []byte {
	b := make([]byte, 127)
	copy(b, "PMTiles")
	b[7] = 3
	p := func(i int, v uint64) { binary.LittleEndian.PutUint64(b[i:], v) }
	q := func(i int, v int32) { binary.LittleEndian.PutUint32(b[i:], uint32(v)) }
	p(8, h.RootOff)
	p(16, h.RootLen)
	p(24, h.MetaOff)
	p(32, h.MetaLen)
	p(40, h.LeafOff)
	p(48, h.LeafLen)
	p(56, h.DataOff)
	p(64, h.DataLen)
	p(72, h.Addressed)
	p(80, h.Entries)
	p(88, h.Contents)
	if h.Clustered {
		b[96] = 1
	}
	b[97], b[98], b[99], b[100], b[101] = h.InternalComp, h.TileComp, h.TileType, h.MinZ, h.MaxZ
	q(102, h.MinLon)
	q(106, h.MinLat)
	q(110, h.MaxLon)
	q(114, h.MaxLat)
	b[118] = h.CenterZ
	q(119, h.CenterLon)
	q(123, h.CenterLat)
	return b
}

type pmEntry struct {
	ID, Off uint64
	Len     uint32
	Run     uint32 // 0 = pointer to a leaf directory
}

func decompress(b []byte, comp uint8) ([]byte, error) {
	switch comp {
	case 0, 1: // unknown / none
		return b, nil
	case 2:
		r, err := gzip.NewReader(bytes.NewReader(b))
		if err != nil {
			return nil, err
		}
		return io.ReadAll(r)
	}
	return nil, fmt.Errorf("unsupported internal compression %d", comp)
}

func gz(b []byte) []byte {
	var buf bytes.Buffer
	w, _ := gzip.NewWriterLevel(&buf, gzip.BestCompression)
	w.Write(b)
	w.Close()
	return buf.Bytes()
}

func parseDir(b []byte) ([]pmEntry, error) {
	r := bytes.NewReader(b)
	n, err := binary.ReadUvarint(r)
	if err != nil {
		return nil, err
	}
	es := make([]pmEntry, n)
	var id uint64
	for i := range es {
		d, err := binary.ReadUvarint(r)
		if err != nil {
			return nil, err
		}
		id += d
		es[i].ID = id
	}
	for i := range es {
		v, _ := binary.ReadUvarint(r)
		es[i].Run = uint32(v)
	}
	for i := range es {
		v, _ := binary.ReadUvarint(r)
		es[i].Len = uint32(v)
	}
	for i := range es {
		v, err := binary.ReadUvarint(r)
		if err != nil {
			return nil, err
		}
		if v == 0 && i > 0 {
			es[i].Off = es[i-1].Off + uint64(es[i-1].Len)
		} else {
			es[i].Off = v - 1
		}
	}
	return es, nil
}

func serializeDir(es []pmEntry) []byte {
	var b []byte
	put := func(v uint64) { b = binary.AppendUvarint(b, v) }
	put(uint64(len(es)))
	var last uint64
	for _, e := range es {
		put(e.ID - last)
		last = e.ID
	}
	for _, e := range es {
		put(uint64(e.Run))
	}
	for _, e := range es {
		put(uint64(e.Len))
	}
	for i, e := range es {
		if i > 0 && e.Off == es[i-1].Off+uint64(es[i-1].Len) {
			put(0)
		} else {
			put(e.Off + 1)
		}
	}
	return b
}

// Hilbert tile id <-> z/x/y
func zxyToID(z uint8, x, y uint32) uint64 {
	var acc uint64
	for t := uint8(0); t < z; t++ {
		acc += uint64(1) << (2 * t)
	}
	n := uint64(1) << z
	rx, ry, d := uint64(0), uint64(0), uint64(0)
	tx, ty := uint64(x), uint64(y)
	for s := n / 2; s > 0; s /= 2 {
		if tx&s > 0 {
			rx = 1
		} else {
			rx = 0
		}
		if ty&s > 0 {
			ry = 1
		} else {
			ry = 0
		}
		d += s * s * ((3 * rx) ^ ry)
		if ry == 0 {
			if rx == 1 {
				tx = s - 1 - tx
				ty = s - 1 - ty
			}
			tx, ty = ty, tx
		}
	}
	return acc + d
}

func idToZXY(id uint64) (uint8, uint32, uint32) {
	var acc uint64
	for z := uint8(0); z < 32; z++ {
		n := uint64(1) << (2 * z)
		if acc+n > id {
			d := id - acc
			side := uint64(1) << z
			var x, y uint64
			for s := uint64(1); s < side; s *= 2 {
				rx := 1 & (d / 2)
				ry := 1 & (d ^ rx)
				if ry == 0 {
					if rx == 1 {
						x = s - 1 - x
						y = s - 1 - y
					}
					x, y = y, x
				}
				x += s * rx
				y += s * ry
				d /= 4
			}
			return z, uint32(x), uint32(y)
		}
		acc += n
	}
	return 0, 0, 0
}

func lonLatToTile(lon, lat float64, z uint8) (uint32, uint32) {
	n := math.Exp2(float64(z))
	x := (lon + 180) / 360 * n
	r := lat * math.Pi / 180
	y := (1 - math.Asinh(math.Tan(r))/math.Pi) / 2 * n
	cl := func(v float64) uint32 { return uint32(math.Max(0, math.Min(n-1, math.Floor(v)))) }
	return cl(x), cl(y)
}

// sorted list of every tile id inside the bbox, z0..maxZ
func bboxIDs(minLon, minLat, maxLon, maxLat float64, maxZ uint8) []uint64 {
	var ids []uint64
	for z := uint8(0); z <= maxZ; z++ {
		x0, y0 := lonLatToTile(minLon, maxLat, z)
		x1, y1 := lonLatToTile(maxLon, minLat, z)
		for x := x0; x <= x1; x++ {
			for y := y0; y <= y1; y++ {
				ids = append(ids, zxyToID(z, x, y))
			}
		}
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	return ids
}

// ---------------------------------------------------------------- extraction

type extractProgress struct {
	Total, Done atomic.Int64 // bytes of tile data
}

// collectEntries walks the source directory tree and returns every tile entry whose id (or run) covers a wanted id.
func collectEntries(ctx context.Context, src rangeSource, h pmHeader, want []uint64) ([]pmEntry, error) {
	rootRaw, err := src.ReadRange(ctx, h.RootOff, h.RootLen)
	if err != nil {
		return nil, err
	}
	root, err := decompress(rootRaw, h.InternalComp)
	if err != nil {
		return nil, err
	}
	es, err := parseDir(root)
	if err != nil {
		return nil, err
	}
	var out []pmEntry
	var walk func(es []pmEntry, depth int) error
	walk = func(es []pmEntry, depth int) error {
		if depth > 4 {
			return errors.New("directory too deep")
		}
		for i, e := range es {
			hi := uint64(math.MaxUint64)
			if i+1 < len(es) {
				hi = es[i+1].ID
			}
			if e.Run > 0 {
				hi = e.ID + uint64(e.Run)
			}
			// does any wanted id fall in [e.ID, hi)?
			k := sort.Search(len(want), func(j int) bool { return want[j] >= e.ID })
			if k == len(want) || want[k] >= hi {
				continue
			}
			if e.Run > 0 {
				out = append(out, e)
				continue
			}
			if err := ctx.Err(); err != nil {
				return err
			}
			raw, err := src.ReadRange(ctx, h.LeafOff+e.Off, uint64(e.Len))
			if err != nil {
				return err
			}
			d, err := decompress(raw, h.InternalComp)
			if err != nil {
				return err
			}
			leaf, err := parseDir(d)
			if err != nil {
				return err
			}
			if err := walk(leaf, depth+1); err != nil {
				return err
			}
		}
		return nil
	}
	if err := walk(es, 0); err != nil {
		return nil, err
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}

type blob struct{ off, n uint64 }

// fetchBlobs reads every unique tile blob, coalescing nearby ones into larger range requests, calling sink in order of offset.
func fetchBlobs(ctx context.Context, src rangeSource, base uint64, blobs []blob, prog *extractProgress, sink func(b blob, data []byte) error) error {
	sort.Slice(blobs, func(i, j int) bool { return blobs[i].off < blobs[j].off })
	type span struct {
		off, end uint64
		items    []blob
	}
	var spans []span
	const gap, maxSpan = 256 << 10, 32 << 20
	for _, b := range blobs {
		if n := len(spans); n > 0 && b.off <= spans[n-1].end+gap && b.off+b.n-spans[n-1].off <= maxSpan {
			s := &spans[n-1]
			if b.off+b.n > s.end {
				s.end = b.off + b.n
			}
			s.items = append(s.items, b)
		} else {
			spans = append(spans, span{b.off, b.off + b.n, []blob{b}})
		}
	}
	for _, b := range blobs {
		prog.Total.Add(int64(b.n))
	}
	// download spans in parallel, deliver them in order
	results := make([][]byte, len(spans))
	ready := make([]chan struct{}, len(spans))
	for i := range ready {
		ready[i] = make(chan struct{})
	}
	errc := make(chan error, 1)
	sem := make(chan struct{}, 8)
	var wg sync.WaitGroup
	cctx, cancel := context.WithCancel(ctx)
	defer cancel()
	go func() {
		for i := range spans {
			select {
			case sem <- struct{}{}:
			case <-cctx.Done():
				return
			}
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				defer func() { <-sem }()
				d, err := src.ReadRange(cctx, base+spans[i].off, spans[i].end-spans[i].off)
				if err != nil {
					select {
					case errc <- err:
					default:
					}
					cancel()
					return
				}
				results[i] = d
				close(ready[i])
			}(i)
		}
	}()
	for i, s := range spans {
		select {
		case <-ready[i]:
		case err := <-errc:
			return err
		case <-ctx.Done():
			return ctx.Err()
		}
		for _, b := range s.items {
			if err := sink(b, results[i][b.off-s.off:b.off-s.off+b.n]); err != nil {
				return err
			}
			prog.Done.Add(int64(b.n))
		}
		results[i] = nil
	}
	wg.Wait()
	return nil
}

func openSource(url string) (rangeSource, func(), error) {
	if filepath.IsAbs(url) {
		f, err := os.Open(url)
		if err != nil {
			return nil, nil, err
		}
		return fileSource{f}, func() { f.Close() }, nil
	}
	return httpSource{url, &http.Client{Timeout: 5 * time.Minute}}, func() {}, nil
}

func readHeader(ctx context.Context, src rangeSource) (pmHeader, []byte, error) {
	b, err := src.ReadRange(ctx, 0, 127)
	if err != nil {
		return pmHeader{}, nil, err
	}
	h, err := parseHeader(b)
	if err != nil {
		return h, nil, err
	}
	var meta []byte
	if h.MetaLen > 0 {
		meta, err = src.ReadRange(ctx, h.MetaOff, h.MetaLen)
	}
	return h, meta, err
}

// extractPMTiles writes a new archive containing every tile of src inside the bbox up to maxZ.
func extractPMTiles(ctx context.Context, url, out string, bbox [4]float64, maxZ uint8, prog *extractProgress) error {
	src, closeSrc, err := openSource(url)
	if err != nil {
		return err
	}
	defer closeSrc()
	h, metaRaw, err := readHeader(ctx, src)
	if err != nil {
		return err
	}
	if maxZ > h.MaxZ {
		maxZ = h.MaxZ
	}
	want := bboxIDs(bbox[0], bbox[1], bbox[2], bbox[3], maxZ)
	entries, err := collectEntries(ctx, src, h, want)
	if err != nil {
		return err
	}
	// unique tile blobs (identical tiles share one copy)
	seen := map[uint64]bool{}
	var blobs []blob
	for _, e := range entries {
		if !seen[e.Off] {
			seen[e.Off] = true
			blobs = append(blobs, blob{e.Off, uint64(e.Len)})
		}
	}
	tmp := out + ".part"
	data, err := os.Create(tmp + ".data")
	if err != nil {
		return err
	}
	defer os.Remove(tmp + ".data")
	newOff := map[uint64]uint64{}
	var pos uint64
	if err := fetchBlobs(ctx, src, h.DataOff, blobs, prog, func(b blob, d []byte) error {
		newOff[b.off] = pos
		pos += uint64(len(d))
		_, err := data.Write(d)
		return err
	}); err != nil {
		data.Close()
		return err
	}
	data.Close()
	var addressed uint64
	outEntries := make([]pmEntry, len(entries))
	for i, e := range entries {
		outEntries[i] = pmEntry{ID: e.ID, Off: newOff[e.Off], Len: e.Len, Run: e.Run}
		addressed += uint64(e.Run)
	}
	// directories: root alone if it fits, otherwise root + leaves
	root, leaves := buildDirs(outEntries, h.InternalComp)
	meta := metaRaw
	nh := h
	nh.RootOff = 127
	nh.RootLen = uint64(len(root))
	nh.MetaOff = nh.RootOff + nh.RootLen
	nh.MetaLen = uint64(len(meta))
	nh.LeafOff = nh.MetaOff + nh.MetaLen
	nh.LeafLen = uint64(len(leaves))
	nh.DataOff = nh.LeafOff + nh.LeafLen
	nh.DataLen = pos
	nh.Addressed, nh.Entries, nh.Contents = addressed, uint64(len(outEntries)), uint64(len(blobs))
	nh.Clustered = false
	nh.MaxZ = maxZ
	nh.MinLon, nh.MinLat = int32(bbox[0]*1e7), int32(bbox[1]*1e7)
	nh.MaxLon, nh.MaxLat = int32(bbox[2]*1e7), int32(bbox[3]*1e7)
	nh.CenterLon, nh.CenterLat = int32((bbox[0]+bbox[2])/2*1e7), int32((bbox[1]+bbox[3])/2*1e7)
	if nh.CenterZ > maxZ {
		nh.CenterZ = maxZ
	}
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	for _, part := range [][]byte{nh.bytes(), root, meta, leaves} {
		if _, err := f.Write(part); err != nil {
			f.Close()
			return err
		}
	}
	df, err := os.Open(tmp + ".data")
	if err != nil {
		f.Close()
		return err
	}
	_, err = io.Copy(f, df)
	df.Close()
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return err
	}
	return os.Rename(tmp, out)
}

func compressDir(es []pmEntry, comp uint8) []byte {
	b := serializeDir(es)
	if comp == 2 {
		return gz(b)
	}
	return b
}

func buildDirs(es []pmEntry, comp uint8) (root, leaves []byte) {
	if r := compressDir(es, comp); len(r) <= 16384-127 {
		return r, nil
	}
	for size := 4096; ; size *= 2 {
		var rootEs []pmEntry
		var lv []byte
		for i := 0; i < len(es); i += size {
			j := i + size
			if j > len(es) {
				j = len(es)
			}
			d := compressDir(es[i:j], comp)
			rootEs = append(rootEs, pmEntry{ID: es[i].ID, Off: uint64(len(lv)), Len: uint32(len(d)), Run: 0})
			lv = append(lv, d...)
		}
		if r := compressDir(rootEs, comp); len(r) <= 16384-127 {
			return r, lv
		}
	}
}

// extractTileFiles writes every tile of src inside the bbox up to maxZ as dir/{z}/{x}/{y}.ext (used for terrain).
func extractTileFiles(ctx context.Context, url, dir, ext string, bbox [4]float64, maxZ uint8, prog *extractProgress) error {
	src, closeSrc, err := openSource(url)
	if err != nil {
		return err
	}
	defer closeSrc()
	h, _, err := readHeader(ctx, src)
	if err != nil {
		return err
	}
	if maxZ > h.MaxZ {
		maxZ = h.MaxZ
	}
	want := bboxIDs(bbox[0], bbox[1], bbox[2], bbox[3], maxZ)
	entries, err := collectEntries(ctx, src, h, want)
	if err != nil {
		return err
	}
	byOff := map[uint64][]pmEntry{}
	var blobs []blob
	for _, e := range entries {
		if _, ok := byOff[e.Off]; !ok {
			blobs = append(blobs, blob{e.Off, uint64(e.Len)})
		}
		byOff[e.Off] = append(byOff[e.Off], e)
	}
	tmp := dir + ".part"
	os.RemoveAll(tmp)
	err = fetchBlobs(ctx, src, h.DataOff, blobs, prog, func(b blob, d []byte) error {
		for _, e := range byOff[b.off] {
			for k := uint64(0); k < uint64(e.Run); k++ {
				id := e.ID + k
				if j := sort.Search(len(want), func(i int) bool { return want[i] >= id }); j == len(want) || want[j] != id {
					continue // run extends outside the region
				}
				z, x, y := idToZXY(id)
				p := filepath.Join(tmp, fmt.Sprint(z), fmt.Sprint(x))
				if err := os.MkdirAll(p, 0o755); err != nil {
					return err
				}
				if err := os.WriteFile(filepath.Join(p, fmt.Sprintf("%d.%s", y, ext)), d, 0o644); err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	os.RemoveAll(dir)
	return os.Rename(tmp, dir)
}

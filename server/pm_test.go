package main

import "testing"

func TestHilbertRoundTrip(t *testing.T) {
	for z := uint8(0); z < 16; z++ {
		n := uint32(1) << z
		for _, xy := range [][2]uint32{{0, 0}, {n - 1, 0}, {0, n - 1}, {n - 1, n - 1}, {n / 3, n / 2}} {
			id := zxyToID(z, xy[0], xy[1])
			z2, x2, y2 := idToZXY(id)
			if z2 != z || x2 != xy[0] || y2 != xy[1] {
				t.Fatalf("z%d %v -> %d -> %d/%d/%d", z, xy, id, z2, x2, y2)
			}
		}
	}
	if zxyToID(1, 0, 0) != 1 || zxyToID(1, 0, 1) != 2 || zxyToID(1, 1, 1) != 3 || zxyToID(1, 1, 0) != 4 {
		t.Fatal("z1 order wrong")
	}
}

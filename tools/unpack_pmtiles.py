"""Unpacks a PMTiles v3 archive into a {z}/{x}/{y}.<ext> directory (used for the terrain tiles, which the
contour generator and elevation lookups fetch by plain URL). Usage: unpack_pmtiles.py archive.pmtiles outdir"""
import gzip, os, struct, sys


def varint(b, i):
    v = s = 0
    while True:
        c = b[i]; i += 1; v |= (c & 0x7F) << s; s += 7
        if c < 0x80: return v, i


def directory(b):
    n, i = varint(b, 0)
    ids, runs, lens, offs = [], [], [], []
    last = 0
    for _ in range(n): d, i = varint(b, i); last += d; ids.append(last)
    for _ in range(n): r, i = varint(b, i); runs.append(r)
    for _ in range(n): l, i = varint(b, i); lens.append(l)
    for k in range(n):
        o, i = varint(b, i)
        offs.append(offs[k - 1] + lens[k - 1] if (o == 0 and k > 0) else o - 1)
    return list(zip(ids, runs, lens, offs))


def zxy(tid):
    acc, z = 0, 0
    while True:
        num = 4 ** z
        if acc + num > tid: break
        acc += num; z += 1
    n, t, x, y, s = 2 ** z, tid - acc, 0, 0, 1
    while s < n:
        rx = 1 & (t // 2); ry = 1 & (t ^ rx)
        if ry == 0:
            if rx == 1: x, y = s - 1 - x, s - 1 - y
            x, y = y, x
        x += s * rx; y += s * ry; t //= 4; s *= 2
    return z, x, y


def main(src, out):
    f = open(src, "rb")
    h = f.read(127)
    assert h[:7] == b"PMTiles" and h[7] == 3, "not a PMTiles v3 file"
    root_off, root_len, _, _, leaf_off, _, data_off = struct.unpack("<7Q", h[8:64])
    icomp, tcomp, ttype = h[97], h[98], h[99]
    ext = {1: "pbf", 2: "png", 3: "jpg", 4: "webp", 5: "avif"}.get(ttype, "bin")
    dec = (lambda b: gzip.decompress(b)) if icomp == 2 else (lambda b: b)
    tdec = (lambda b: gzip.decompress(b)) if tcomp == 2 else (lambda b: b)

    def read(off, ln): f.seek(off); return f.read(ln)
    count = 0

    def walk(entries):
        nonlocal count
        for tid, run, ln, off in entries:
            if run == 0:
                walk(directory(dec(read(leaf_off + off, ln)))); continue
            data = tdec(read(data_off + off, ln))
            for k in range(run):
                z, x, y = zxy(tid + k)
                p = os.path.join(out, str(z), str(x), f"{y}.{ext}")
                os.makedirs(os.path.dirname(p), exist_ok=True)
                with open(p, "wb") as w: w.write(data)
                count += 1
    walk(directory(dec(read(root_off, root_len))))
    print("unpacked", count, "tiles ->", out)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

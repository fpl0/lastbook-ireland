"""Development server: serves web/ at / and the data folder (~/Library/Application Support/Lastbook Ireland) at /data/,
with HTTP Range support (needed for .pmtiles). Usage: python3 -I tools/devserver.py [port]"""
import http.server, os, sys, mimetypes

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web"))
DATA = os.path.expanduser("~/Library/Application Support/Lastbook Ireland")
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("application/x-protobuf", ".pbf")
mimetypes.add_type("application/geo+json", ".geojson")


class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        path = path.split("?", 1)[0].split("#", 1)[0]
        from urllib.parse import unquote
        path = unquote(path)
        base, rel = (DATA, path[len("/data/"):]) if path.startswith("/data/") else (ROOT, path.lstrip("/"))
        full = os.path.normpath(os.path.join(base, rel))
        return full if full.startswith(base) else base

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        rng = self.headers.get("Range")
        p = self.translate_path(self.path)
        if not rng or not os.path.isfile(p):
            return super().do_GET()
        size = os.path.getsize(p)
        a, b = rng.replace("bytes=", "").split("-")
        start = int(a) if a else size - int(b)
        end = min(int(b), size - 1) if (a and b) else size - 1
        if start >= size:
            self.send_response(416); self.send_header("Content-Range", f"bytes */{size}"); self.end_headers(); return
        st = os.stat(p)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(p))
        self.send_header("ETag", f'"{st.st_mtime_ns:x}-{st.st_size:x}"')
        self.send_header("Last-Modified", self.date_time_string(int(st.st_mtime)))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        with open(p, "rb") as f:
            f.seek(start); self.wfile.write(f.read(end - start + 1))

    def log_message(self, fmt, *a):
        if os.environ.get("LB_DEBUG") or ".pmtiles" in self.path:
            sys.stderr.write(f"{self.command} {self.path} range={self.headers.get('Range')} -> {a[1] if len(a) > 1 else ''}\n")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    print(f"http://127.0.0.1:{port}/map.html")
    http.server.ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()

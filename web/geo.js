/* Coordinate maths for Ireland: ITM (EPSG:2157), Irish Grid (EPSG:29903), distances, sunrise/sunset. */
(function () {
  const D = Math.PI / 180;
  function tmForward(lat, lon, e) {
    const { a, b, k0, lat0, lon0, E0, N0 } = e;
    const n = (a - b) / (a + b), e2 = 1 - (b * b) / (a * a);
    const p = lat * D, l = lon * D, p0 = lat0 * D, l0 = lon0 * D;
    const s = Math.sin(p), c = Math.cos(p), t = Math.tan(p);
    const nu = a * k0 / Math.sqrt(1 - e2 * s * s);
    const rho = a * k0 * (1 - e2) / Math.pow(1 - e2 * s * s, 1.5);
    const eta2 = nu / rho - 1;
    const M = meridian(p, p0, b, k0, n);
    const I = M + N0, II = nu / 2 * s * c, III = nu / 24 * s * c ** 3 * (5 - t * t + 9 * eta2),
      IIIA = nu / 720 * s * c ** 5 * (61 - 58 * t * t + t ** 4), IV = nu * c,
      V = nu / 6 * c ** 3 * (nu / rho - t * t), VI = nu / 120 * c ** 5 * (5 - 18 * t * t + t ** 4 + 14 * eta2 - 58 * t * t * eta2);
    const dl = l - l0;
    return [E0 + IV * dl + V * dl ** 3 + VI * dl ** 5, I + II * dl ** 2 + III * dl ** 4 + IIIA * dl ** 6];
  }
  function meridian(p, p0, b, k0, n) {
    return b * k0 * ((1 + n + 5 / 4 * n * n + 5 / 4 * n ** 3) * (p - p0)
      - (3 * n + 3 * n * n + 21 / 8 * n ** 3) * Math.sin(p - p0) * Math.cos(p + p0)
      + (15 / 8 * n * n + 15 / 8 * n ** 3) * Math.sin(2 * (p - p0)) * Math.cos(2 * (p + p0))
      - 35 / 24 * n ** 3 * Math.sin(3 * (p - p0)) * Math.cos(3 * (p + p0)));
  }
  function tmInverse(E, N, e) {
    const { a, b, k0, lat0, lon0, E0, N0 } = e;
    const n = (a - b) / (a + b), e2 = 1 - (b * b) / (a * a), p0 = lat0 * D;
    let p = p0, M = 0;
    do { p = (N - N0 - M) / (a * k0) + p; M = meridian(p, p0, b, k0, n); } while (Math.abs(N - N0 - M) >= 0.00001);
    const s = Math.sin(p), c = Math.cos(p), t = Math.tan(p);
    const nu = a * k0 / Math.sqrt(1 - e2 * s * s), rho = a * k0 * (1 - e2) / Math.pow(1 - e2 * s * s, 1.5), eta2 = nu / rho - 1;
    const VII = t / (2 * rho * nu), VIII = t / (24 * rho * nu ** 3) * (5 + 3 * t * t + eta2 - 9 * t * t * eta2),
      IX = t / (720 * rho * nu ** 5) * (61 + 90 * t * t + 45 * t ** 4), X = 1 / (c * nu), XI = 1 / (c * 6 * nu ** 3) * (nu / rho + 2 * t * t),
      XII = 1 / (c * 120 * nu ** 5) * (5 + 28 * t * t + 24 * t ** 4), XIIA = 1 / (c * 5040 * nu ** 7) * (61 + 662 * t * t + 1320 * t ** 4 + 720 * t ** 6);
    const dE = E - E0;
    return [(p - VII * dE ** 2 + VIII * dE ** 4 - IX * dE ** 6) / D, lon0 + (X * dE - XI * dE ** 3 + XII * dE ** 5 - XIIA * dE ** 7) / D];
  }
  const GRS80 = { a: 6378137, b: 6356752.314140, k0: 0.99982, lat0: 53.5, lon0: -8, E0: 600000, N0: 750000 };
  const AIRYMOD = { a: 6377340.189, b: 6356034.447, k0: 1.000035, lat0: 53.5, lon0: -8, E0: 200000, N0: 250000 };
  // ETRS89/WGS84 -> TM65 (Ireland 1965) 7-parameter Helmert, accurate to ~1 m.
  function toTM65(lat, lon) {
    const a = 6378137, b = 6356752.314140, e2 = 1 - b * b / (a * a);
    const p = lat * D, l = lon * D, nu = a / Math.sqrt(1 - e2 * Math.sin(p) ** 2);
    let x = nu * Math.cos(p) * Math.cos(l), y = nu * Math.cos(p) * Math.sin(l), z = (1 - e2) * nu * Math.sin(p);
    const tx = -482.53, ty = 130.596, tz = -564.557, s = 8.15e-6,
      rx = -1.042 / 3600 * D, ry = -0.214 / 3600 * D, rz = -0.631 / 3600 * D;
    const x2 = tx + (1 + s) * x - rz * y + ry * z, y2 = ty + rz * x + (1 + s) * y - rx * z, z2 = tz - ry * x + rx * y + (1 + s) * z;
    const A = 6377340.189, B = 6356034.447, E2 = 1 - B * B / (A * A), P = Math.hypot(x2, y2);
    let q = Math.atan2(z2, P * (1 - E2)), q0;
    do { q0 = q; const N = A / Math.sqrt(1 - E2 * Math.sin(q) ** 2); q = Math.atan2(z2 + E2 * N * Math.sin(q), P); } while (Math.abs(q - q0) > 1e-12);
    return [q / D, Math.atan2(y2, x2) / D];
  }
  const GEO = {
    toITM: (lat, lon) => tmForward(lat, lon, GRS80),
    fromITM: (E, N) => tmInverse(E, N, GRS80),
    toIG: (lat, lon) => { const [a, b] = toTM65(lat, lon); return tmForward(a, b, AIRYMOD); },
    igRef(lat, lon, digits = 5) {
      const [E, N] = GEO.toIG(lat, lon);
      if (E < 0 || N < 0 || E >= 500000 || N >= 500000) return "outside Irish Grid";
      const letters = "VWXYZQRSTULMNOPFGHJKABCDE"; // 100 km squares, row 0 at south
      const L = letters[Math.floor(N / 100000) * 5 + Math.floor(E / 100000)];
      const f = v => String(Math.floor((v % 100000) / Math.pow(10, 5 - digits))).padStart(digits, "0");
      return `${L} ${f(E)} ${f(N)}`;
    },
    fmtITM(lat, lon) { const [E, N] = GEO.toITM(lat, lon); return `${Math.round(E)}, ${Math.round(N)}`; },
    dist(a1, o1, a2, o2) {
      const dA = (a2 - a1) * D, dO = (o2 - o1) * D;
      const h = Math.sin(dA / 2) ** 2 + Math.cos(a1 * D) * Math.cos(a2 * D) * Math.sin(dO / 2) ** 2;
      return 12742000 * Math.asin(Math.sqrt(h));
    },
    bearing(a1, o1, a2, o2) {
      const y = Math.sin((o2 - o1) * D) * Math.cos(a2 * D);
      const x = Math.cos(a1 * D) * Math.sin(a2 * D) - Math.sin(a1 * D) * Math.cos(a2 * D) * Math.cos((o2 - o1) * D);
      return (Math.atan2(y, x) / D + 360) % 360;
    },
    compass: b => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(b / 45) % 8],
    fmtDist: m => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`,
    // NOAA sunrise/sunset; returns Date objects (or null for polar cases)
    sun(date, lat, lon) {
      const day = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
      const n = Math.ceil(day / 86400000 + 2440587.5 - 2451545.0 + 0.0008);
      const J = n - lon / 360, M = (357.5291 + 0.98560028 * J) % 360;
      const C = 1.9148 * Math.sin(M * D) + 0.02 * Math.sin(2 * M * D) + 0.0003 * Math.sin(3 * M * D);
      const L = (M + C + 180 + 102.9372) % 360;
      const T = 2451545.0 + J + 0.0053 * Math.sin(M * D) - 0.0069 * Math.sin(2 * L * D);
      const dec = Math.asin(Math.sin(L * D) * Math.sin(23.44 * D));
      const res = h => { const cw = (Math.sin(h * D) - Math.sin(lat * D) * Math.sin(dec)) / (Math.cos(lat * D) * Math.cos(dec)); return Math.abs(cw) > 1 ? null : Math.acos(cw) / D; };
      const toDate = jd => new Date((jd - 2440587.5) * 86400000);
      const w = res(-0.833), wc = res(-6);
      return {
        rise: w == null ? null : toDate(T - w / 360), set: w == null ? null : toDate(T + w / 360), noon: toDate(T),
        dawn: wc == null ? null : toDate(T - wc / 360), dusk: wc == null ? null : toDate(T + wc / 360),
      };
    },
  };
  (typeof module !== "undefined" ? module.exports = GEO : window.GEO = GEO);
})();

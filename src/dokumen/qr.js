// Pembuat kode QR (ISO/IEC 18004) tanpa pustaka luar: mode byte, koreksi
// galat tingkat M, versi 1-10 (cukup untuk tautan verifikasi hingga ~210 byte).

const EC_M = [ // [ec per blok, blok g1, data g1, blok g2, data g2]
  null, [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0], [18, 4, 31, 0, 0], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44],
]
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]]

// Aritmetika GF(256) dengan polinom 0x11d
const EXP = new Array(512); const LOG = new Array(256)
;(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255] })()
const kali = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0)

function generator(n) {
  let g = [1]
  for (let i = 0; i < n; i++) {
    const h = new Array(g.length + 1).fill(0)
    for (let j = 0; j < g.length; j++) { h[j] ^= g[j]; h[j + 1] ^= kali(g[j], EXP[i]) }
    g = h
  }
  return g
}
function sisaRS(data, n) {
  const g = generator(n); const r = [...data, ...new Array(n).fill(0)]
  for (let i = 0; i < data.length; i++) {
    const c = r[i]
    if (c) for (let j = 0; j < g.length; j++) r[i + j] ^= kali(g[j], c)
  }
  return r.slice(data.length)
}

function bch(nilai, poli, panjangPoli) {
  let v = nilai << (panjangPoli - 1)
  const derajat = (x) => 31 - Math.clz32(x)
  while (v && derajat(v) >= panjangPoli - 1) v ^= poli << (derajat(v) - (panjangPoli - 1))
  return (nilai << (panjangPoli - 1)) | v
}

export function buatQR(teks) {
  const bytes = Array.from(new TextEncoder().encode(teks))
  let versi = 1
  for (; versi <= 10; versi++) {
    const [, b1, d1, b2, d2] = EC_M[versi]
    const kapasitas = b1 * d1 + b2 * d2
    const bitPanjang = versi < 10 ? 8 : 16
    if (4 + bitPanjang + bytes.length * 8 <= kapasitas * 8) break
  }
  if (versi > 10) throw new Error('Teks terlalu panjang untuk kode QR')
  const [ec, b1, d1, b2, d2] = EC_M[versi]
  const totalData = b1 * d1 + b2 * d2

  // Aliran bit: mode byte (0100), panjang, data, terminator, isi
  const bit = []
  const tulis = (v, n) => { for (let i = n - 1; i >= 0; i--) bit.push((v >>> i) & 1) }
  tulis(4, 4); tulis(bytes.length, versi < 10 ? 8 : 16); bytes.forEach((b) => tulis(b, 8))
  tulis(0, Math.min(4, totalData * 8 - bit.length))
  while (bit.length % 8) bit.push(0)
  const kode = []
  for (let i = 0; i < bit.length; i += 8) kode.push(parseInt(bit.slice(i, i + 8).join(''), 2))
  for (let p = 0; kode.length < totalData; p++) kode.push(p % 2 ? 0x11 : 0xec)

  // Blok dan koreksi galat, lalu disisipkan
  const blok = []; let k = 0
  for (let i = 0; i < b1 + b2; i++) { const n = i < b1 ? d1 : d2; const data = kode.slice(k, k + n); k += n; blok.push({ data, ec: sisaRS(data, ec) }) }
  const akhir = []
  for (let i = 0; i < Math.max(d1, d2); i++) blok.forEach((b) => { if (i < b.data.length) akhir.push(b.data[i]) })
  for (let i = 0; i < ec; i++) blok.forEach((b) => akhir.push(b.ec[i]))

  const n = versi * 4 + 17
  const m = Array.from({ length: n }, () => new Array(n).fill(null))
  const tetap = Array.from({ length: n }, () => new Array(n).fill(false))
  const set = (r, c, v) => { m[r][c] = v; tetap[r][c] = true }

  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = r0 + r; const cc = c0 + c
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue
      const di = r >= 0 && r <= 6 && c >= 0 && c <= 6
      set(rr, cc, di && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)))
    }
  }
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0)
  for (let i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0) }
  const pos = ALIGN[versi]
  const akhirPos = pos[pos.length - 1]
  for (const r of pos) for (const c of pos) {
    if ((r === 6 && c === 6) || (r === 6 && c === akhirPos) || (r === akhirPos && c === 6)) continue // bertumpuk finder
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1)
  }
  set(n - 8, 8, true) // modul gelap
  // Cadangan area format dan versi
  for (let i = 0; i < 9; i++) { if (!tetap[8][i]) set(8, i, false); if (!tetap[i][8]) set(i, 8, false) }
  for (let i = 0; i < 8; i++) { set(8, n - 1 - i, false); set(n - 1 - i, 8, false) }
  if (versi >= 7) {
    const v = bch(versi, 0x1f25, 13)
    for (let i = 0; i < 18; i++) { const b = ((v >> i) & 1) === 1; const r = Math.floor(i / 3); const c = n - 11 + (i % 3); set(r, c, b); set(c, r, b) }
  }

  // Penempatan data zig-zag
  const aliran = []
  akhir.forEach((b) => { for (let i = 7; i >= 0; i--) aliran.push((b >> i) & 1) })
  let idx = 0; let naik = true
  for (let c = n - 1; c > 0; c -= 2) {
    if (c === 6) c = 5
    for (let t = 0; t < n; t++) {
      const r = naik ? n - 1 - t : t
      for (let j = 0; j < 2; j++) {
        const cc = c - j
        if (tetap[r][cc]) continue
        m[r][cc] = idx < aliran.length ? aliran[idx] === 1 : false
        idx++
      }
    }
    naik = !naik
  }

  const MASK = [
    (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ]
  const terapkan = (mask) => {
    const h = m.map((baris, r) => baris.map((v, c) => (tetap[r][c] ? v : v !== MASK[mask](r, c))))
    const f = bch((0 << 3) | mask, 0x537, 11) ^ 0x5412 // tingkat M = 00
    for (let i = 0; i < 15; i++) {
      const b = ((f >> i) & 1) === 1
      if (i < 6) h[i][8] = b; else if (i < 8) h[i + 1][8] = b; else h[n - 15 + i][8] = b
      if (i < 8) h[8][n - 1 - i] = b; else if (i < 9) h[8][15 - i] = b; else h[8][14 - i] = b
    }
    return h
  }
  const nilaiPenalti = (h) => {
    let p = 0
    for (let a = 0; a < 2; a++) for (let i = 0; i < n; i++) {
      let run = 1
      for (let j = 1; j < n; j++) {
        const x = a ? h[j][i] : h[i][j]; const y = a ? h[j - 1][i] : h[i][j - 1]
        if (x === y) { run++; if (j === n - 1 && run >= 5) p += run - 2 } else { if (run >= 5) p += run - 2; run = 1 }
      }
    }
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) { const v = h[r][c]; if (v === h[r + 1][c] && v === h[r][c + 1] && v === h[r + 1][c + 1]) p += 3 }
    const gelap = h.flat().filter(Boolean).length
    p += Math.floor(Math.abs((gelap * 100) / (n * n) - 50) / 5) * 10
    return p
  }
  let terbaik = null
  for (let mask = 0; mask < 8; mask++) {
    const h = terapkan(mask); const sk = nilaiPenalti(h)
    if (!terbaik || sk < terbaik.sk) terbaik = { h, sk }
  }
  return terbaik.h
}

// Jalur SVG (satu path) dengan zona tenang 4 modul.
export function jalurQR(teks) {
  const h = buatQR(teks); const n = h.length; let d = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (h[r][c]) d += `M${c + 4} ${r + 4}h1v1h-1z`
  return { ukuran: n + 8, d }
}

// AISYS: alat bantu membaca transkrip. Berkas disiapkan di peramban (teks PDF
// atau gambar halaman), lalu dikirim ke Edge Function "aisys" yang memegang
// kunci API. Hasilnya hanya usulan; keputusan tetap pada asesor.
import { supabase } from '../lib/supabase'

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120'
const MAKS_HALAMAN = 6
const SISI_MAKS = 1600

async function muatPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib
  await new Promise((ok, gagal) => {
    const s = document.createElement('script')
    s.src = `${PDFJS}/pdf.min.js`
    s.onload = ok
    s.onerror = () => gagal(new Error('Modul pembaca PDF tidak dapat dimuat'))
    document.head.appendChild(s)
  })
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.js`
  return window.pdfjsLib
}

function kanvasKeJpeg(sumber, w, h) {
  const k = Math.min(1, SISI_MAKS / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.round(w * k); c.height = Math.round(h * k)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
  ctx.drawImage(sumber, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.82)
}

async function bacaPdf(buffer, kabar) {
  const pdfjs = await muatPdfJs()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  const n = Math.min(pdf.numPages, MAKS_HALAMAN)
  let teks = ''
  for (let i = 1; i <= n; i++) {
    kabar?.(`Membaca teks halaman ${i} dari ${n}`)
    const hal = await pdf.getPage(i)
    const isi = await hal.getTextContent()
    // Kelompokkan per baris agar tabel transkrip tetap terbaca.
    const baris = {}
    for (const it of isi.items) {
      const y = Math.round(it.transform[5])
      ;(baris[y] ||= []).push({ x: it.transform[4], s: it.str })
    }
    teks += Object.keys(baris).map(Number).sort((a, b) => b - a)
      .map((y) => baris[y].sort((a, b) => a.x - b.x).map((x) => x.s).join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean).join('\n') + '\n'
  }
  // PDF hasil pindai tidak punya lapisan teks: kirim gambar halamannya.
  if (teks.replace(/\s/g, '').length >= 200) return { teks, gambar: [] }
  const gambar = []
  for (let i = 1; i <= n; i++) {
    kabar?.(`Menyiapkan gambar halaman ${i} dari ${n}`)
    const hal = await pdf.getPage(i)
    const vp = hal.getViewport({ scale: 2 })
    const c = document.createElement('canvas')
    c.width = vp.width; c.height = vp.height
    await hal.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
    gambar.push(kanvasKeJpeg(c, c.width, c.height))
  }
  return { teks: '', gambar }
}

async function bacaGambar(blob) {
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise((ok, gagal) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = () => gagal(new Error('Gambar transkrip tidak dapat dibuka'))
      i.src = url
    })
    return { teks: '', gambar: [kanvasKeJpeg(img, img.naturalWidth, img.naturalHeight)] }
  } finally { URL.revokeObjectURL(url) }
}

export async function bacaTranskripAisys(pengajuanId, path, kabar) {
  if (!path) throw new Error('Pemohon belum mengunggah transkrip')
  kabar?.('Mengunduh transkrip')
  const { data: blob, error } = await supabase.storage.from('rpl-documents').download(path)
  if (error || !blob) throw new Error('Transkrip tidak dapat diunduh')
  const pdf = blob.type === 'application/pdf' || /\.pdf$/i.test(path)
  const bahan = pdf ? await bacaPdf(await blob.arrayBuffer(), kabar) : await bacaGambar(blob)
  kabar?.('AISYS membaca transkrip, biasanya 20 sampai 60 detik')
  const { data, error: e } = await supabase.functions.invoke('aisys', { body: { tugas: 'transkrip', pengajuan_id: pengajuanId, ...bahan } })
  if (e) {
    let pesan = 'AISYS tidak dapat dihubungi'
    try { pesan = (await e.context?.json())?.galat || pesan } catch { /* biarkan pesan umum */ }
    throw new Error(pesan)
  }
  if (data?.galat) throw new Error(data.galat)
  return data
}

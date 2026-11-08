// Periode RPL dan tarif biaya per periode.
import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck, Copy, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAdmin, cek } from '../AdminData'
import { KOMPONEN_TARIF, LABEL_KOMPONEN } from '../aturan'
import { rupiah, tanggal } from '../../pemohon/konstanta'
import { Bidang, Dialog, Halaman, InputAngka, Kartu, Kerangka, Lencana, Pemberitahuan, PilihSegmen, Tombol } from '../../pemohon/ui'

const KOSONG = { nama: '', semester: 'ganjil', tanggal_buka: '', tanggal_tutup: '', batas_rekognisi_persen: 70 }

function statusPeriode(p) {
  const kini = new Date().toISOString().slice(0, 10)
  if (p.is_aktif && p.tanggal_tutup && p.tanggal_tutup < kini) return { l: 'Aktif, pendaftaran lewat', w: 'amber' }
  if (p.is_aktif && p.tanggal_buka && p.tanggal_buka > kini) return { l: 'Aktif, belum dibuka', w: 'amber' }
  if (p.is_aktif) return { l: 'Aktif', w: 'green' }
  return { l: 'Tidak aktif', w: 'slate' }
}

function EditorTarif({ periode, semua, prodi, onSimpan, periodeLain }) {
  const awal = useMemo(() => semua.filter((t) => t.periode_id === periode.id), [semua, periode.id])
  const [baris, setBaris] = useState([])
  const [sibuk, setSibuk] = useState(false)
  useEffect(() => {
    setBaris(awal.map((t) => ({ ...t, besaran: String(Math.round(Number(t.besaran))) })))
  }, [awal])

  const ubah = (i, k, v) => setBaris((b) => b.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  const tambah = () => {
    const pakai = new Set(baris.filter((b) => !b.prodi_id).map((b) => b.komponen))
    const kom = KOMPONEN_TARIF.find((k) => !pakai.has(k.v))?.v || 'lain_lain'
    setBaris((b) => [...b, { komponen: kom, prodi_id: null, besaran: '', keterangan: '', is_internal: false }])
  }
  const salin = () => {
    const sumber = semua.filter((t) => t.periode_id === periodeLain.id)
    setBaris(sumber.map((t) => ({ komponen: t.komponen, prodi_id: t.prodi_id, besaran: String(Math.round(Number(t.besaran))), keterangan: t.keterangan || '', is_internal: t.is_internal })))
    toast.success(`Tarif ${periodeLain.nama} disalin. Periksa lalu simpan.`)
  }

  const simpan = async () => {
    const kunci = baris.map((b) => `${b.komponen}|${b.prodi_id || ''}`)
    if (new Set(kunci).size !== kunci.length) { toast.error('Ada komponen yang sama untuk program studi yang sama'); return }
    if (baris.some((b) => b.besaran === '')) { toast.error('Isi besaran setiap baris atau hapus barisnya'); return }
    setSibuk(true)
    try {
      const sisa = new Set(baris.filter((b) => b.id).map((b) => b.id))
      const hapus = awal.filter((t) => !sisa.has(t.id)).map((t) => t.id)
      if (hapus.length) cek(await supabase.from('tarif_biaya').delete().in('id', hapus))
      for (const b of baris) {
        const isi = { periode_id: periode.id, komponen: b.komponen, prodi_id: b.prodi_id || null, besaran: Number(b.besaran), keterangan: b.keterangan || null, is_internal: !!b.is_internal }
        if (b.id) cek(await supabase.from('tarif_biaya').update(isi).eq('id', b.id))
        else cek(await supabase.from('tarif_biaya').insert(isi))
      }
      toast.success('Tarif disimpan')
      await onSimpan()
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  const berubah = JSON.stringify(baris) !== JSON.stringify(awal.map((t) => ({ ...t, besaran: String(Math.round(Number(t.besaran))) })))
  return (
    <Kartu judul={`Tarif periode ${periode.nama}`} sub="Biaya pendaftaran dan asesmen tampil di F01 dan tagihan pemohon. Tarif internal hanya untuk perhitungan Tim." padat
      aksi={<div className="pm-baris-aksi">
        {periodeLain && !baris.length ? <Tombol ikon={Copy} onClick={salin}>Salin dari {periodeLain.nama}</Tombol> : null}
        <Tombol ikon={Plus} onClick={tambah}>Tambah komponen</Tombol>
      </div>}>
      <div className="table-wrap">
        <table className="pm-tabel pm-tabel-responsif ad-tarif">
          <thead><tr><th style={{ width: 270 }}>Komponen</th><th style={{ width: 210 }}>Berlaku untuk</th><th style={{ width: 160 }}>Besaran (Rp)</th><th>Keterangan</th><th style={{ width: 110 }}>Internal</th><th style={{ width: 48 }}><span className="sr-only">Hapus</span></th></tr></thead>
          <tbody>
            {baris.map((b, i) => (
              <tr key={b.id || `baru-${i}`}>
                <td data-label="Komponen">
                  <select className="input" value={b.komponen} onChange={(e) => ubah(i, 'komponen', e.target.value)} aria-label="Komponen">
                    {KOMPONEN_TARIF.map((k) => <option key={k.v} value={k.v}>{k.l}{k.satuan ? ` (${k.satuan})` : ''}</option>)}
                  </select>
                </td>
                <td data-label="Berlaku untuk">
                  <select className="input" value={b.prodi_id || ''} onChange={(e) => ubah(i, 'prodi_id', e.target.value || null)} aria-label="Berlaku untuk">
                    <option value="">Semua program studi</option>
                    {prodi.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
                  </select>
                </td>
                <td data-label="Besaran (Rp)">
                  <InputAngka nilai={b.besaran} onUbah={(v) => ubah(i, 'besaran', v)} panjang={12} aria-label="Besaran" />
                  {b.besaran ? <div className="pm-kecil">{rupiah(Number(b.besaran))}</div> : null}
                </td>
                <td data-label="Keterangan"><input className="input" value={b.keterangan || ''} onChange={(e) => ubah(i, 'keterangan', e.target.value)} aria-label="Keterangan" /></td>
                <td data-label="Internal"><label className="ad-cek"><input type="checkbox" checked={!!b.is_internal} onChange={(e) => ubah(i, 'is_internal', e.target.checked)} /> Internal</label></td>
                <td><button type="button" className="btn btn-ghost btn-icon" title="Hapus baris" aria-label={`Hapus ${LABEL_KOMPONEN[b.komponen]}`} onClick={() => setBaris((x) => x.filter((_, j) => j !== i))}><Trash2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!baris.length ? <p className="pm-kosong">Belum ada tarif untuk periode ini.</p> : null}
      </div>
      {berubah ? <div className="ad-kaki-simpan"><span className="pm-kecil">Ada perubahan yang belum disimpan.</span><Tombol jenis="primary" ikon={Save} sibuk={sibuk} onClick={simpan}>Simpan tarif</Tombol></div> : null}
    </Kartu>
  )
}

export default function Periode() {
  const { siap, data, galat, muat } = useAdmin()
  const [pilih, setPilih] = useState(null)
  const [ubah, setUbah] = useState(null)
  const [aktifkan, setAktifkan] = useState(null)
  const [sibuk, setSibuk] = useState(false)

  if (galat && !siap) return <Halaman judul="Periode dan tarif"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />

  const daftar = data.periode
  const terpilih = daftar.find((p) => p.id === pilih) || daftar.find((p) => p.is_aktif) || daftar[0]
  const lain = daftar.find((p) => p.id !== terpilih?.id && data.tarif.some((t) => t.periode_id === p.id))
  const jumlah = (id) => data.pengajuan.filter((p) => p.periode_id === id && p.status !== 'draft').length

  const simpan = async () => {
    const f = ubah
    if (!f.nama.trim()) { toast.error('Isi nama periode'); return }
    if (f.tanggal_buka && f.tanggal_tutup && f.tanggal_tutup < f.tanggal_buka) { toast.error('Tanggal tutup sebelum tanggal buka'); return }
    const batas = Number(f.batas_rekognisi_persen)
    if (!(batas > 0 && batas <= 70)) { toast.error('Batas rekognisi 1 sampai 70 persen'); return }
    setSibuk(true)
    try {
      const isi = { nama: f.nama.trim(), semester: f.semester, tanggal_buka: f.tanggal_buka || null, tanggal_tutup: f.tanggal_tutup || null, batas_rekognisi_persen: batas }
      const r = f.id ? cek(await supabase.from('periode_rpl').update(isi).eq('id', f.id).select().single()) : cek(await supabase.from('periode_rpl').insert(isi).select().single())
      toast.success('Periode disimpan')
      setUbah(null); setPilih(r.id)
      await muat()
    } catch (e) { toast.error(/periode_rpl_nama_key/.test(e.message) ? 'Nama periode sudah dipakai' : e.message) } finally { setSibuk(false) }
  }
  const jalankanAktif = async () => {
    setSibuk(true)
    try {
      const { error } = await supabase.rpc('aktifkan_periode', { p_id: aktifkan.id })
      if (error) throw new Error(error.message)
      toast.success(`Periode ${aktifkan.nama} aktif`)
      setAktifkan(null)
      await muat()
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Halaman judul="Periode dan tarif" sub="Hanya satu periode yang aktif. Pemohon baru otomatis masuk ke periode aktif."
      aksi={<Tombol jenis="primary" ikon={Plus} onClick={() => setUbah({ ...KOSONG })}>Periode baru</Tombol>}>
      <Kartu padat>
        <ul className="tm-daftar">
          {daftar.map((p) => {
            const s = statusPeriode(p)
            return (
              <li key={p.id} className={p.id === terpilih?.id ? 'ad-terpilih' : undefined}>
                <div className="tm-baris">
                  <button type="button" className="ad-baris-btn pm-grow" onClick={() => setPilih(p.id)} aria-pressed={p.id === terpilih?.id}>
                    <span className="pm-tebal">{p.nama}</span>
                    <span className="pm-kecil">Semester {p.semester || '-'} · {p.tanggal_buka ? `${tanggal(p.tanggal_buka)} s.d. ${p.tanggal_tutup ? tanggal(p.tanggal_tutup) : 'tanpa batas'}` : 'tanggal belum diatur'} · batas rekognisi {Number(p.batas_rekognisi_persen)}% · {jumlah(p.id)} pengajuan</span>
                  </button>
                  <Lencana warna={s.w}>{s.l}</Lencana>
                  {!p.is_aktif ? <Tombol ikon={CalendarCheck} onClick={() => setAktifkan(p)}>Aktifkan</Tombol> : null}
                  <button type="button" className="btn btn-ghost btn-icon" title="Ubah periode" aria-label={`Ubah ${p.nama}`}
                    onClick={() => setUbah({ ...KOSONG, ...p, tanggal_buka: p.tanggal_buka || '', tanggal_tutup: p.tanggal_tutup || '', semester: p.semester || 'ganjil' })}><Pencil size={15} /></button>
                </div>
              </li>
            )
          })}
        </ul>
        {!daftar.length ? <p className="pm-kosong">Belum ada periode.</p> : null}
      </Kartu>

      {terpilih ? <EditorTarif key={terpilih.id} periode={terpilih} semua={data.tarif} prodi={data.prodi.filter((x) => x.is_penyelenggara_rpl)} onSimpan={muat} periodeLain={lain} /> : null}

      <Dialog buka={!!ubah} judul={ubah?.id ? 'Ubah periode' : 'Periode baru'} onTutup={() => setUbah(null)}
        kaki={<><Tombol onClick={() => setUbah(null)}>Batal</Tombol><Tombol jenis="primary" ikon={Save} sibuk={sibuk} onClick={simpan}>Simpan</Tombol></>}>
        {ubah ? (
          <div className="pm-form-2">
            <Bidang label="Nama periode" wajib lebar hint="mis. 2026/2027 Ganjil"><input className="input" value={ubah.nama} onChange={(e) => setUbah((s) => ({ ...s, nama: e.target.value }))} /></Bidang>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <span className="input-label">Semester</span>
              <PilihSegmen pilihan={[{ v: 'ganjil', l: 'Ganjil' }, { v: 'genap', l: 'Genap' }]} nilai={ubah.semester} onUbah={(v) => setUbah((s) => ({ ...s, semester: v }))} label="Semester" />
            </div>
            <Bidang label="Pendaftaran dibuka"><input className="input" type="date" value={ubah.tanggal_buka} onChange={(e) => setUbah((s) => ({ ...s, tanggal_buka: e.target.value }))} /></Bidang>
            <Bidang label="Pendaftaran ditutup"><input className="input" type="date" value={ubah.tanggal_tutup} onChange={(e) => setUbah((s) => ({ ...s, tanggal_tutup: e.target.value }))} /></Bidang>
            <Bidang label="Batas rekognisi (%)" wajib hint="Paling banyak 70% dari beban belajar program studi (Juknis).">
              <InputAngka nilai={String(ubah.batas_rekognisi_persen ?? '')} onUbah={(v) => setUbah((s) => ({ ...s, batas_rekognisi_persen: v }))} panjang={2} />
            </Bidang>
          </div>
        ) : null}
      </Dialog>

      <Dialog buka={!!aktifkan} judul="Aktifkan periode" onTutup={() => setAktifkan(null)}
        kaki={<><Tombol onClick={() => setAktifkan(null)}>Batal</Tombol><Tombol jenis="primary" ikon={CalendarCheck} sibuk={sibuk} onClick={jalankanAktif}>Aktifkan</Tombol></>}>
        {aktifkan ? <p>Periode <b>{aktifkan.nama}</b> menjadi periode aktif. Periode yang sekarang aktif ({daftar.find((p) => p.is_aktif)?.nama || 'tidak ada'}) dinonaktifkan; pengajuan yang sudah berjalan tetap di periodenya masing-masing.</p> : null}
      </Dialog>
    </Halaman>
  )
}

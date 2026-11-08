// Penilaian transfer kredit (Juknis II.D.2.b; dasar F09 Formulir Konversi MK).
import { useEffect, useMemo, useRef, useState } from 'react'
import { ScanText, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAsesor } from '../../AsesorData'
import * as api from '../../api'
import { bacaTranskripAisys } from '../../aisys'
import { KEPUTUSAN, NILAI_LULUS, SKALA_NILAI, nilaiLulus } from '../../aturan'
import { BukaBerkas, BarTahap, Bidang, Dialog, Kartu, Lencana, PilihSegmen, Tombol } from '../../../pemohon/ui'

const KEP_TRANSFER = [{ v: 'diakui', l: 'Diakui' }, { v: 'tidak_diakui', l: 'Tidak diakui' }]
const PDDIKTI = [{ v: true, l: 'Sesuai' }, { v: false, l: 'Tidak sesuai' }]

function awalDraf(pn) {
  const a = (pn?.asal || [])[0] || {}
  return { nama: a.nama || '', kode: a.kode || '', sks: a.sks ?? '', nilai: a.nilai || '', keputusan: pn?.keputusan && pn.keputusan !== 'belum_dinilai' ? pn.keputusan : '', nilai_huruf: pn?.nilai_huruf || '', catatan: pn?.catatan || '' }
}

function KartuPddikti({ p, d, bolehNilai }) {
  const { ubahDetail } = useAsesor()
  const v = d.verPddikti || {}
  const [f, setF] = useState({ ijazah_sesuai: v.ijazah_sesuai ?? null, transkrip_sesuai: v.transkrip_sesuai ?? null, status_mahasiswa_pddikti: v.status_mahasiswa_pddikti || '', tautan_bukti: v.tautan_bukti || '', catatan: v.catatan || '' })
  const [sibuk, setSibuk] = useState(false)
  const simpan = async () => {
    setSibuk(true)
    try {
      const hasil = await api.simpanPddikti(p.id, { ...f, tautan_bukti: f.tautan_bukti || null, catatan: f.catatan || null, status_mahasiswa_pddikti: f.status_mahasiswa_pddikti || null })
      ubahDetail(p.id, () => ({ verPddikti: hasil }))
      toast.success('Pemeriksaan PDDikti disimpan')
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }
  return (
    <Kartu judul="Keautentikan ijazah dan transkrip" sub="Cocokkan data dokumen dengan PDDikti (pddikti.kemdiktisaintek.go.id), termasuk akreditasi program studi asal."
      aksi={<div className="pm-baris-aksi"><BukaBerkas path={p.file_transkrip_url} label="Transkrip" /><BukaBerkas path={p.file_ijazah_url} label="Ijazah" /></div>}
      kaki={bolehNilai ? <Tombol ikon={Save} sibuk={sibuk} onClick={simpan}>Simpan pemeriksaan</Tombol> : null}>
      <div className="pm-form-2">
        <Bidang label="Ijazah sesuai PDDikti"><PilihSegmen pilihan={PDDIKTI} nilai={f.ijazah_sesuai} onUbah={(x) => setF((s) => ({ ...s, ijazah_sesuai: x }))} nonaktif={!bolehNilai} label="Ijazah sesuai PDDikti" /></Bidang>
        <Bidang label="Transkrip sesuai PDDikti"><PilihSegmen pilihan={PDDIKTI} nilai={f.transkrip_sesuai} onUbah={(x) => setF((s) => ({ ...s, transkrip_sesuai: x }))} nonaktif={!bolehNilai} label="Transkrip sesuai PDDikti" /></Bidang>
        <Bidang label="Status mahasiswa di PDDikti">
          <select className="input" value={f.status_mahasiswa_pddikti} disabled={!bolehNilai} onChange={(e) => setF((s) => ({ ...s, status_mahasiswa_pddikti: e.target.value }))}>
            <option value="">Pilih status</option>
            {['Lulus', 'Aktif', 'Cuti', 'Mengundurkan diri', 'Putus studi', 'Dikeluarkan', 'Tidak ditemukan'].map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </Bidang>
        <Bidang label="Tautan profil PDDikti" hint="Opsional">
          <input className="input" type="url" value={f.tautan_bukti} disabled={!bolehNilai} onChange={(e) => setF((s) => ({ ...s, tautan_bukti: e.target.value }))} placeholder="https://pddikti.kemdiktisaintek.go.id/..." />
        </Bidang>
        <Bidang label="Catatan" lebar><input className="input" value={f.catatan} disabled={!bolehNilai} onChange={(e) => setF((s) => ({ ...s, catatan: e.target.value }))} /></Bidang>
      </div>
    </Kartu>
  )
}

// Usulan AISYS dari transkrip: asesor memilih baris mana yang dipakai mengisi formulir.
function DialogAisys({ p, daftar, terisi, onPakai, onTutup }) {
  const [kabar, setKabar] = useState('Menyiapkan')
  const [hasil, setHasil] = useState(null)
  const [galat, setGalat] = useState(null)
  const [pilih, setPilih] = useState({})
  const mulai = useRef(false)
  useEffect(() => {
    if (mulai.current) return
    mulai.current = true
    bacaTranskripAisys(p.id, p.file_transkrip_url, setKabar)
      .then((h) => { setHasil(h); setPilih(Object.fromEntries((h.usulan || []).filter((u) => u.asal && !terisi.has(u.mk_id)).map((u) => [u.mk_id, true]))) })
      .catch((e) => setGalat(e.message))
  }, [p.id, p.file_transkrip_url])
  const usulan = Object.fromEntries((hasil?.usulan || []).map((u) => [u.mk_id, u]))
  const jumlah = Object.values(pilih).filter(Boolean).length
  return (
    <Dialog buka judul="Usulan AISYS dari transkrip" onTutup={onTutup} lebar={860}
      kaki={<><Tombol onClick={onTutup}>Tutup</Tombol>{hasil ? <Tombol jenis="primary" disabled={!jumlah} onClick={() => onPakai(daftar.filter((m) => pilih[m.mk_id]).map((m) => ({ mk_id: m.mk_id, asal: usulan[m.mk_id].asal })))}>Isi {jumlah} mata kuliah</Tombol> : null}</>}>
      {galat ? <p className="pm-merah">{galat}</p> : null}
      {!hasil && !galat ? (
        <div className="as-aisys-tunggu" role="status"><div className="sk" style={{ height: 12, width: '60%', borderRadius: 6 }} /><p className="pm-kecil">{kabar}</p></div>
      ) : null}
      {hasil ? (
        <div className="ad-form">
          <p className="pm-kecil">AISYS membaca {hasil.terbaca.length} mata kuliah pada transkrip. Usulan hanya mengisi kolom mata kuliah asal dan nilai; periksa kembali dengan transkrip asli sebelum menyimpan. Keputusan tetap pada asesor.</p>
          <div className="table-wrap">
            <table className="pm-tabel pm-tabel-responsif">
              <thead><tr><th style={{ width: 44 }}><span className="sr-only">Pakai</span></th><th>Mata kuliah tujuan</th><th>Usulan mata kuliah asal</th><th style={{ width: 70 }}>SKS</th><th style={{ width: 70 }}>Nilai</th></tr></thead>
              <tbody>
                {daftar.map((m) => {
                  const u = usulan[m.mk_id]
                  return (
                    <tr key={m.mk_id}>
                      <td data-label="Pakai"><input type="checkbox" disabled={!u?.asal} checked={!!pilih[m.mk_id]} onChange={(e) => setPilih((s) => ({ ...s, [m.mk_id]: e.target.checked }))} aria-label={`Pakai usulan untuk ${m.mk.nama_mk}`} /></td>
                      <td data-label="Tujuan"><div className="pm-tebal">{m.mk.nama_mk}</div><div className="pm-kecil">{m.mk.kode_mk} · {m.mk.sks} SKS{terisi.has(m.mk_id) ? ' · sudah terisi, centang untuk menimpa' : ''}</div></td>
                      <td data-label="Usulan asal">{u?.asal ? <><div>{u.asal.nama}{u.asal.kode ? ` (${u.asal.kode})` : ''}</div>{u.alasan ? <div className="pm-kecil">{u.alasan}</div> : null}</> : <span className="pm-kecil">Tidak ditemukan padanan</span>}</td>
                      <td data-label="SKS">{u?.asal?.sks ?? '-'}</td>
                      <td data-label="Nilai">{u?.asal?.nilai ? <Lencana warna={nilaiLulus(u.asal.nilai) ? 'green' : 'red'}>{u.asal.nilai}</Lencana> : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}

export default function TabTransfer({ p, d, bolehNilai }) {
  const { pasangPenilaian } = useAsesor()
  const daftar = useMemo(() => d.mkDiajukan.filter((m) => m.mekanisme === 'transfer')
    .map((m) => ({ ...m, mk: d.mataKuliah.find((x) => x.id === m.mk_id), pn: d.penilaian.find((x) => x.mk_id === m.mk_id) }))
    .filter((m) => m.mk), [d])
  const [draf, setDraf] = useState(() => Object.fromEntries(daftar.map((m) => [m.mk_id, awalDraf(m.pn)])))
  const [sibuk, setSibuk] = useState(null)
  const [aisys, setAisys] = useState(false)

  const pakaiAisys = (baris) => {
    for (const b of baris) ubah(b.mk_id, { nama: b.asal.nama, kode: b.asal.kode || '', sks: b.asal.sks ?? '', nilai: b.asal.nilai || '' })
    setAisys(false)
    toast.success(`${baris.length} mata kuliah terisi dari usulan AISYS. Periksa lalu simpan.`)
  }

  const ubah = (id, nilai) => setDraf((s) => {
    const baru = { ...s[id], ...nilai }
    // Usulan otomatis dari nilai asal: lulus (minimal C) diakui dengan nilai yang sama.
    if ('nilai' in nilai && nilai.nilai) {
      if (nilaiLulus(nilai.nilai)) { baru.keputusan = 'diakui'; baru.nilai_huruf = nilai.nilai } else { baru.keputusan = 'tidak_diakui'; baru.nilai_huruf = '' }
    }
    if (nilai.keputusan === 'tidak_diakui') baru.nilai_huruf = ''
    return { ...s, [id]: baru }
  })
  const berubah = daftar.filter((m) => JSON.stringify(draf[m.mk_id]) !== JSON.stringify(awalDraf(m.pn)))

  const simpanSatu = async (m) => {
    const x = draf[m.mk_id]
    if (!x.keputusan) throw new Error(`${m.mk.nama_mk}: pilih keputusan`)
    if (x.keputusan === 'diakui' && !x.nilai_huruf) throw new Error(`${m.mk.nama_mk}: pilih nilai yang diakui`)
    const hasil = await api.simpanPenilaian({
      pengajuan_id: p.id, mk_id: m.mk_id, mekanisme: 'transfer', metode: ['transkrip'],
      asal: x.nama || x.nilai ? [{ kategori: 'transkrip', nama: x.nama.trim(), kode: x.kode.trim() || null, sks: x.sks === '' ? null : Number(x.sks), nilai: x.nilai || null }] : [],
      keputusan: x.keputusan, nilai_huruf: x.keputusan === 'diakui' ? x.nilai_huruf : null, catatan: x.catatan.trim() || null,
    })
    pasangPenilaian(p.id, hasil)
    return hasil
  }
  const simpan = async (daftarSimpan) => {
    setSibuk(daftarSimpan.length === 1 ? daftarSimpan[0].mk_id : 'semua')
    let ok = 0
    try {
      for (const m of daftarSimpan) { await simpanSatu(m); ok += 1 }
      toast.success(ok === 1 ? `${daftarSimpan[0].mk.nama_mk} disimpan` : `${ok} penilaian disimpan`)
    } catch (e) { toast.error(e.message, { duration: 6000 }) } finally { setSibuk(null) }
  }

  const sksDiakui = daftar.filter((m) => m.pn?.keputusan === 'diakui').reduce((n, m) => n + m.mk.sks, 0)

  return (
    <div className="pm-tumpuk-besar">
      <KartuPddikti p={p} d={d} bolehNilai={bolehNilai} />
      <Kartu judul="Ekuivalensi mata kuliah" sub={`Bandingkan CP mata kuliah asal (transkrip, silabus/RPS) dengan mata kuliah tujuan. Nilai minimal yang dapat diakui: C. ${sksDiakui} SKS diakui.`} padat
        aksi={bolehNilai && p.file_transkrip_url && daftar.length ? <Tombol ikon={ScanText} onClick={() => setAisys(true)}>Baca transkrip dengan AISYS</Tombol> : null}>
        <ul className="as-mk-daftar">
          {daftar.map((m) => {
            const x = draf[m.mk_id]
            const kotor = berubah.includes(m)
            const kep = m.pn?.keputusan || 'belum_dinilai'
            return (
              <li key={m.mk_id} className="as-mk-baris">
                <div className="as-mk-tujuan">
                  <div className="pm-kecil">{m.mk.kode_mk} · {m.mk.sks} SKS · smt {m.mk.semester}</div>
                  <div className="pm-tebal">{m.mk.nama_mk}</div>
                  <Lencana warna={KEPUTUSAN[kep].warna}>{KEPUTUSAN[kep].label}{m.pn?.nilai_huruf ? ` · ${m.pn.nilai_huruf}` : ''}</Lencana>
                </div>
                <div className="as-mk-asal">
                  <div className="input-label">Mata kuliah asal (sesuai transkrip)</div>
                  <div className="as-asal-grid">
                    <input className="input" placeholder="Nama mata kuliah asal" value={x.nama} disabled={!bolehNilai} onChange={(e) => ubah(m.mk_id, { nama: e.target.value })} aria-label={`Nama MK asal untuk ${m.mk.nama_mk}`} />
                    <input className="input" placeholder="Kode" value={x.kode} disabled={!bolehNilai} onChange={(e) => ubah(m.mk_id, { kode: e.target.value })} aria-label="Kode MK asal" />
                    <input className="input" type="number" min="0" max="12" placeholder="SKS" value={x.sks} disabled={!bolehNilai} onChange={(e) => ubah(m.mk_id, { sks: e.target.value })} aria-label="SKS MK asal" />
                    <select className="input" value={x.nilai} disabled={!bolehNilai} onChange={(e) => ubah(m.mk_id, { nilai: e.target.value })} aria-label="Nilai asal">
                      <option value="">Nilai</option>
                      {SKALA_NILAI.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>
                <div className="as-mk-keputusan">
                  <div className="input-label">Keputusan</div>
                  <div className="as-kep-baris">
                    <PilihSegmen pilihan={KEP_TRANSFER} nilai={x.keputusan} onUbah={(v) => ubah(m.mk_id, { keputusan: v })} nonaktif={!bolehNilai} label={`Keputusan ${m.mk.nama_mk}`} />
                    {x.keputusan === 'diakui' ? (
                      <select className="input as-nilai" value={x.nilai_huruf} disabled={!bolehNilai} onChange={(e) => ubah(m.mk_id, { nilai_huruf: e.target.value })} aria-label="Nilai diakui">
                        <option value="">Nilai</option>
                        {NILAI_LULUS.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    ) : null}
                  </div>
                  <input className="input" placeholder="Catatan ekuivalensi (opsional)" value={x.catatan} disabled={!bolehNilai} onChange={(e) => ubah(m.mk_id, { catatan: e.target.value })} aria-label="Catatan" />
                  {bolehNilai && kotor ? <Tombol ikon={Save} sibuk={sibuk === m.mk_id} onClick={() => simpan([m])}>Simpan</Tombol> : null}
                </div>
              </li>
            )
          })}
        </ul>
      </Kartu>
      {aisys ? <DialogAisys p={p} daftar={daftar} terisi={new Set(daftar.filter((m) => draf[m.mk_id]?.nama).map((m) => m.mk_id))} onPakai={pakaiAisys} onTutup={() => setAisys(false)} /> : null}
      {bolehNilai ? (
        <BarTahap info={berubah.length ? `${berubah.length} perubahan belum disimpan` : `${daftar.filter((m) => m.pn && m.pn.keputusan !== 'belum_dinilai').length} dari ${daftar.length} mata kuliah transfer sudah dinilai`}>
          <Tombol jenis="primary" ikon={Save} sibuk={sibuk === 'semua'} disabled={!berubah.length} onClick={() => simpan(berubah)}>Simpan semua</Tombol>
        </BarTahap>
      ) : null}
    </div>
  )
}

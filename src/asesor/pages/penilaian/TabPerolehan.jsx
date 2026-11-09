// Verifikasi dan validasi F03 serta bukti portofolio (Juknis II.D.2.c.1-3).
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAsesor } from '../../AsesorData'
import * as api from '../../api'
import { KEPUTUSAN, NILAI_LULUS, VATM, daftarSubCpmk } from '../../aturan'
import { PROFISIENSI } from '../../../pemohon/konstanta'
import { urlBerkas } from '../../../pemohon/api'
import { BarTahap, Bidang, Dialog, IkonStatusLangkah, Kartu, Lencana, Pemberitahuan, PilihSegmen, Tombol } from '../../../pemohon/ui'

const LABEL_PROF = Object.fromEntries(PROFISIENSI.map((x) => [x.v, x.l]))
const WARNA_PROF = { sangat_baik: 'green', baik: 'indigo', tidak_pernah: 'slate' }
const KEP = [{ v: 'diakui', l: 'Diakui' }, { v: 'tidak_diakui', l: 'Tidak diakui' }, { v: 'perlu_asesmen_lanjutan', l: 'Perlu asesmen lanjutan' }]

async function bukaBukti(b) {
  if (b.tautan && !b.file_url) { window.open(b.tautan, '_blank', 'noopener'); return }
  const w = window.open('about:blank', '_blank')
  try { const url = await urlBerkas(b.file_url); if (w) w.location.href = url } catch (e) { w?.close(); toast.error(e.message) }
}

function Editor({ p, d, m, bolehNilai, onLanjut, adaBerikut, onKotor }) {
  const { pasangPenilaian } = useAsesor()
  const sub = useMemo(() => daftarSubCpmk(m.mk), [m.mk])
  const ev = d.evaluasi.find((e) => e.mk_id === m.mk_id)
  const awal = useMemo(() => ({
    vatm: sub.map((s) => {
      const lama = (m.pn?.vatm || []).find((x) => x.sub_cpmk === s.kode) || {}
      return { sub_cpmk: s.kode, valid: !!lama.valid, autentik: !!lama.autentik, terkini: !!lama.terkini, memadai: !!lama.memadai }
    }),
    keputusan: m.pn?.keputusan && m.pn.keputusan !== 'belum_dinilai' ? m.pn.keputusan : '',
    nilai_huruf: m.pn?.nilai_huruf || '',
    catatan: m.pn?.catatan || '',
  }), [sub, m.pn])
  const [f, setF] = useState(awal)
  const [sibuk, setSibuk] = useState(false)
  useEffect(() => { setF(awal) }, [awal])
  const kotor = JSON.stringify(f) !== JSON.stringify(awal)
  useEffect(() => { onKotor?.(kotor) }, [kotor]) // eslint-disable-line react-hooks/exhaustive-deps
  const lanjutan = d.lanjutan.filter((x) => x.mk_id === m.mk_id)

  const ubahVatm = (i, k) => setF((s) => ({ ...s, vatm: s.vatm.map((x, j) => (j === i ? { ...x, [k]: !x[k] } : x)) }))
  const semuaVatm = (i, nilai) => setF((s) => ({ ...s, vatm: s.vatm.map((x, j) => (j === i ? { ...x, valid: nilai, autentik: nilai, terkini: nilai, memadai: nilai } : x)) }))
  const butirLemah = f.vatm.filter((x) => !(x.valid && x.autentik && x.terkini && x.memadai)).length

  const simpan = async (lanjut) => {
    if (!f.keputusan) { toast.error('Pilih keputusan'); return }
    if (f.keputusan === 'diakui' && !f.nilai_huruf) { toast.error('Pilih nilai yang diakui'); return }
    setSibuk(true)
    try {
      const hasil = await api.simpanPenilaian({
        pengajuan_id: p.id, mk_id: m.mk_id, mekanisme: 'perolehan',
        metode: lanjutan.length ? ['portofolio', 'wawancara'] : ['portofolio'],
        vatm: f.vatm, keputusan: f.keputusan, nilai_huruf: f.keputusan === 'diakui' ? f.nilai_huruf : null,
        catatan: f.catatan.trim() || null,
        rujukan_bukti: [...new Set((ev?.butir || []).flatMap((b) => b.bukti || []))],
      })
      pasangPenilaian(p.id, hasil)
      toast.success(`Penilaian ${m.mk.nama_mk} disimpan`)
      if (lanjut) onLanjut()
    } catch (e) { toast.error(e.message, { duration: 6000 }) } finally { setSibuk(false) }
  }

  return (
    <div className="pm-tumpuk-besar">
      <Kartu judul={`${m.mk.nama_mk}, ${m.mk.sks} SKS`} sub={m.mk.deskripsi || m.mk.cpmk || null} padat
        aksi={ev?.pernyataan_setuju ? <Lencana warna="green">F03 ditandatangani pemohon</Lencana> : <Lencana warna="amber">F03 belum lengkap</Lencana>}>
        <div className="table-wrap">
          <table className="pm-tabel as-tabel-f03">
            <thead><tr>
              <th>Kemampuan akhir yang diharapkan</th><th style={{ width: 130 }}>Profisiensi pemohon</th><th style={{ width: 150 }}>Bukti</th>
              <th style={{ width: 210 }}><span title="Valid, Autentik, Terkini, Memadai">Penilaian asesor (V-A-T-M)</span></th>
            </tr></thead>
            <tbody>
              {sub.map((s, i) => {
                const bt = (ev?.butir || []).find((b) => b.sub_cpmk === s.kode)
                const v = f.vatm[i]
                return (
                  <tr key={s.kode}>
                    <td data-label="Kemampuan"><div className="pm-chip">{s.kode}</div><div style={{ marginTop: 6 }}>{s.deskripsi}</div></td>
                    <td data-label="Profisiensi">{bt?.profisiensi ? <Lencana warna={WARNA_PROF[bt.profisiensi]}>{LABEL_PROF[bt.profisiensi]}</Lencana> : <span className="pm-kecil">Tidak diisi</span>}</td>
                    <td data-label="Bukti">
                      <div className="as-bukti">
                        {(bt?.bukti || []).map((no) => {
                          const b = d.bukti.find((x) => x.nomor === no)
                          return <button key={no} type="button" className="as-bukti-no" title={b ? b.nama_dokumen : 'Bukti tidak ditemukan'} disabled={!b} onClick={() => b && bukaBukti(b)}>{no}</button>
                        })}
                        {!(bt?.bukti || []).length ? <span className="pm-kecil">-</span> : null}
                      </div>
                    </td>
                    <td data-label="V-A-T-M">
                      <div className="as-vatm" role="group" aria-label={`V-A-T-M ${s.kode}`}>
                        {VATM.map((k) => (
                          <button key={k.k} type="button" className={v[k.k] ? 'is-on' : ''} aria-pressed={v[k.k]} title={k.judul} disabled={!bolehNilai} onClick={() => ubahVatm(i, k.k)}>{k.l}</button>
                        ))}
                        {bolehNilai ? <button type="button" className="as-vatm-semua" onClick={() => semuaVatm(i, !(v.valid && v.autentik && v.terkini && v.memadai))} title="Tandai semua prinsip">
                          <Check size={13} aria-hidden="true" /><span className="pm-sr">Tandai semua</span></button> : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Kartu>

      {lanjutan.length ? (
        <Kartu judul="Hasil penilaian lanjutan (F10)" padat>
          <ul className="tm-daftar">
            {lanjutan.map((x) => (
              <li key={x.id} className="tm-baris">
                <span className="pm-grow">{x.catatan || `${(x.butir || []).length} butir pertanyaan`}</span>
                <Lencana warna={x.hasil === 'memenuhi' ? 'green' : x.hasil ? 'red' : 'slate'}>{x.hasil === 'memenuhi' ? 'Memenuhi' : x.hasil ? 'Belum memenuhi' : 'Belum diputuskan'}</Lencana>
              </li>
            ))}
          </ul>
        </Kartu>
      ) : null}

      <Kartu judul="Keputusan asesor">
        {f.keputusan === 'diakui' && butirLemah ? (
          <Pemberitahuan jenis="amber">{butirLemah} butir belum memenuhi seluruh prinsip V-A-T-M. Pastikan bukti dan hasil wawancara cukup sebelum mengakui mata kuliah ini.</Pemberitahuan>
        ) : null}
        <div className="pm-form-2">
          <Bidang label="Keputusan" lebar>
            <PilihSegmen pilihan={KEP}
              nilai={f.keputusan} onUbah={(v) => setF((s) => ({ ...s, keputusan: v, nilai_huruf: v === 'diakui' ? s.nilai_huruf : '' }))} nonaktif={!bolehNilai} label="Keputusan" />
          </Bidang>
          {f.keputusan === 'diakui' ? (
            <Bidang label="Nilai yang diakui" hint="Minimal C sesuai Peraturan Akademik STIKOM">
              <select className="input" value={f.nilai_huruf} disabled={!bolehNilai} onChange={(e) => setF((s) => ({ ...s, nilai_huruf: e.target.value }))}>
                <option value="">Pilih nilai</option>
                {NILAI_LULUS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Bidang>
          ) : null}
          {f.keputusan === 'perlu_asesmen_lanjutan' ? (
            <p className="pm-kecil" style={{ gridColumn: '1 / -1' }}>Mata kuliah dibahas di pleno awal, lalu Sekretariat menjadwalkan wawancara atau unjuk kerja. Keputusan akhir ditetapkan setelah penilaian lanjutan.</p>
          ) : null}
          <Bidang label="Catatan asesor" lebar hint="Tampil di F03 kolom komentar asesor">
            <textarea className="input" rows={3} value={f.catatan} disabled={!bolehNilai} onChange={(e) => setF((s) => ({ ...s, catatan: e.target.value }))} />
          </Bidang>
        </div>
      </Kartu>
      {bolehNilai ? (
        <BarTahap info={kotor ? 'Ada perubahan yang belum disimpan' : m.pn && m.pn.keputusan !== 'belum_dinilai' ? `Tersimpan: ${KEPUTUSAN[m.pn.keputusan].label}${m.pn.nilai_huruf ? ` (${m.pn.nilai_huruf})` : ''}` : 'Belum dinilai'}>
          <Tombol ikon={Save} sibuk={sibuk} onClick={() => simpan(false)} disabled={!kotor && !!m.pn}>Simpan</Tombol>
          {adaBerikut ? <button type="button" className="btn btn-primary" disabled={sibuk} onClick={() => (kotor || !m.pn ? simpan(true) : onLanjut())}>Simpan dan lanjut <ArrowRight size={14} /></button> : null}
        </BarTahap>
      ) : null}
    </div>
  )
}

export default function TabPerolehan({ p, d, bolehNilai }) {
  const [param, setParam] = useSearchParams()
  const [kotor, setKotor] = useState(false)
  const [tahan, setTahan] = useState(null)
  const daftar = useMemo(() => d.mkDiajukan.filter((m) => m.mekanisme === 'perolehan')
    .map((m) => ({ ...m, mk: d.mataKuliah.find((x) => x.id === m.mk_id), pn: d.penilaian.find((x) => x.mk_id === m.mk_id) }))
    .filter((m) => m.mk), [d])
  if (!daftar.length) return <Pemberitahuan>Tidak ada mata kuliah perolehan kredit.</Pemberitahuan>
  const aktifId = daftar.some((m) => m.mk_id === param.get('mk')) ? param.get('mk') : daftar[0].mk_id
  const idx = daftar.findIndex((m) => m.mk_id === aktifId)
  const aktif = daftar[idx]
  const status = (m) => (!m.pn || m.pn.keputusan === 'belum_dinilai' ? 'belum' : m.pn.keputusan === 'perlu_asesmen_lanjutan' ? 'proses' : 'selesai')
  const pindah = (id) => { const n = new URLSearchParams(param); n.set('tab', 'perolehan'); n.set('mk', id); setKotor(false); setParam(n) }
  // Pindah mata kuliah membuang isian yang belum disimpan: minta konfirmasi dulu.
  const pilih = (id) => { if (id === aktifId) return; if (kotor) setTahan(id); else pindah(id) }
  const berikut = [...daftar.slice(idx + 1), ...daftar.slice(0, idx)].find((m) => status(m) === 'belum')

  return (
    <div className="pm-dua-kolom">
      <nav className="card pm-daftar-mk" aria-label="Mata kuliah perolehan kredit">
        <div className="pm-daftar-mk-judul">Mata kuliah ({daftar.length})</div>
        <ul>
          {daftar.map((m) => (
            <li key={m.mk_id}>
              <button type="button" className={m.mk_id === aktifId ? 'is-on' : ''} aria-current={m.mk_id === aktifId ? 'true' : undefined} onClick={() => pilih(m.mk_id)}>
                <IkonStatusLangkah status={status(m)} />
                <span className="pm-grow">{m.mk.nama_mk}</span>
                <span className="pm-kecil">{m.pn?.nilai_huruf || `${m.mk.sks} SKS`}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <Editor key={aktifId} p={p} d={d} m={aktif} bolehNilai={bolehNilai} adaBerikut={!!berikut} onKotor={setKotor} onLanjut={() => berikut && pindah(berikut.mk_id)} />
      <Dialog buka={!!tahan} judul="Perubahan belum disimpan" onTutup={() => setTahan(null)} lebar={460}
        kaki={<><Tombol onClick={() => setTahan(null)}>Kembali mengisi</Tombol><Tombol jenis="danger" onClick={() => { const id = tahan; setTahan(null); pindah(id) }}>Buang perubahan</Tombol></>}>
        <p>Penilaian {aktif.mk.nama_mk} belum disimpan. Bila pindah mata kuliah, isian tersebut hilang.</p>
      </Dialog>
    </div>
  )
}

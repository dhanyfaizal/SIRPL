import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePemohon } from '../PemohonData'
import * as api from '../api'
import { PROFISIENSI } from '../konstanta'
import { evaluasiLengkap, mkPerolehan } from '../kelengkapan'
import { Bidang, Halaman, IkonStatusLangkah, Kartu, Kerangka, Pemberitahuan, Segmen, Tombol } from '../ui'

const PERNYATAAN = [
  'Semua informasi yang saya tuliskan sepenuhnya benar dan saya bertanggung jawab atas seluruh data dalam formulir ini. Apabila di kemudian hari informasi tersebut tidak benar, saya bersedia menerima sanksi sesuai ketentuan yang berlaku.',
  'Saya memberikan izin kepada pengelola RPL untuk memeriksa kebenaran informasi ini kepada pihak terkait data akademik sebelumnya dan kepada perusahaan tempat saya bekerja sebelumnya atau saat ini.',
  'Saya bersedia mengikuti asesmen lanjutan untuk membuktikan kompetensi saya, sesuai waktu dan tempat atau platform daring yang ditentukan unit RPL.',
]

function daftarSubCpmk(mk) {
  const sub = Array.isArray(mk.sub_cpmk) ? mk.sub_cpmk : []
  if (sub.length) return sub.map((s, i) => ({ kode: s.kode || `Sub-CPMK ${i + 1}`, deskripsi: s.deskripsi || s.teks || '' }))
  return [{ kode: 'CPMK', deskripsi: mk.cpmk || 'Capaian pembelajaran mata kuliah ini (program studi belum merinci sub-CPMK).' }]
}

function Editor({ mk, evaluasi }) {
  const { data, pengajuan, bisaDiubah, ubah } = usePemohon()
  const sub = useMemo(() => daftarSubCpmk(mk), [mk])
  const awalButir = useMemo(() => sub.map((s) => {
    const ada = (evaluasi?.butir || []).find((b) => b.sub_cpmk === s.kode)
    return { sub_cpmk: s.kode, profisiensi: ada?.profisiensi || '', bukti: ada?.bukti || [] }
  }), [sub, evaluasi])
  const [butir, setButir] = useState(awalButir)
  const [setuju, setSetuju] = useState(!!evaluasi?.pernyataan_setuju)
  const [tempat, setTempat] = useState(evaluasi?.tempat_pernyataan || '')
  const [sibuk, setSibuk] = useState(false)
  useEffect(() => { setButir(awalButir); setSetuju(!!evaluasi?.pernyataan_setuju); setTempat(evaluasi?.tempat_pernyataan || '') }, [awalButir, evaluasi])

  const ubahButir = (i, nilai) => setButir((s) => s.map((b, j) => (j === i ? { ...b, ...nilai } : b)))
  const terisi = butir.filter((b) => b.profisiensi).length
  const tanpaBukti = butir.filter((b) => b.profisiensi && b.profisiensi !== 'tidak_pernah' && !b.bukti.length).length

  const simpan = async () => {
    if (setuju && terisi < butir.length) { toast.error('Isi tingkat profisiensi untuk semua butir sebelum menyetujui pernyataan'); return }
    setSibuk(true)
    try {
      const hasil = await api.simpanEvaluasi({
        pengajuanId: pengajuan.id, mkId: mk.id, tempat,
        butir: butir.map((b) => ({ ...b, bukti: b.profisiensi === 'tidak_pernah' ? [] : b.bukti })),
        pernyataan: setuju,
      })
      ubah((d) => ({ evaluasi: [...d.evaluasi.filter((e) => e.mk_id !== mk.id), hasil] }))
      toast.success(`Evaluasi diri ${mk.nama_mk} disimpan`)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <div className="pm-tumpuk-besar">
      <Kartu judul={`${mk.nama_mk}, ${mk.sks} SKS, semester ${mk.semester}`}
        sub={mk.deskripsi || mk.cpmk || null}
        aksi={<span className="pm-kecil">{terisi} dari {butir.length} butir terisi</span>} padat>
        <div className="table-wrap">
          <table className="pm-tabel">
            <thead><tr><th>Kemampuan akhir yang diharapkan</th><th style={{ width: 300 }}>Profisiensi saat ini</th><th style={{ width: 220 }}>Nomor bukti</th></tr></thead>
            <tbody>
              {butir.map((b, i) => (
                <tr key={b.sub_cpmk}>
                  <td><div className="pm-chip">{b.sub_cpmk}</div><div style={{ marginTop: 6 }}>{sub[i].deskripsi}</div></td>
                  <td>
                    <Segmen label={`Profisiensi ${b.sub_cpmk}`} pilihan={PROFISIENSI} nilai={b.profisiensi} nonaktif={!bisaDiubah}
                      onUbah={(v) => ubahButir(i, { profisiensi: v })} />
                  </td>
                  <td>
                    {b.profisiensi === 'tidak_pernah' ? <span className="pm-kecil">Tidak perlu bukti</span> : data.bukti.length ? (
                      <div className="pm-pilih-bukti" role="group" aria-label={`Bukti untuk ${b.sub_cpmk}`}>
                        {data.bukti.map((x) => {
                          const on = b.bukti.includes(x.nomor)
                          return (
                            <button key={x.nomor} type="button" className={on ? 'is-on' : ''} aria-pressed={on} disabled={!bisaDiubah}
                              title={x.nama_dokumen}
                              onClick={() => ubahButir(i, { bukti: on ? b.bukti.filter((n) => n !== x.nomor) : [...b.bukti, x.nomor].sort((p, q) => p - q) })}>
                              {x.nomor}
                            </button>
                          )
                        })}
                      </div>
                    ) : <Link to="/pemohon/pengajuan/bukti" className="pm-tautan">Tambah bukti dulu</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tanpaBukti ? <div className="card-body" style={{ paddingTop: 0 }}>
          <Pemberitahuan jenis="amber">{tanpaBukti} butir berprofisiensi baik atau sangat baik belum dirujuk ke bukti. Klaim tanpa bukti sulit diakui asesor.</Pemberitahuan>
        </div> : null}
      </Kartu>

      <Kartu judul="Pernyataan calon"
        kaki={bisaDiubah ? <div className="pm-kaki-aksi"><span>Kolom V-A-T-M diisi asesor setelah pengajuan dikirim.</span>
          <Tombol jenis="primary" ikon={Save} sibuk={sibuk} onClick={simpan}>Simpan evaluasi diri</Tombol></div> : null}>
        <ol className="pm-daftar-bernomor">{PERNYATAAN.map((p) => <li key={p}>{p}</li>)}</ol>
        <div className="pm-form-2" style={{ marginTop: 14 }}>
          <Bidang label="Tempat pernyataan"><input className="input" value={tempat} onChange={(e) => setTempat(e.target.value)} readOnly={!bisaDiubah} placeholder="Contoh: Purwokerto" /></Bidang>
        </div>
        <label className="pm-centang" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={setuju} disabled={!bisaDiubah} onChange={(e) => setSetuju(e.target.checked)} />
          Saya telah membaca dan mengisi formulir ini dan menyetujui ketiga pernyataan di atas.
        </label>
      </Kartu>
    </div>
  )
}

export default function EvaluasiDiri() {
  const { siap, data, pengajuan } = usePemohon()
  const [params, setParams] = useSearchParams()
  if (!siap) return <Kerangka />
  if (!pengajuan) return <Navigate to="/pemohon" replace />

  const daftar = mkPerolehan(data).map((m) => ({ ...m, mk: data.mataKuliah.find((k) => k.id === m.mk_id) })).filter((m) => m.mk)
  if (!daftar.length) {
    return (
      <Halaman judul="Evaluasi diri (F03)" sub="Langkah 4. Formulir ini wajib untuk setiap mata kuliah perolehan kredit.">
        <Pemberitahuan judul="Belum ada mata kuliah perolehan kredit"
          aksi={<Link className="btn btn-primary btn-sm" to="/pemohon/pengajuan/data">Pilih mata kuliah</Link>}>
          Tandai mata kuliah dengan mekanisme "Perolehan" di halaman Data dan persyaratan. Mata kuliah transfer kredit tidak memerlukan F03.
        </Pemberitahuan>
      </Halaman>
    )
  }
  const aktifId = params.get('mk') && daftar.some((d) => d.mk_id === params.get('mk')) ? params.get('mk') : daftar[0].mk_id
  const aktif = daftar.find((d) => d.mk_id === aktifId)
  const ev = (id) => data.evaluasi.find((e) => e.mk_id === id)

  return (
    <Halaman judul="Evaluasi diri (F03)" sub="Langkah 4. Nilai sendiri kemampuan Anda pada setiap butir capaian pembelajaran, lalu rujuk nomor bukti yang mendukungnya. Isilah dengan jujur.">
      <div className="pm-dua-kolom">
        <nav className="card pm-daftar-mk" aria-label="Mata kuliah perolehan kredit">
          <div className="pm-daftar-mk-judul">Mata kuliah ({daftar.length})</div>
          <ul>
            {daftar.map((d) => (
              <li key={d.mk_id}>
                <button type="button" className={d.mk_id === aktifId ? 'is-on' : ''} aria-current={d.mk_id === aktifId ? 'true' : undefined}
                  onClick={() => setParams({ mk: d.mk_id })}>
                  <IkonStatusLangkah status={evaluasiLengkap(ev(d.mk_id)) ? 'selesai' : ev(d.mk_id) ? 'proses' : 'belum'} />
                  <span className="pm-grow">{d.mk.nama_mk}</span>
                  <span className="pm-kecil">{d.mk.sks} SKS</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <Editor key={aktifId} mk={aktif.mk} evaluasi={ev(aktifId)} />
      </div>
      <Kartu judul="Tingkat profisiensi">
        <div className="pm-grid-3">
          <div><div className="pm-tebal">Sangat baik</div><p className="pm-kecil">Saya melakukan tugas ini atau menguasai bahan kajian ini dengan sangat baik, dan selalu menggunakannya dalam pekerjaan dengan tepat tanpa kesalahan.</p></div>
          <div><div className="pm-tebal">Baik</div><p className="pm-kecil">Saya melakukan tugas ini atau menguasai bahan kajian ini dengan baik, dan kadang-kadang menggunakannya dalam pekerjaan.</p></div>
          <div><div className="pm-tebal">Tidak pernah</div><p className="pm-kecil">Saya tidak pernah melakukan tugas ini, tidak menguasai bahan kajian ini, atau tidak memiliki keterampilan ini.</p></div>
        </div>
      </Kartu>
    </Halaman>
  )
}

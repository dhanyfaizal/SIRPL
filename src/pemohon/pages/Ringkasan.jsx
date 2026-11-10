import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Check, Send, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePemohon } from '../PemohonData'
import * as api from '../api'
import { JENIS_RPL, rupiah } from '../konstanta'
import { hitungKelengkapan } from '../kelengkapan'
import { BarTahap, Dialog, GerbangTahap, Halaman, Kartu, Kerangka, LencanaModeBaca, LencanaStatus, Pemberitahuan, Tombol } from '../ui'

// Kode syarat dari cek_syarat_pengajuan() -> halaman perbaikannya.
const TAUTAN_SYARAT = {
  jenis_rpl: '/pemohon/pengajuan/data', prodi: '/pemohon/pengajuan/data', prodi_transfer: '/pemohon/pengajuan/data',
  prodi_perolehan: '/pemohon/pengajuan/data', pddikti_pt_asal: '/pemohon/pengajuan/data', pddikti_satu_tahun: '/pemohon/pengajuan/data',
  data_pt_asal: '/pemohon/pengajuan/data', berkas_transkrip: '/pemohon/pengajuan/data', berkas_ijazah_slta: '/pemohon/pengajuan/data',
  f02_biodata: '/pemohon/pengajuan/data', mk_kosong: '/pemohon/pengajuan/data', mk_ditutup: '/pemohon/pengajuan/data',
  f07: '/pemohon/pengajuan/riwayat-hidup', f07_atasan: '/pemohon/pengajuan/riwayat-hidup', f03: '/pemohon/pengajuan/evaluasi-diri',
}

const PERNYATAAN_F02 = [
  'Semua informasi yang saya tuliskan sepenuhnya benar dan saya bertanggung jawab atas seluruh data dalam formulir ini. Apabila di kemudian hari informasi tersebut tidak benar, saya bersedia menerima sanksi sesuai ketentuan yang berlaku.',
  'Saya memberikan izin kepada pengelola RPL untuk memeriksa kebenaran informasi dalam formulir aplikasi ini kepada pihak terkait jenjang akademik sebelumnya dan kepada perusahaan tempat saya bekerja sebelumnya atau saat ini.',
  'Saya akan mengikuti proses asesmen sesuai jadwal yang ditetapkan oleh STIKOM Yos Sudarso.',
]

export default function Ringkasan() {
  const { siap, data, pengajuan, bisaDiubah, muat } = usePemohon()
  const [syarat, setSyarat] = useState(null)
  const [galat, setGalat] = useState(null)
  const [buka, setBuka] = useState(false)
  const [setuju, setSetuju] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const navigate = useNavigate()

  const periksa = useCallback(async () => {
    if (!pengajuan) return
    try { setSyarat(await api.cekSyarat(pengajuan.id)); setGalat(null) } catch (e) { setGalat(e.message) }
  }, [pengajuan])
  useEffect(() => { if (bisaDiubah) periksa() }, [periksa, bisaDiubah, data?.mkDiajukan, data?.evaluasi, data?.biodata, data?.riwayat])

  if (!siap) return <Kerangka />
  if (!pengajuan) return <Navigate to="/pemohon" replace />

  const k = hitungKelengkapan(data)
  const tahap = k.tahap('kirim')
  const terkunci = bisaDiubah && !tahap.terbuka
  const sebelum = k.langkah[k.langkah.findIndex((l) => l.id === 'kirim') - 1]
  const prodi = data.prodi.find((p) => p.id === pengajuan.prodi_pilihan_id)
  const mk = data.mkDiajukan.map((m) => ({ ...m, mk: data.mataKuliah.find((x) => x.id === m.mk_id) })).filter((m) => m.mk)
  const sksT = mk.filter((m) => m.mekanisme === 'transfer').reduce((n, m) => n + m.mk.sks, 0)
  const sksP = mk.filter((m) => m.mekanisme === 'perolehan').reduce((n, m) => n + m.mk.sks, 0)
  const tarifAsesmen = data.tarif.find((t) => t.komponen === 'asesmen_per_sks' && !t.is_internal)

  const kirim = async () => {
    setSibuk(true)
    try {
      await api.ubahStatus(pengajuan.id, 'diajukan')
      await muat()
      setBuka(false)
      toast.success('Pengajuan terkirim ke Sekretariat RPL')
    } catch (e) {
      toast.error(e.message.replace(/^Pengajuan belum dapat dikirim:\s*/, 'Belum dapat dikirim: '), { duration: 7000 })
      periksa()
    } finally { setSibuk(false) }
  }

  return (
    <Halaman judul="Ringkasan dan kirim" sub={`Tahap ${tahap.no}, terakhir. Periksa ringkasan pengajuan, lalu kirim ke Sekretariat RPL.`}
      aksi={terkunci ? <LencanaModeBaca /> : null}>
      <GerbangTahap tahap={bisaDiubah ? tahap : null} sebelum={k.sebelumBelum('kirim')}>

      {pengajuan.status === 'tidak_memenuhi_syarat' ? (
        <Pemberitahuan jenis="red" judul="Pengajuan tidak memenuhi syarat">
          <div style={{ whiteSpace: 'pre-line' }}>{pengajuan.catatan_revisi || 'Hubungi Sekretariat RPL untuk keterangan lebih lanjut.'}</div>
          <div className="pm-kecil" style={{ marginTop: 6 }}>Pengajuan ini berhenti dan tidak dapat dikirim ulang.</div>
        </Pemberitahuan>
      ) : !bisaDiubah ? (
        <Pemberitahuan jenis="green" judul="Pengajuan sudah dikirim">
          Status saat ini: <LencanaStatus status={pengajuan.status} />. Pantau perkembangannya di Beranda.
        </Pemberitahuan>
      ) : galat ? <Pemberitahuan jenis="red" judul="Syarat tidak dapat diperiksa">{galat}</Pemberitahuan>
        : !syarat ? <Kartu><div className="sk" style={{ height: 60 }} /></Kartu>
        : syarat.length ? (
          <Kartu judul="Yang masih perlu dilengkapi" sub={`${syarat.length} syarat belum terpenuhi`} padat>
            <ul className="pm-checklist">
              {syarat.map((s) => (
                <li key={s.kode}>
                  <X size={16} className="pm-merah" aria-hidden="true" />
                  <span className="pm-grow">{s.pesan}</span>
                  {TAUTAN_SYARAT[s.kode] ? <Link className="btn btn-secondary btn-sm" to={TAUTAN_SYARAT[s.kode]}>Lengkapi</Link> : null}
                </li>
              ))}
            </ul>
          </Kartu>
        ) : (
          <Pemberitahuan jenis="green" judul="Semua syarat Juknis terpenuhi">Pengajuan siap dikirim.</Pemberitahuan>
        )}

      <div className="pm-grid-3">
        <div className="stat-card"><div className="stat-card-label">Jenis RPL</div><div className="pm-stat-teks">{JENIS_RPL[pengajuan.jenis_rpl]?.label || '-'}</div><div className="stat-card-sub">{prodi?.nama}</div></div>
        <div className="stat-card"><div className="stat-card-label">SKS diajukan</div><div className="stat-card-value">{sksT + sksP}</div><div className="stat-card-sub">Transfer {sksT} · Perolehan {sksP} · batas {data.batasSks ?? '-'}</div></div>
        <div className="stat-card"><div className="stat-card-label">Estimasi biaya asesmen</div><div className="pm-stat-teks">{tarifAsesmen ? rupiah((sksT + sksP) * Number(tarifAsesmen.besaran)) : '-'}</div><div className="stat-card-sub">{tarifAsesmen ? `${rupiah(tarifAsesmen.besaran)} per SKS` : ''}</div></div>
      </div>

      <Kartu judul="Kelengkapan berkas" padat>
        <ul className="pm-checklist">
          {k.langkah.filter((l) => !l.to.endsWith('/kirim')).map((l) => (
            <li key={l.to}>
              {l.status === 'selesai' ? <Check size={16} className="pm-ok" aria-label="Lengkap" /> : <X size={16} className="pm-merah" aria-label="Belum lengkap" />}
              <Link to={l.to} className="pm-grow">{l.label}</Link>
              {l.info ? <span className="pm-kecil">{l.info}</span> : null}
            </li>
          ))}
        </ul>
      </Kartu>

      <Kartu judul="Mata kuliah yang diajukan" padat>
        {mk.length ? (
          <div className="table-wrap">
            <table className="pm-tabel pm-tabel-responsif">
              <thead><tr><th style={{ width: 110 }}>Kode</th><th>Mata kuliah</th><th style={{ width: 60 }}>SKS</th><th style={{ width: 140 }}>Mekanisme</th><th style={{ width: 120 }}>F03</th></tr></thead>
              <tbody>
                {mk.map((m) => {
                  const ev = data.evaluasi.find((e) => e.mk_id === m.mk_id)
                  return (
                    <tr key={m.mk_id}>
                      <td className="pm-kecil" data-label="Kode">{m.mk.kode_mk}</td><td data-label="Mata kuliah">{m.mk.nama_mk}</td><td data-label="SKS">{m.mk.sks}</td>
                      <td data-label="Mekanisme">{m.mekanisme === 'transfer' ? 'Transfer' : 'Perolehan'}</td>
                      <td data-label="F03">{m.mekanisme === 'transfer' ? <span className="pm-kecil">Tidak perlu</span>
                        : ev?.pernyataan_setuju ? <span className="badge-pill badge-green">Lengkap</span> : <span className="badge-pill badge-amber">Belum</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="pm-kosong">Belum ada mata kuliah yang dipilih.</p>}
      </Kartu>

      </GerbangTahap>
      {bisaDiubah ? (
        <BarTahap info={syarat && !syarat.length ? 'Semua syarat terpenuhi. Pengajuan siap dikirim.' : syarat ? `${syarat.length} syarat belum terpenuhi` : 'Memeriksa syarat...'}>
          <button type="button" className="btn btn-secondary" onClick={() => navigate(sebelum.to)}>Kembali</button>
          <Tombol jenis="primary" ikon={Send} disabled={terkunci || !syarat || syarat.length > 0} onClick={() => { setSetuju(false); setBuka(true) }}>
            {pengajuan.status === 'dikembalikan_sekretariat' ? 'Kirim ulang pengajuan' : 'Kirim pengajuan'}</Tombol>
        </BarTahap>
      ) : null}
      <Dialog buka={buka} judul="Kirim pengajuan ke Sekretariat RPL" onTutup={() => setBuka(false)} lebar={560}
        kaki={<><Tombol onClick={() => setBuka(false)}>Batal</Tombol><Tombol jenis="primary" ikon={Send} sibuk={sibuk} disabled={!setuju} onClick={kirim}>Kirim pengajuan</Tombol></>}>
        <p>Setelah dikirim, data, berkas, dan Formulir Evaluasi Diri tidak dapat diubah lagi kecuali Sekretariat mengembalikannya. Dengan mengirim Formulir Aplikasi (F02) ini, saya menyatakan bahwa:</p>
        <ol className="pm-daftar-bernomor">{PERNYATAAN_F02.map((p) => <li key={p}>{p}</li>)}</ol>
        <label className="pm-centang">
          <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} />
          Saya menyetujui pernyataan di atas.
        </label>
      </Dialog>
    </Halaman>
  )
}

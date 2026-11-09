// Ringkasan keputusan semua mata kuliah, lalu ajukan ke pleno (Juknis II.D.2 "Pengakuan").
import { useState } from 'react'
import { FilePlus, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAsesor } from '../../AsesorData'
import * as api from '../../api'
import { KEPUTUSAN, PERAN, ringkasPenilaian, tujuanPleno } from '../../aturan'
import { tanggal } from '../../../pemohon/konstanta'
import { BarTahap, Bidang, Dialog, Kartu, Lencana, Pemberitahuan, Tombol } from '../../../pemohon/ui'

const LABEL_TUJUAN = { pleno_awal: 'pleno awal', pleno: 'pleno hasil rekognisi' }
// Riwayat keuangan (diskon, cicilan, tagihan) bukan urusan asesor.
const LOG_KEUANGAN = new Set(['atur_tagihan', 'tambah_tagihan', 'hapus_tagihan', 'verifikasi_bayar', 'bayar_lunas', 'bayar_ditolak'])

export default function TabRingkasan({ p, d, bolehNilai, koordinator, tugas, keTab }) {
  const { data, peta, gantiPengajuan, role } = useAsesor()
  const [dialog, setDialog] = useState(null)
  const [teks, setTeks] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const r = ringkasPenilaian(d.mkDiajukan, d.penilaian, d.mataKuliah)
  const tujuan = tujuanPleno(p, r)
  const tim = data.penugasan.filter((x) => x.pengajuan_id === p.id)
  const lewatBatas = d.batasSks != null && r.sksDiakui > d.batasSks
  const halangan = !tujuan ? null
    : r.belum ? `${r.belum} mata kuliah belum dinilai`
    : tujuan === 'pleno' && r.lanjutan ? `${r.lanjutan} mata kuliah masih "perlu asesmen lanjutan"`
    : lewatBatas ? `SKS diakui melebihi batas ${d.batasSks} SKS`
    : null
  const bolehMinta = (!!tugas || role === 'admin') && ['asesmen', 'penilaian_lanjutan'].includes(p.status)

  const buka = (jenis) => {
    if (jenis === 'bukti') {
      const usulan = d.lanjutan.filter((x) => x.perlu_bukti_tambahan && x.bukti_tambahan_diminta).map((x) => `${d.mataKuliah.find((m) => m.id === x.mk_id)?.nama_mk}: ${x.bukti_tambahan_diminta}`)
      setTeks(usulan.join('\n'))
    } else setTeks('')
    setDialog(jenis)
  }
  const kirim = async () => {
    setSibuk(true)
    try {
      if (dialog === 'pleno') {
        const ke = await api.ajukanPleno(p.id, teks.trim())
        toast.success(`Diajukan ke ${LABEL_TUJUAN[ke] || ke}`)
      } else {
        if (!teks.trim()) { toast.error('Tuliskan bukti yang diminta'); setSibuk(false); return }
        await api.mintaBuktiTambahan(p.id, teks.trim())
        toast.success('Permintaan bukti tambahan dikirim ke pemohon')
      }
      gantiPengajuan(await api.muatPengajuan(p.id))
      setDialog(null)
    } catch (e) { toast.error(e.message, { duration: 7000 }) } finally { setSibuk(false) }
  }

  return (
    <div className="pm-tumpuk-besar">
      <div className="tm-stat">
        <div className="stat-card"><div className="stat-card-label">Mata kuliah diajukan</div><div className="stat-card-value">{r.baris.length}</div><div className="stat-card-sub">{r.sksDiajukan} SKS</div></div>
        <div className="stat-card"><div className="stat-card-label">Diakui</div><div className="stat-card-value">{r.diakui}</div><div className={`stat-card-sub${lewatBatas ? ' pm-merah' : ''}`}>{r.sksDiakui} SKS{d.batasSks != null ? ` dari batas ${d.batasSks} SKS` : ''}</div></div>
        <div className="stat-card"><div className="stat-card-label">Perlu asesmen lanjutan</div><div className="stat-card-value">{r.lanjutan}</div><div className="stat-card-sub">dibahas di pleno awal</div></div>
        <div className="stat-card"><div className="stat-card-label">Belum dinilai</div><div className={`stat-card-value${r.belum ? ' pm-wait' : ''}`}>{r.belum}</div><div className="stat-card-sub">mata kuliah</div></div>
      </div>

      <Kartu judul="Keputusan per mata kuliah" padat>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr><th style={{ width: 110 }}>Kode</th><th>Mata kuliah</th><th style={{ width: 56 }}>SKS</th><th style={{ width: 110 }}>Mekanisme</th><th style={{ width: 200 }}>Keputusan</th><th style={{ width: 70 }}>Nilai</th><th style={{ width: 150 }}>Dinilai oleh</th></tr></thead>
            <tbody>
              {r.baris.map((b) => (
                <tr key={b.mk_id}>
                  <td className="pm-kecil" data-label="Kode">{b.mk.kode_mk}</td>
                  <td data-label="Mata kuliah"><button type="button" className="as-tautan" onClick={() => b.mekanisme === 'transfer' ? keTab('transfer', { mk: b.mk_id }) : keTab('perolehan', { mk: b.mk_id })}>{b.mk.nama_mk}</button></td>
                  <td data-label="SKS">{b.mk.sks}</td>
                  <td data-label="Mekanisme">{b.mekanisme === 'transfer' ? 'Transfer' : 'Perolehan'}</td>
                  <td data-label="Keputusan"><Lencana warna={KEPUTUSAN[b.keputusan].warna}>{KEPUTUSAN[b.keputusan].label}</Lencana></td>
                  <td className="pm-tebal" data-label="Nilai">{b.pn?.nilai_huruf || '-'}</td>
                  <td className="pm-kecil" data-label="Dinilai oleh">{b.pn?.dinilai_oleh ? (peta.orang[b.pn.dinilai_oleh]?.nama_lengkap || 'Asesor') : '-'}{b.pn?.dinilai_at ? <div>{tanggal(b.pn.dinilai_at)}</div> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kartu>

      <div className="tm-dua">
        <Kartu judul="Tim penilai" padat>
          <ul className="tm-daftar">
            {tim.map((x) => (
              <li key={x.asesor_id} className="tm-baris">
                <span className="pm-grow pm-tebal">{peta.orang[x.asesor_id]?.nama_lengkap || 'Asesor'}</span>
                <Lencana warna={x.peran === 'koordinator' ? 'indigo' : 'slate'}>{PERAN[x.peran]}</Lencana>
              </li>
            ))}
          </ul>
        </Kartu>
        <Kartu judul="Riwayat" padat>
          <ul className="tm-daftar as-log">
            {d.log.filter((x) => !LOG_KEUANGAN.has(x.aksi)).slice(0, 8).map((x) => (
              <li key={x.id} className="tm-baris">
                <span className="pm-grow pm-kecil">{x.catatan || (x.ke_status ? `Status menjadi ${x.ke_status.replace(/_/g, ' ')}` : x.aksi.replace(/_/g, ' '))}</span>
                <span className="pm-kecil">{tanggal(x.created_at, true)}</span>
              </li>
            ))}
          </ul>
        </Kartu>
      </div>

      {bolehNilai && (koordinator || bolehMinta) ? (
        <BarTahap info={tujuan ? (halangan ? <span className="pm-merah">{halangan}</span> : `Siap diajukan ke ${LABEL_TUJUAN[tujuan]}`) : null}>
          {bolehMinta ? <Tombol ikon={FilePlus} onClick={() => buka('bukti')}>Minta bukti tambahan</Tombol> : null}
          {koordinator && tujuan ? <Tombol jenis="primary" ikon={Send} disabled={!!halangan} onClick={() => buka('pleno')}>Ajukan ke {LABEL_TUJUAN[tujuan]}</Tombol> : null}
        </BarTahap>
      ) : null}
      {bolehNilai && !koordinator && tujuan ? <p className="pm-kecil">Pengajuan ke pleno dilakukan oleh asesor koordinator.</p> : null}

      <Dialog buka={!!dialog} judul={dialog === 'pleno' ? `Ajukan ke ${LABEL_TUJUAN[tujuan] || 'pleno'}` : 'Minta bukti tambahan'} onTutup={() => setDialog(null)} lebar={560}
        kaki={<><Tombol onClick={() => setDialog(null)}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk} onClick={kirim}>{dialog === 'pleno' ? 'Ajukan' : 'Kirim permintaan'}</Tombol></>}>
        {dialog === 'pleno' ? (
          <>
            <p>{r.diakui} mata kuliah ({r.sksDiakui} SKS) diakui, {r.baris.length - r.diakui - r.lanjutan} tidak diakui{r.lanjutan ? `, ${r.lanjutan} perlu asesmen lanjutan` : ''}.</p>
            <Pemberitahuan>Setelah diajukan, penilaian terkunci sampai pleno ditetapkan Ketua Tim Pengelola RPL.{tujuan === 'pleno_awal' ? ' Setelah pleno awal, Sekretariat menjadwalkan wawancara.' : ''}</Pemberitahuan>
            <Bidang label="Catatan untuk pleno (opsional)"><textarea className="input" rows={3} value={teks} onChange={(e) => setTeks(e.target.value)} /></Bidang>
          </>
        ) : (
          <>
            <p>Pemohon akan diminta mengunggah bukti tambahan. Selama menunggu, status pengajuan menjadi "Perlu bukti tambahan".</p>
            <Bidang label="Bukti yang diminta" hint="Tulis jelas per mata kuliah agar pemohon tahu apa yang harus diunggah."><textarea className="input" rows={4} value={teks} onChange={(e) => setTeks(e.target.value)} /></Bidang>
          </>
        )}
      </Dialog>
    </div>
  )
}

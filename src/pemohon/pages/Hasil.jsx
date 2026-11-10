import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Check, MessageSquareWarning } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePemohon } from '../PemohonData'
import * as api from '../api'
import { HASIL_TERLIHAT, KEPUTUSAN, tanggal } from '../konstanta'
import { usang } from '../../dokumen/PanelDokumen'
import { BukaBerkas, Dialog, Halaman, Kartu, Kerangka, Lencana, LencanaStatus, Pemberitahuan, Tombol } from '../ui'

export default function Hasil() {
  const { siap, data, pengajuan, muat } = usePemohon()
  const [dialog, setDialog] = useState(null)
  const [setuju, setSetuju] = useState(false)
  const [pilihMk, setPilihMk] = useState({})
  const [alasan, setAlasan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  if (!siap) return <Kerangka />
  if (!pengajuan) return <Navigate to="/pemohon" replace />

  if (!HASIL_TERLIHAT.includes(pengajuan.status)) {
    return (
      <Halaman judul="Hasil rekognisi" sub="Hasil muncul setelah pleno Tim Penilai RPL.">
        <Pemberitahuan judul="Hasil belum tersedia">
          Status pengajuan Anda saat ini <LencanaStatus status={pengajuan.status} />. Anda akan diberi tahu setelah hasil pleno disampaikan.
        </Pemberitahuan>
      </Halaman>
    )
  }

  const baris = data.penilaian.map((p) => ({ ...p, mk: data.mataKuliah.find((m) => m.id === p.mk_id) })).filter((p) => p.mk)
    .sort((a, b) => (a.mk.semester - b.mk.semester) || a.mk.kode_mk.localeCompare(b.mk.kode_mk))
  const diakui = baris.filter((b) => b.keputusan === 'diakui')
  const sksDiakui = diakui.reduce((n, b) => n + b.mk.sks, 0)
  const prodi = data.prodi.find((p) => p.id === pengajuan.prodi_pilihan_id)
  const tidakDiakui = baris.filter((b) => b.keputusan !== 'diakui')
  // Surat hasil lama (terbit sebelum hasil terakhir disampaikan, mis. sebelum sanggahan) tidak ditampilkan.
  const suratHasil = data.dokumen.find((d) => d.jenis_kode === 'SURAT_HASIL' && d.status === 'final' && !usang(d, pengajuan))
  const sk = data.dokumen.find((d) => d.jenis_kode === 'F08' && d.status === 'final')
  const menunggu = pengajuan.status === 'hasil_disampaikan'

  const konfirmasiSetuju = async () => {
    setSibuk(true)
    try {
      await api.ubahStatus(pengajuan.id, 'menunggu_komite')
      await muat()
      setDialog(null)
      toast.success('Hasil disetujui dan diteruskan ke Komite RPL')
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  const kirimSanggahan = async () => {
    const butir = Object.entries(pilihMk).filter(([, v]) => v).map(([mk_id]) => ({ mk_id, alasan: alasan.trim() }))
    setSibuk(true)
    try {
      await api.ajukanKlarifikasi({ pengajuanId: pengajuan.id, butir, alasan: alasan.trim() })
      await muat()
      setDialog(null)
      toast.success('Sanggahan dikirim. Anda dapat menambah bukti pendukung di halaman Bukti portofolio.')
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Halaman judul="Hasil rekognisi"
      sub={pengajuan.hasil_disampaikan_at ? `Disampaikan ${tanggal(pengajuan.hasil_disampaikan_at)}. Hasil belum final sampai disetujui Komite RPL dan ditetapkan dengan SK Ketua.` : null}
      aksi={menunggu ? <>
        <Tombol ikon={MessageSquareWarning} onClick={() => { setPilihMk({}); setAlasan(''); setDialog('sanggah') }}>Ajukan sanggahan</Tombol>
        <Tombol jenis="primary" ikon={Check} onClick={() => { setSetuju(false); setDialog('setuju') }}>Setujui hasil</Tombol>
      </> : null}>

      {menunggu ? (
        <Pemberitahuan jenis="amber" judul="Hasil menunggu tanggapan Anda">
          Setujui bila hasil sudah sesuai. Bila tidak, ajukan sanggahan untuk mata kuliah tertentu disertai alasan dan bukti tambahan.
        </Pemberitahuan>
      ) : pengajuan.status === 'klarifikasi' ? (
        <Pemberitahuan judul="Sanggahan sedang diproses" aksi={<Link className="btn btn-secondary btn-sm" to="/pemohon/pengajuan/bukti">Tambah bukti</Link>}>
          Tim Penilai meninjau sanggahan Anda. Hasil akan disampaikan kembali setelah pleno.
        </Pemberitahuan>
      ) : pengajuan.status === 'selesai' && pengajuan.nim ? (
        <Pemberitahuan jenis="green" judul={`Selamat, Anda resmi menjadi mahasiswa. NIM: ${pengajuan.nim}`}>
          Hasil rekognisi sudah ditetapkan dengan SK Ketua STIKOM Yos Sudarso. Informasi registrasi dan perkuliahan disampaikan oleh BAAK.
        </Pemberitahuan>
      ) : (
        <Pemberitahuan jenis="green" judul="Hasil sudah Anda setujui">
          <LencanaStatus status={pengajuan.status} />{' '}
          {pengajuan.status === 'menunggu_komite' ? 'Menunggu persetujuan Komite RPL.'
            : pengajuan.status === 'dikembalikan_komite' ? 'Komite RPL meminta Tim Pengelola meninjau ulang. Anda akan diberi tahu bila ada perubahan.'
            : pengajuan.status === 'menunggu_sk' ? 'Disetujui Komite RPL, menunggu SK Ketua STIKOM Yos Sudarso.'
            : pengajuan.status === 'sk_terbit' ? 'SK sudah terbit. BAAK sedang menetapkan NIM Anda.' : null}
        </Pemberitahuan>
      )}

      <div className="pm-grid-3">
        <div className="stat-card"><div className="stat-card-label">SKS diakui</div><div className="stat-card-value">{sksDiakui}</div><div className="stat-card-sub">batas {data.batasSks ?? '-'} SKS</div></div>
        <div className="stat-card"><div className="stat-card-label">Mata kuliah diakui</div><div className="stat-card-value">{diakui.length}</div><div className="stat-card-sub">dari {baris.length} yang dinilai</div></div>
        <div className="stat-card"><div className="stat-card-label">Sisa beban studi</div><div className="stat-card-value">{prodi ? Math.max(0, prodi.beban_sks_minimal - sksDiakui) : '-'}</div><div className="stat-card-sub">SKS yang tetap ditempuh</div></div>
      </div>

      <Kartu judul="Rincian per mata kuliah" padat
        aksi={<div className="pm-baris-aksi">{suratHasil ? <BukaBerkas path={suratHasil.file_path} label="Surat hasil" /> : null}{sk ? <BukaBerkas path={sk.file_path} label="SK Ketua" /> : null}</div>}>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr><th style={{ width: 110 }}>Kode</th><th>Mata kuliah</th><th style={{ width: 60 }}>SKS</th><th style={{ width: 110 }}>Mekanisme</th><th style={{ width: 150 }}>Keputusan</th><th style={{ width: 70 }}>Nilai</th><th>Catatan asesor</th></tr></thead>
            <tbody>
              {baris.map((b) => (
                <tr key={b.id}>
                  <td className="pm-kecil" data-label="Kode">{b.mk.kode_mk}</td>
                  <td data-label="Mata kuliah">{b.mk.nama_mk}</td>
                  <td data-label="SKS">{b.mk.sks}</td>
                  <td data-label="Mekanisme">{b.mekanisme === 'transfer' ? 'Transfer' : 'Perolehan'}</td>
                  <td data-label="Keputusan"><Lencana warna={KEPUTUSAN[b.keputusan]?.warna}>{KEPUTUSAN[b.keputusan]?.label || b.keputusan}</Lencana></td>
                  <td className="pm-tebal" data-label="Nilai">{b.keputusan === 'diakui' ? b.nilai_huruf : '-'}</td>
                  <td className="pm-kecil" data-label="Catatan asesor">{b.catatan || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kartu>

      {data.klarifikasi.length ? (
        <Kartu judul="Riwayat sanggahan (F12)" padat>
          <ul className="pm-checklist">
            {data.klarifikasi.map((k) => (
              <li key={k.id} style={{ alignItems: 'flex-start' }}>
                <span className="pm-grow">
                  <span className="pm-tebal">{tanggal(k.created_at)}</span>
                  <span className="pm-kecil"> · {(k.mk_ids || []).map((id) => data.mataKuliah.find((m) => m.id === id)?.nama_mk).filter(Boolean).join(', ')}</span>
                  <div>{k.alasan}</div>
                  {k.tanggapan ? <div className="pm-kecil" style={{ marginTop: 4 }}>Tanggapan tim: {k.tanggapan}</div> : null}
                </span>
                <Lencana warna={k.status === 'selesai' ? 'green' : 'amber'}>{k.status === 'selesai' ? 'Selesai' : 'Diproses'}</Lencana>
              </li>
            ))}
          </ul>
        </Kartu>
      ) : null}

      <Dialog buka={dialog === 'setuju'} judul="Setujui hasil rekognisi?" onTutup={() => setDialog(null)}
        kaki={<><Tombol onClick={() => setDialog(null)}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk} disabled={!setuju} onClick={konfirmasiSetuju}>Setujui dan teruskan</Tombol></>}>
        <p>Hasil akan diteruskan ke Komite RPL untuk persetujuan, lalu ditetapkan dengan SK Ketua STIKOM Yos Sudarso. Setelah disetujui, sanggahan tidak dapat diajukan lagi.</p>
        <label className="pm-centang">
          <input type="checkbox" checked={setuju} onChange={(e) => setSetuju(e.target.checked)} />
          Saya menyetujui pengakuan {sksDiakui} SKS dari {diakui.length} mata kuliah.
        </label>
      </Dialog>

      <Dialog buka={dialog === 'sanggah'} judul="Ajukan sanggahan" onTutup={() => setDialog(null)} lebar={560}
        kaki={<><Tombol onClick={() => setDialog(null)}>Batal</Tombol>
          <Tombol jenis="primary" sibuk={sibuk} disabled={!Object.values(pilihMk).some(Boolean) || alasan.trim().length < 20} onClick={kirimSanggahan}>Kirim sanggahan</Tombol></>}>
        <fieldset className="pm-fieldset">
          <legend className="input-label">Mata kuliah yang disanggah</legend>
          {(tidakDiakui.length ? tidakDiakui : baris).map((b) => (
            <label key={b.mk_id} className="pm-centang">
              <input type="checkbox" checked={!!pilihMk[b.mk_id]} onChange={(e) => setPilihMk((s) => ({ ...s, [b.mk_id]: e.target.checked }))} />
              {b.mk.nama_mk} <span className="pm-kecil">({KEPUTUSAN[b.keputusan]?.label})</span>
            </label>
          ))}
        </fieldset>
        <label className="input-group">
          <span className="input-label">Alasan sanggahan</span>
          <textarea className="input" rows={4} value={alasan} onChange={(e) => setAlasan(e.target.value)}
            placeholder="Jelaskan mengapa menurut Anda kemampuan pada mata kuliah tersebut sudah terpenuhi." />
          <span className="pm-hint">Minimal 20 karakter. Setelah dikirim, Anda dapat menambah bukti pendukung di halaman Bukti portofolio.</span>
        </label>
      </Dialog>
    </Halaman>
  )
}

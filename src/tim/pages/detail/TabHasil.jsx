// Hasil rekognisi, sanggahan pemohon (F12), dan tindak lanjut pengembalian Komite.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { RotateCcw, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTim } from '../../TimData'
import * as api from '../../api'
import { tanggal } from '../../../pemohon/konstanta'
import { BarTahap, Bidang, Dialog, Kartu, Lencana, Pemberitahuan, PilihSegmen, Tombol } from '../../../pemohon/ui'

export const STATUS_HASIL = ['hasil_disampaikan', 'klarifikasi', 'menunggu_komite', 'dikembalikan_komite', 'menunggu_sk', 'sk_terbit', 'selesai']
const KEP = [{ v: 'diterima', l: 'Diterima' }, { v: 'diterima_sebagian', l: 'Diterima sebagian' }, { v: 'ditolak', l: 'Ditolak' }]
const LABEL_KEP = { diterima: 'Diterima', diterima_sebagian: 'Diterima sebagian', ditolak: 'Ditolak' }

function Sanggahan({ k, p, d, boleh }) {
  const { muat } = useTim()
  const [kep, setKep] = useState('')
  const [teks, setTeks] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const mk = (k.mk_ids || []).map((id) => d.mataKuliah.find((m) => m.id === id)?.nama_mk).filter(Boolean)
  const kirim = async () => {
    if (!kep || !teks.trim()) { toast.error('Pilih keputusan dan tulis tanggapan'); return }
    setSibuk(true)
    try {
      await api.tanggapiSanggahan(k.id, kep, teks.trim())
      toast.success(kep === 'ditolak' ? 'Sanggahan ditolak. Pemohon diminta menanggapi hasil kembali.' : 'Sanggahan diterima. Asesor dapat menilai ulang.')
      await muat()
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }
  const terbuka = k.status === 'diajukan' && p.status === 'klarifikasi'
  return (
    <li className="tm-hasil-sanggah">
      <div className="pm-baris-aksi">
        <span className="pm-tebal pm-grow">{tanggal(k.created_at, true)}</span>
        {k.keputusan ? <Lencana warna={k.keputusan === 'ditolak' ? 'red' : 'green'}>{LABEL_KEP[k.keputusan]}</Lencana> : <Lencana warna="amber">Belum ditanggapi</Lencana>}
      </div>
      <div className="pm-kecil">Mata kuliah: {mk.join(', ') || '-'}{(k.bukti_nomor || []).length ? ` · bukti nomor ${k.bukti_nomor.join(', ')}` : ''}</div>
      <p style={{ margin: '6px 0' }}>{k.alasan}</p>
      {k.tanggapan ? <p className="pm-kecil"><b>Tanggapan:</b> {k.tanggapan}</p> : null}
      {terbuka && boleh ? (
        <div className="pm-tumpuk-besar" style={{ marginTop: 8 }}>
          <Bidang label="Keputusan"><PilihSegmen pilihan={KEP} nilai={kep} onUbah={setKep} label="Keputusan sanggahan" /></Bidang>
          <Bidang label="Tanggapan untuk pemohon" hint={kep === 'ditolak' ? 'Hasil tetap. Pemohon diminta menyetujui hasil.' : kep ? 'Asesor menilai ulang mata kuliah yang disanggah, lalu mengajukan ke pleno hasil.' : null}>
            <textarea className="input" rows={3} value={teks} onChange={(e) => setTeks(e.target.value)} />
          </Bidang>
          <div><Tombol jenis="primary" sibuk={sibuk} onClick={kirim}>Kirim tanggapan</Tombol></div>
        </div>
      ) : null}
      {terbuka && !boleh ? <p className="pm-kecil">Sanggahan ditanggapi oleh Ketua Tim.</p> : null}
    </li>
  )
}

export default function TabHasil({ p, d }) {
  const { role, muat } = useTim()
  const [dialog, setDialog] = useState(null)
  const [catatan, setCatatan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const boleh = ['admin', 'ketua_tim'].includes(role)
  const baris = d.mkDiajukan.map((m) => ({ ...m, mk: d.mataKuliah.find((x) => x.id === m.mk_id), pn: d.penilaianMk.find((x) => x.mk_id === m.mk_id) })).filter((b) => b.mk)
  const diakui = baris.filter((b) => b.pn?.keputusan === 'diakui')
  const sks = diakui.reduce((n, b) => n + b.mk.sks, 0)

  const tindakLanjut = async () => {
    setSibuk(true)
    try {
      await api.tindakLanjutKomite(p.id, dialog, catatan.trim())
      toast.success(dialog === 'menunggu_komite' ? 'Dikirim ulang ke Komite' : 'Asesor diminta menilai ulang')
      setDialog(null)
      await muat()
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <div className="pm-tumpuk-besar">
      {p.status === 'dikembalikan_komite' ? (
        <Pemberitahuan jenis="amber" judul="Dikembalikan Komite RPL">{p.catatan_revisi || d.komite[0]?.catatan || '-'}</Pemberitahuan>
      ) : null}
      {p.status === 'hasil_disampaikan' ? <Pemberitahuan>Menunggu tanggapan pemohon: menyetujui hasil atau mengajukan sanggahan.</Pemberitahuan> : null}
      {['menunggu_komite', 'menunggu_sk', 'sk_terbit', 'selesai'].includes(p.status) ? (
        <Pemberitahuan jenis="green" judul="Hasil disetujui pemohon">
          {p.status === 'menunggu_komite' ? 'Menunggu persetujuan Komite RPL.' : p.status === 'menunggu_sk' ? 'Disetujui Komite, menunggu SK.' : p.status === 'sk_terbit' ? 'SK terbit, menunggu NIM dari BAAK.' : `Selesai. NIM ${p.nim || '-'}.`}
          {' '}<Link to="/pimpinan">Buka Komite, SK, dan NIM</Link>
        </Pemberitahuan>
      ) : null}

      <Kartu judul="Hasil rekognisi" sub={`${sks} SKS diakui dari ${diakui.length} mata kuliah`} padat>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr><th style={{ width: 110 }}>Kode</th><th>Mata kuliah</th><th style={{ width: 56 }}>SKS</th><th style={{ width: 110 }}>Mekanisme</th><th style={{ width: 130 }}>Keputusan</th><th style={{ width: 64 }}>Nilai</th></tr></thead>
            <tbody>
              {baris.map((b) => (
                <tr key={b.mk_id}>
                  <td className="pm-kecil" data-label="Kode">{b.mk.kode_mk}</td><td data-label="Mata kuliah">{b.mk.nama_mk}</td><td data-label="SKS">{b.mk.sks}</td>
                  <td data-label="Mekanisme">{b.mekanisme === 'transfer' ? 'Transfer' : 'Perolehan'}</td>
                  <td data-label="Keputusan">{b.pn?.keputusan === 'diakui' ? <Lencana warna="green">Diakui</Lencana> : b.pn?.keputusan === 'tidak_diakui' ? <Lencana warna="red">Tidak diakui</Lencana> : <Lencana>{(b.pn?.keputusan || 'belum dinilai').replace(/_/g, ' ')}</Lencana>}</td>
                  <td className="pm-tebal" data-label="Nilai">{b.pn?.nilai_huruf || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kartu>

      <Kartu judul="Sanggahan pemohon (F12)" padat>
        {d.klarifikasi.length ? <ul className="tm-daftar">{d.klarifikasi.map((k) => <Sanggahan key={k.id} k={k} p={p} d={d} boleh={boleh} />)}</ul>
          : <p className="pm-kosong">Tidak ada sanggahan.</p>}
      </Kartu>

      {d.komite.length ? (
        <Kartu judul="Keputusan Komite RPL" padat>
          <ul className="tm-daftar">
            {d.komite.map((x) => (
              <li key={x.id} className="tm-baris">
                <Lencana warna={x.keputusan === 'disetujui' ? 'green' : 'amber'}>{x.keputusan === 'disetujui' ? 'Disetujui' : 'Dikembalikan'}</Lencana>
                <span className="pm-grow pm-kecil">{x.catatan || '-'}</span><span className="pm-kecil">{tanggal(x.created_at, true)}</span>
              </li>
            ))}
          </ul>
        </Kartu>
      ) : null}

      {p.status === 'dikembalikan_komite' && boleh ? (
        <BarTahap info="Tindak lanjuti catatan Komite">
          <Tombol ikon={RotateCcw} onClick={() => { setCatatan(''); setDialog('klarifikasi') }}>Minta asesor menilai ulang</Tombol>
          <Tombol jenis="primary" ikon={Send} onClick={() => { setCatatan(''); setDialog('menunggu_komite') }}>Kirim ulang ke Komite</Tombol>
        </BarTahap>
      ) : null}
      <Dialog buka={!!dialog} judul={dialog === 'klarifikasi' ? 'Minta asesor menilai ulang' : 'Kirim ulang ke Komite'} onTutup={() => setDialog(null)}
        kaki={<><Tombol onClick={() => setDialog(null)}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk} onClick={tindakLanjut}>Kirim</Tombol></>}>
        <p>{dialog === 'klarifikasi' ? 'Penilaian dibuka kembali untuk asesor. Setelah dinilai ulang, asesor koordinator mengajukan ke pleno hasil.' : 'Pengajuan dikirim kembali ke Komite RPL tanpa perubahan hasil.'}</p>
        <Bidang label="Catatan (opsional)"><textarea className="input" rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} /></Bidang>
      </Dialog>
    </div>
  )
}

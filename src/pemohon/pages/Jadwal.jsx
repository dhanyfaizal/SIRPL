import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Check, Video } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePemohon } from '../PemohonData'
import * as api from '../api'
import { tanggal } from '../konstanta'
import { Halaman, Kartu, Kerangka, Lencana, Pemberitahuan, Tombol } from '../ui'

const JENIS = { wawancara: 'Wawancara', tulis: 'Uji tulis', praktik: 'Unjuk kerja / praktik', presentasi: 'Presentasi', observasi: 'Observasi', tugas: 'Tugas terstruktur' }
const STATUS_J = {
  dijadwalkan: { l: 'Dijadwalkan', w: 'indigo' }, selesai: { l: 'Selesai', w: 'green' }, tidak_hadir: { l: 'Tidak hadir', w: 'red' },
  dijadwalkan_ulang: { l: 'Dijadwalkan ulang', w: 'amber' }, dibatalkan: { l: 'Dibatalkan', w: 'slate' },
}

function useSekarang() {
  const [t, setT] = useState(() => Date.now())
  useEffect(() => { const i = setInterval(() => setT(Date.now()), 30000); return () => clearInterval(i) }, [])
  return t
}

export default function Jadwal() {
  const { siap, data, pengajuan, ubah } = usePemohon()
  const [sibuk, setSibuk] = useState(null)
  const sekarang = useSekarang()
  if (!siap) return <Kerangka />
  if (!pengajuan) return <Navigate to="/pemohon" replace />

  const wajibWawancara = ['perolehan', 'gabungan'].includes(pengajuan.jenis_rpl)
  const namaMk = (ids) => (ids || []).map((id) => data.mataKuliah.find((m) => m.id === id)?.nama_mk).filter(Boolean).join(', ')

  const konfirmasi = async (j) => {
    setSibuk(j.id)
    try {
      await api.konfirmasiHadir(j.id)
      ubah((d) => ({ jadwal: d.jadwal.map((x) => (x.id === j.id ? { ...x, konfirmasi_hadir_at: new Date().toISOString() } : x)) }))
      toast.success('Kehadiran dikonfirmasi')
    } catch (e) { toast.error(e.message) } finally { setSibuk(null) }
  }

  return (
    <Halaman judul="Jadwal asesmen" sub="Wawancara dan asesmen lanjutan yang dijadwalkan asesor. Untuk asesmen daring, tombol Gabung membuka tautan video call di tab baru.">
      {wajibWawancara ? (
        <Pemberitahuan>Pemohon perolehan kredit wajib mengikuti wawancara untuk setiap mata kuliah yang diajukan. Ketidakhadiran dapat menunda pleno hasil.</Pemberitahuan>
      ) : null}
      {data.jadwal.length ? data.jadwal.map((j) => {
        const mulai = new Date(j.waktu).getTime()
        const akhir = mulai + (j.durasi_menit || 60) * 60000
        const bisaGabung = j.status === 'dijadwalkan' && j.mode === 'daring' && sekarang >= mulai - 30 * 60000 && sekarang <= akhir + 30 * 60000
        const tautan = j.tautan_undangan || (j.mode === 'daring' ? j.tempat_atau_tautan : null)
        const s = STATUS_J[j.status] || { l: j.status, w: 'slate' }
        return (
          <Kartu key={j.id} judul={`${JENIS[j.jenis] || j.jenis} · ${j.mode === 'daring' ? 'Daring' : 'Luring'}`}
            sub={tanggal(j.waktu, true) + (j.durasi_menit ? ` · ${j.durasi_menit} menit` : '')}
            aksi={<Lencana warna={s.w}>{s.l}</Lencana>}>
            <dl className="pm-dl">
              <dt>Mata kuliah</dt><dd>{namaMk(j.mk_ids) || '-'}</dd>
              <dt>{j.mode === 'daring' ? 'Tautan' : 'Ruangan'}</dt>
              <dd>{j.mode === 'daring' ? (tautan ? <span className="pm-kecil">{tautan}</span> : '-') : (j.ruangan || j.tempat_atau_tautan || '-')}</dd>
              {j.konfirmasi_hadir_at ? <><dt>Konfirmasi</dt><dd>Anda mengonfirmasi hadir {tanggal(j.konfirmasi_hadir_at, true)}</dd></> : null}
            </dl>
            {j.status === 'dijadwalkan' ? (
              <div className="pm-baris-aksi" style={{ marginTop: 14 }}>
                {!j.konfirmasi_hadir_at ? <Tombol ikon={Check} sibuk={sibuk === j.id} onClick={() => konfirmasi(j)}>Konfirmasi hadir</Tombol> : null}
                {j.mode === 'daring' && tautan ? (
                  bisaGabung
                    ? <a className="btn btn-primary" href={tautan} target="_blank" rel="noreferrer"><Video size={14} /> Gabung wawancara</a>
                    : <span className="pm-kecil">Tombol Gabung aktif 30 menit sebelum jadwal.</span>
                ) : null}
              </div>
            ) : null}
          </Kartu>
        )
      }) : (
        <Kartu><p className="pm-kosong">Belum ada jadwal. Jadwal muncul di sini setelah asesor menjadwalkan wawancara atau asesmen lanjutan.</p></Kartu>
      )}
    </Halaman>
  )
}

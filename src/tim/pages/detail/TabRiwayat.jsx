import { useTim } from '../../TimData'
import { STATUS, tanggal } from '../../../pemohon/konstanta'
import { Kartu } from '../../../pemohon/ui'

const AKSI = {
  tugaskan_asesor: 'Asesor ditugaskan', cabut_asesor: 'Penugasan asesor dicabut',
  jadwal_dijadwalkan: 'Jadwal dibuat atau diubah', jadwal_selesai: 'Jadwal selesai', jadwal_tidak_hadir: 'Pemohon tidak hadir',
  jadwal_dibatalkan: 'Jadwal dibatalkan', jadwal_dijadwalkan_ulang: 'Jadwal dijadwalkan ulang',
}

export default function TabRiwayat({ p, d }) {
  const { peta } = useTim()
  const aktor = (id) => peta.staf[id]?.nama_lengkap || (id === p.user_id ? (peta.pemohon[id]?.nama_lengkap || 'Pemohon') : id ? 'Pengguna' : 'Sistem')
  return (
    <Kartu judul="Riwayat aktivitas" sub="Jejak audit untuk LPMP (Pedoman 5.7)" padat>
      {d.log.length ? (
        <ol className="tm-linimasa">
          {d.log.map((l) => (
            <li key={l.id}>
              <div className="pm-tebal">
                {l.aksi === 'ubah_status' ? `Status: ${STATUS[l.dari_status]?.label || l.dari_status || '-'} ke ${STATUS[l.ke_status]?.label || l.ke_status}` : AKSI[l.aksi] || l.aksi}
              </div>
              {l.catatan ? <div className="pm-kecil tm-pre">{l.catatan}</div> : null}
              <div className="pm-kecil">{tanggal(l.created_at, true)} · {aktor(l.aktor_id)}</div>
            </li>
          ))}
        </ol>
      ) : <p className="pm-kosong">Belum ada aktivitas.</p>}
    </Kartu>
  )
}

// Log aktivitas pengajuan dan tindakan admin.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAdmin, cek } from '../AdminData'
import { LABEL_AKSI_LOG, LABEL_PERAN, PELAPORAN } from '../aturan'
import { kelompokDari } from '../../tim/aturan'
import { STATUS, tanggal } from '../../pemohon/konstanta'
import { Halaman, Kerangka, Lencana, Pemberitahuan, PilihSegmen } from '../../pemohon/ui'

const BATAS = 300
let simpanan = null

function ringkasAdmin(l, peta) {
  const r = l.rincian || {}
  if (l.aksi === 'atur_pengguna') {
    const beda = []
    if (r.dari?.role !== r.ke?.role) beda.push(`peran ${LABEL_PERAN[r.dari?.role] || r.dari?.role} → ${LABEL_PERAN[r.ke?.role] || r.ke?.role}`)
    if (r.dari?.is_verified !== r.ke?.is_verified) beda.push(r.ke?.is_verified ? 'diverifikasi' : 'dinonaktifkan')
    if (r.dari?.prodi_id !== r.ke?.prodi_id) beda.push(`prodi ${peta.prodi[r.ke?.prodi_id]?.nama || '-'}`)
    if (r.dari?.nama !== r.ke?.nama) beda.push(`nama "${r.ke?.nama}"`)
    return beda.join(', ') || 'tanpa perubahan'
  }
  if (l.aksi === 'batalkan_pengajuan') return `dari ${STATUS[r.dari_status]?.label || r.dari_status}: ${r.alasan}`
  if (l.aksi === 'ubah_prodi') return Object.entries(r).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v?.dari ?? '-'} → ${v?.ke ?? '-'}`).join('; ')
  return ''
}

export default function Log() {
  const { siap, peta, data } = useAdmin()
  const [jenis, setJenis] = useState('pengajuan')
  const [log, setLog] = useState(simpanan)
  const [galat, setGalat] = useState(null)
  const [cari, setCari] = useState('')

  useEffect(() => {
    let batal = false
    Promise.all([
      supabase.from('log_aktivitas_rpl').select('*').order('created_at', { ascending: false }).limit(BATAS).then(cek),
      supabase.from('log_admin').select('*').order('created_at', { ascending: false }).limit(BATAS).then(cek),
    ]).then(([pengajuan, admin]) => { if (!batal) { simpanan = { pengajuan, admin }; setLog(simpanan) } })
      .catch((e) => { if (!batal) setGalat(e.message) })
    return () => { batal = true }
  }, [])

  const pgj = useMemo(() => Object.fromEntries((data?.pengajuan || []).map((p) => [p.id, p])), [data])
  const baris = useMemo(() => {
    if (!log || !siap) return []
    const q = cari.trim().toLowerCase()
    const daftar = jenis === 'pengajuan'
      ? log.pengajuan.map((l) => {
        const p = pgj[l.pengajuan_id]
        const pelapor = l.aksi === 'status_pelaporan' ? (l.catatan || '').split(' -> ').map((v) => PELAPORAN.find((x) => x.v === v)?.l || v).join(' → ') : null
        return { id: `p${l.id}`, waktu: l.created_at, aktor: peta.orang[l.aktor_id], aksi: LABEL_AKSI_LOG[l.aksi] || l.aksi.replace(/_/g, ' '), p,
          isi: l.aksi === 'ubah_status' ? `${STATUS[l.dari_status]?.label || l.dari_status || '-'} → ${STATUS[l.ke_status]?.label || l.ke_status}` : pelapor || '',
          catatan: l.aksi === 'status_pelaporan' ? '' : l.catatan }
      })
      : log.admin.map((l) => ({ id: `a${l.id}`, waktu: l.created_at, aktor: peta.orang[l.aktor_id], aksi: LABEL_AKSI_LOG[l.aksi] || l.aksi, sasaran: l.sasaran, isi: ringkasAdmin(l, peta) }))
    if (!q) return daftar
    return daftar.filter((b) => [b.aktor?.nama_lengkap, b.aktor?.email, b.aksi, b.isi, b.catatan, b.sasaran, b.p?.nomor_pendaftaran, peta.orang[b.p?.user_id]?.nama_lengkap]
      .some((v) => (v || '').toLowerCase().includes(q)))
  }, [log, jenis, cari, pgj, peta, siap])

  if (galat) return <Halaman judul="Log aktivitas"><Pemberitahuan jenis="red" judul="Log tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!log || !siap) return <Kerangka />

  return (
    <Halaman judul="Log aktivitas" sub={`${BATAS} catatan terbaru. Setiap perubahan status pengajuan dan tindakan admin tercatat otomatis.`}>
      <section className="card">
        <div className="pm-mk-alat">
          <div className="pm-baris-aksi">
            <PilihSegmen pilihan={[{ v: 'pengajuan', l: 'Pengajuan' }, { v: 'admin', l: 'Tindakan admin' }]} nilai={jenis} onUbah={setJenis} label="Jenis log" />
            <div className="pm-input-ikon pm-cari">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input className="input" type="search" placeholder="Cari pelaku, pemohon, atau isi" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari log" />
            </div>
          </div>
          <span className="pm-kecil">{baris.length} catatan</span>
        </div>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr><th style={{ width: 150 }}>Waktu</th><th style={{ width: 200 }}>Pelaku</th><th style={{ width: 170 }}>Aksi</th><th>{jenis === 'pengajuan' ? 'Pengajuan dan perubahan' : 'Sasaran dan rincian'}</th></tr></thead>
            <tbody>
              {baris.map((b) => (
                <tr key={b.id}>
                  <td data-label="Waktu" className="pm-kecil">{tanggal(b.waktu, true)}</td>
                  <td data-label="Pelaku">{b.aktor ? <><div>{b.aktor.nama_lengkap || b.aktor.email}</div><div className="pm-kecil">{LABEL_PERAN[b.aktor.role] || b.aktor.role}</div></> : <span className="pm-kecil">Sistem</span>}</td>
                  <td data-label="Aksi"><Lencana warna={b.aksi === 'Batalkan pengajuan' ? 'red' : 'slate'}>{b.aksi}</Lencana></td>
                  <td data-label="Rincian">
                    {jenis === 'pengajuan' ? (
                      b.p ? <Link to={`/tim/antrean/${kelompokDari(b.p.status)}/${b.p.id}`} className="pm-tebal">{peta.orang[b.p.user_id]?.nama_lengkap || 'Pemohon'} · {b.p.nomor_pendaftaran}</Link> : <span className="pm-kecil">Pengajuan tidak tersedia</span>
                    ) : <span className="pm-tebal">{b.sasaran}</span>}
                    {b.isi ? <div className="pm-kecil">{b.isi}</div> : null}
                    {b.catatan ? <div className="pm-kecil ad-catatan">{b.catatan}</div> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!baris.length ? <p className="pm-kosong">Belum ada catatan.</p> : null}
        </div>
      </section>
    </Halaman>
  )
}

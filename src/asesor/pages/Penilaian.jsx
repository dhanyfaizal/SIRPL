import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Mail, Phone } from 'lucide-react'
import { useAsesor } from '../AsesorData'
import { BISA_DINILAI, KELOMPOK, PERAN, ringkasPenilaian } from '../aturan'
import { JENIS_RPL, tanggal } from '../../pemohon/konstanta'
import { Halaman, Kerangka, Lencana, LencanaStatus, Pemberitahuan } from '../../pemohon/ui'
import TabBerkas from './penilaian/TabBerkas'
import TabTransfer from './penilaian/TabTransfer'
import TabPerolehan from './penilaian/TabPerolehan'
import TabLanjutan from './penilaian/TabLanjutan'
import TabRingkasan from './penilaian/TabRingkasan'

// Status 'klarifikasi' dipakai untuk dua hal: sanggahan pemohon dan penilaian ulang
// atas permintaan Komite. Bila yang terakhir terjadi adalah tindak lanjut Ketua Tim
// "Asesor diminta menilai ulang", tampilkan alasan Komite dan catatan Tim.
function PenilaianUlangKomite({ p }) {
  const [info, setInfo] = useState(null)
  useEffect(() => {
    let batal = false
    Promise.all([
      supabase.from('log_aktivitas_rpl').select('catatan, created_at').eq('pengajuan_id', p.id).eq('aksi', 'tindak_lanjut_komite')
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('persetujuan_komite').select('catatan, created_at').eq('pengajuan_id', p.id).eq('keputusan', 'dikembalikan')
        .order('created_at', { ascending: false }).limit(1),
      supabase.from('klarifikasi_rpl').select('created_at').eq('pengajuan_id', p.id).order('created_at', { ascending: false }).limit(1),
    ]).then(([tl, km, sg]) => {
      if (batal) return
      const t = tl.data?.[0]; const k = km.data?.[0]; const s = sg.data?.[0]
      const ulang = t && /^Asesor diminta menilai ulang/.test(t.catatan || '') && (!s || s.created_at < t.created_at)
      setInfo(ulang ? { komite: k?.catatan, tim: (t.catatan || '').replace(/^Asesor diminta menilai ulang:?\s*/, '') } : null)
    })
    return () => { batal = true }
  }, [p.id])
  if (!info) return null
  return (
    <Pemberitahuan jenis="amber" judul="Dinilai ulang atas permintaan Komite RPL">
      {info.komite ? <div><b>Catatan Komite:</b> {info.komite}</div> : null}
      {info.tim ? <div><b>Catatan Ketua Tim:</b> {info.tim}</div> : null}
      <div className="pm-kecil" style={{ marginTop: 6 }}>Perbarui penilaian mata kuliah yang dimaksud, lalu ajukan kembali ke pleno hasil.</div>
    </Pemberitahuan>
  )
}

export default function Penilaian() {
  const { kelompok = 'semua', id } = useParams()
  const [param, setParam] = useSearchParams()
  const { siap, data, detail, muatDetail, peta, tugasSaya, role } = useAsesor()
  const p = data?.pengajuan.find((x) => x.id === id)
  const d = p ? detail[p.id] : null

  useEffect(() => { if (p) muatDetail(p) }, [p?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const statusAwal = useRef(p?.status)
  useEffect(() => {
    if (p && statusAwal.current !== p.status) { statusAwal.current = p.status; muatDetail(p, true) }
  }, [p?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!siap) return <Kerangka />
  const kembali = `/asesor/tugas/${kelompok}`
  const labelKembali = KELOMPOK.find((k) => k.id === kelompok)?.label || 'Semua tugas'
  if (!p) {
    return (
      <Halaman judul="Pengajuan tidak ditemukan">
        <Pemberitahuan jenis="amber">Pengajuan ini tidak ada atau tidak ditugaskan kepada Anda. <Link to={kembali}>Kembali ke daftar</Link></Pemberitahuan>
      </Halaman>
    )
  }

  const tugas = tugasSaya(p.id)
  const admin = role === 'admin'
  const ctx = {
    p, d,
    bolehNilai: (!!tugas || admin) && BISA_DINILAI.includes(p.status),
    koordinator: tugas?.peran === 'koordinator' || admin,
    tugas,
  }
  const mk = data.mkDiajukan.filter((m) => m.pengajuan_id === p.id)
  const adaTransfer = mk.some((m) => m.mekanisme === 'transfer')
  const adaPerolehan = mk.some((m) => m.mekanisme === 'perolehan')
  const nJadwal = data.jadwal.filter((j) => j.pengajuan_id === p.id).length
  const TAB = [
    { id: 'berkas', label: 'Berkas pemohon' },
    adaTransfer ? { id: 'transfer', label: 'Transfer kredit' } : null,
    adaPerolehan ? { id: 'perolehan', label: 'Perolehan kredit (F03)' } : null,
    adaPerolehan || nJadwal ? { id: 'lanjutan', label: 'Penilaian lanjutan (F10)' } : null,
    { id: 'ringkasan', label: 'Ringkasan dan pleno' },
  ].filter(Boolean)
  const awal = adaTransfer ? 'transfer' : adaPerolehan ? 'perolehan' : 'berkas'
  const tab = TAB.some((t) => t.id === param.get('tab')) ? param.get('tab') : awal
  const pilih = (t, tambahan) => setParam(t === awal && !tambahan ? {} : { tab: t, ...(tambahan || {}) })

  const r = ringkasPenilaian(mk, data.penilaian.filter((x) => x.pengajuan_id === p.id), d?.mataKuliah || [])
  const hit = (mek) => {
    const baris = mk.filter((m) => m.mekanisme === mek)
    const sudah = baris.filter((m) => data.penilaian.some((x) => x.pengajuan_id === p.id && x.mk_id === m.mk_id && x.keputusan !== 'belum_dinilai')).length
    return `${sudah}/${baris.length}`
  }
  const lencana = { transfer: hit('transfer'), perolehan: hit('perolehan'), lanjutan: nJadwal || null }
  const u = peta.orang[p.user_id]

  return (
    <Halaman
      judul={u?.nama_lengkap || u?.email || 'Pemohon'}
      sub={<>{p.nomor_pendaftaran} · {peta.prodi[p.prodi_pilihan_id]?.nama} · {JENIS_RPL[p.jenis_rpl]?.label}{p.submitted_at ? ` · diajukan ${tanggal(p.submitted_at)}` : ''}</>}
      aksi={<Link to={kembali} className="btn btn-secondary"><ArrowLeft size={14} /> {labelKembali}</Link>}>
      <div className="tm-kepala-info">
        <LencanaStatus status={p.status} />
        {tugas ? <Lencana warna={tugas.peran === 'koordinator' ? 'indigo' : 'slate'}>{PERAN[tugas.peran]}</Lencana> : <Lencana>Hanya melihat</Lencana>}
        {d?.mataKuliah ? <span className="pm-kecil">{r.sksDiakui} SKS diakui dari {r.sksDiajukan} SKS diajukan</span> : null}
        {u?.email ? <a className="tm-kontak" href={`mailto:${u.email}`}><Mail size={13} aria-hidden="true" /> {u.email}</a> : null}
        {u?.no_whatsapp ? <a className="tm-kontak" href={`https://wa.me/${u.no_whatsapp.replace(/\D/g, '').replace(/^0/, '62')}`} target="_blank" rel="noreferrer"><Phone size={13} aria-hidden="true" /> {u.no_whatsapp}</a> : null}
      </div>
      {!ctx.bolehNilai && tugas && !BISA_DINILAI.includes(p.status) ? (
        <Pemberitahuan jenis={['pleno_awal', 'pleno'].includes(p.status) ? 'indigo' : 'slate'} judul="Mode baca">
          {p.status === 'terverifikasi' ? 'Penilaian dapat diisi setelah Ketua Tim memulai asesmen.'
            : ['pleno_awal', 'pleno'].includes(p.status) ? 'Pengajuan sedang menunggu pleno. Penilaian terbuka kembali setelah pleno awal ditetapkan atau bila ada sanggahan.'
            : 'Hasil sudah ditetapkan. Penilaian tidak dapat diubah.'}
        </Pemberitahuan>
      ) : null}
      {p.status === 'menunggu_bukti_tambahan' ? (
        <Pemberitahuan jenis="amber" judul="Menunggu bukti tambahan dari pemohon">{p.catatan_revisi}</Pemberitahuan>
      ) : null}
      {p.status === 'klarifikasi' ? <PenilaianUlangKomite p={p} /> : null}

      <section className="card tm-tab-kartu">
        <div className="pm-tabs" role="tablist" aria-label="Bagian penilaian">
          {TAB.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-on' : ''} onClick={() => pilih(t.id)}>
              {t.label}{lencana[t.id] ? <span className="pm-hit">{lencana[t.id]}</span> : null}
            </button>
          ))}
        </div>
      </section>

      {!d || (d.memuat && !d.mkDiajukan) ? <Kerangka baris={3} />
        : d.galat && !d.mkDiajukan ? <Pemberitahuan jenis="red" judul="Detail tidak dapat dimuat">{d.galat}</Pemberitahuan>
        : tab === 'berkas' ? <TabBerkas {...ctx} />
        : tab === 'transfer' ? <TabTransfer {...ctx} />
        : tab === 'perolehan' ? <TabPerolehan {...ctx} />
        : tab === 'lanjutan' ? <TabLanjutan {...ctx} />
        : <TabRingkasan {...ctx} keTab={pilih} />}
    </Halaman>
  )
}

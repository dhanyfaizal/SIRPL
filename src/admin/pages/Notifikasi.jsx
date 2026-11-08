// Notifikasi WhatsApp: pengaturan, jenis pesan, dan antrean pengiriman.
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, RotateCcw, Save, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAdmin, cek } from '../AdminData'
import { tanggal } from '../../pemohon/konstanta'
import { Bidang, Halaman, Kartu, Kerangka, Lencana, Pemberitahuan, PilihSegmen, Tombol } from '../../pemohon/ui'

const JENIS = [
  { grup: 'Untuk pemohon', daftar: [
    ['pengajuan_diterima', 'Pengajuan diterima'], ['berkas_dikembalikan', 'Berkas dikembalikan untuk perbaikan'], ['berkas_terverifikasi', 'Berkas terverifikasi'],
    ['tidak_memenuhi', 'Tidak memenuhi syarat'], ['bukti_tambahan', 'Permintaan bukti tambahan'], ['penilaian_lanjutan', 'Masuk penilaian lanjutan'],
    ['jadwal_baru', 'Jadwal wawancara/uji baru'], ['jadwal_ubah', 'Perubahan jadwal'], ['jadwal_batal', 'Jadwal dibatalkan'], ['hasil_rpl', 'Hasil asesmen tersedia'],
    ['sk_terbit', 'SK terbit'], ['nim_terbit', 'NIM ditetapkan'], ['bayar_lunas', 'Pembayaran lunas'], ['bayar_ditolak', 'Bukti bayar ditolak'],
  ] },
  { grup: 'Untuk staf', daftar: [
    ['berkas_masuk', 'BAAK: pengajuan baru'], ['perlu_asesor', 'Ketua Tim: perlu penugasan asesor'], ['tugas_asesor', 'Asesor: penugasan baru'],
    ['jadwal_asesor', 'Asesor: jadwal wawancara/uji'], ['siap_pleno', 'Tim: siap pleno'], ['perlu_komite', 'Komite: menunggu keputusan'],
    ['dikembalikan_komite', 'Ketua Tim: dikembalikan Komite'], ['perlu_nim', 'BAAK: SK terbit, tetapkan NIM'], ['bukti_bayar', 'PMB: bukti bayar baru'],
    ['tanda_tangan', 'Penandatangan: dokumen menunggu tanda tangan'],
  ] },
]
const LABEL = Object.fromEntries(JENIS.flatMap((g) => g.daftar).concat([['uji', 'Pesan uji']]))
const STATUS = { menunggu: ['Menunggu', 'amber'], diproses: ['Diproses', 'indigo'], terkirim: ['Terkirim', 'green'], gagal: ['Gagal', 'red'], dilewati: ['Dilewati', 'slate'] }
let simpanan = null

export default function Notifikasi() {
  const { siap, data } = useAdmin()
  const [atur, setAtur] = useState(simpanan?.atur || null)
  const [antrean, setAntrean] = useState(simpanan?.antrean || null)
  const [saring, setSaring] = useState('semua')
  const [sibuk, setSibuk] = useState(null)
  const [galat, setGalat] = useState(null)

  const muat = useCallback(async () => {
    try {
      const [a, q] = await Promise.all([
        supabase.from('pengaturan_notifikasi').select('*').eq('id', 1).maybeSingle().then(cek),
        supabase.from('antrean_notifikasi').select('*').order('id', { ascending: false }).limit(150).then(cek),
      ])
      simpanan = { atur: a, antrean: q || [] }
      setAtur(a); setAntrean(q || [])
    } catch (e) { setGalat(e.message) }
  }, [])
  useEffect(() => { muat() }, [muat])

  if (galat) return <Halaman judul="Notifikasi WhatsApp"><Pemberitahuan jenis="red" judul="Pengaturan notifikasi tidak dapat dimuat">{galat}. Pastikan migrasi notifikasi sudah dijalankan.</Pemberitahuan></Halaman>
  if (!atur || !antrean || !siap) return <Kerangka />

  const mati = new Set(atur.jenis_nonaktif || [])
  const togel = (j) => setAtur((s) => ({ ...s, jenis_nonaktif: mati.has(j) ? s.jenis_nonaktif.filter((x) => x !== j) : [...(s.jenis_nonaktif || []), j] }))
  const simpan = async () => {
    setSibuk('simpan')
    try {
      cek(await supabase.from('pengaturan_notifikasi').update({ aktif: atur.aktif, url_aplikasi: atur.url_aplikasi.trim(), jenis_nonaktif: atur.jenis_nonaktif, updated_at: new Date().toISOString() }).eq('id', 1))
      toast.success('Pengaturan notifikasi disimpan')
      await muat()
    } catch (e) { toast.error(e.message) } finally { setSibuk(null) }
  }
  const proses = async (diam) => {
    setSibuk('proses')
    try {
      const { data: h, error } = await supabase.functions.invoke('notifikasi-wa', { body: {} })
      if (error) {
        let pesan = 'Edge Function notifikasi-wa tidak dapat dihubungi'
        try { pesan = (await error.context?.json())?.galat || pesan } catch { /* pesan umum */ }
        throw new Error(pesan)
      }
      if (!diam) toast.success(`${h.terkirim} terkirim, ${h.gagal} gagal`)
      await muat()
    } catch (e) { toast.error(e.message) } finally { setSibuk(null) }
  }
  const uji = async () => {
    setSibuk('uji')
    try {
      const wa = cek(await supabase.rpc('uji_notifikasi'))
      toast.success(`Pesan uji masuk antrean ke ${wa}`)
      await proses(true)
    } catch (e) { toast.error(e.message); setSibuk(null) }
  }
  const ulangi = async (id) => {
    try { cek(await supabase.rpc('ulangi_notifikasi', { p_id: id })); await proses(true) } catch (e) { toast.error(e.message) }
  }

  const tanpaWa = (peran) => data.pengguna.filter((u) => peran(u.role) && u.is_verified && !u.no_whatsapp).length
  const stafTanpa = tanpaWa((r) => r !== 'calon_rpl')
  const baris = antrean.filter((n) => saring === 'semua' || n.status === saring)
  const hit = (s) => antrean.filter((n) => n.status === s).length

  return (
    <Halaman judul="Notifikasi WhatsApp" sub="Pesan dikirim otomatis dari server saat status pengajuan, jadwal, pembayaran, atau tanda tangan berubah. Nomor diambil dari kolom WhatsApp di profil setiap akun.">
      {!atur.aktif ? <Pemberitahuan jenis="amber" judul="Notifikasi sedang nonaktif">Tidak ada pesan yang masuk antrean sampai notifikasi diaktifkan.</Pemberitahuan> : null}
      <Kartu judul="Pengaturan" kaki={<Tombol jenis="primary" ikon={Save} sibuk={sibuk === 'simpan'} onClick={simpan}>Simpan pengaturan</Tombol>}>
        <div className="ad-form">
          <div className="input-group">
            <span className="input-label">Status</span>
            <PilihSegmen pilihan={[{ v: true, l: 'Aktif' }, { v: false, l: 'Nonaktif' }]} nilai={atur.aktif} onUbah={(v) => setAtur((s) => ({ ...s, aktif: v }))} label="Status notifikasi" />
          </div>
          <Bidang label="Alamat aplikasi" hint="Dipakai untuk tautan di dalam pesan, mis. https://sirpl.stikomyos.ac.id">
            <input className="input" type="url" value={atur.url_aplikasi} onChange={(e) => setAtur((s) => ({ ...s, url_aplikasi: e.target.value }))} />
          </Bidang>
          {JENIS.map((g) => (
            <div key={g.grup} className="input-group">
              <span className="input-label">{g.grup}</span>
              <div className="ad-sakelar-daftar">
                {g.daftar.map(([v, l]) => (
                  <label key={v} className="ad-sakelar"><input type="checkbox" checked={!mati.has(v)} onChange={() => togel(v)} /><span>{l}</span></label>
                ))}
              </div>
            </div>
          ))}
          {stafTanpa ? <p className="pm-kecil">{stafTanpa} akun staf aktif belum mengisi nomor WhatsApp di profil dan tidak akan menerima pesan.</p> : null}
        </div>
      </Kartu>

      <section className="card">
        <div className="pm-mk-alat">
          <PilihSegmen nilai={saring} onUbah={setSaring} label="Saring antrean"
            pilihan={[{ v: 'semua', l: 'Semua' }, { v: 'menunggu', l: `Menunggu (${hit('menunggu') + hit('diproses')})` }, { v: 'terkirim', l: `Terkirim (${hit('terkirim')})` }, { v: 'gagal', l: `Gagal (${hit('gagal')})` }]} />
          <div className="pm-baris-aksi">
            <Tombol ikon={Send} sibuk={sibuk === 'uji'} onClick={uji}>Kirim pesan uji ke saya</Tombol>
            <Tombol ikon={RefreshCw} sibuk={sibuk === 'proses'} onClick={() => proses(false)}>Proses antrean</Tombol>
          </div>
        </div>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr><th style={{ width: 150 }}>Waktu</th><th style={{ width: 210 }}>Jenis</th><th style={{ width: 150 }}>Nomor</th><th>Pesan</th><th style={{ width: 160 }}>Status</th></tr></thead>
            <tbody>
              {baris.map((n) => {
                const [l, w] = STATUS[n.status] || [n.status, 'slate']
                return (
                  <tr key={n.id}>
                    <td data-label="Waktu" className="pm-kecil">{tanggal(n.created_at, true)}</td>
                    <td data-label="Jenis">{LABEL[n.jenis] || n.jenis}</td>
                    <td data-label="Nomor" className="pm-kecil">{n.no_wa}</td>
                    <td data-label="Pesan" className="pm-kecil ad-pesan">{n.pesan.replace('*SIRPL STIKOM Yos Sudarso*', '').trim()}</td>
                    <td data-label="Status">
                      <div className="pm-baris-aksi"><Lencana warna={w}>{l}</Lencana>
                        {n.status === 'gagal' ? <button type="button" className="btn btn-ghost btn-icon" title="Kirim ulang" aria-label="Kirim ulang" onClick={() => ulangi(n.id)}><RotateCcw size={14} /></button> : null}
                      </div>
                      {n.galat ? <div className="pm-kecil pm-merah">{n.galat}</div> : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!baris.length ? <p className="pm-kosong">Belum ada pesan.</p> : null}
        </div>
      </section>
    </Halaman>
  )
}

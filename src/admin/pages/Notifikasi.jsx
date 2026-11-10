// Notifikasi WhatsApp: pengaturan, jenis pesan, mode kirim, dan antrean.
// Mode manual: staf mengirim dari nomor WA Business lewat halaman WA keluar.
// Mode otomatis: Edge Function notifikasi-wa mengirim lewat Fonnte.
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, RotateCcw, Save, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAdmin, cek } from '../AdminData'
import { tanggal } from '../../pemohon/konstanta'
import { Bidang, Halaman, Kartu, Kerangka, Lencana, Pemberitahuan, PilihSegmen, Tombol } from '../../pemohon/ui'
import { JENIS_WA as JENIS, LABEL_WA as LABEL } from '../../notifikasi/jenis'
import { DaftarWaKeluar } from '../../notifikasi/WaKeluar'

const STATUS = { menunggu: ['Menunggu', 'amber'], diproses: ['Diproses', 'indigo'], terkirim: ['Terkirim', 'green'], gagal: ['Gagal', 'red'], dilewati: ['Dilewati', 'slate'] }
let simpanan = null

export default function Notifikasi() {
  const { siap, data } = useAdmin()
  const [atur, setAtur] = useState(simpanan?.atur || null)
  const [antrean, setAntrean] = useState(simpanan?.antrean || null)
  const [saring, setSaring] = useState('semua')
  const [sibuk, setSibuk] = useState(null)
  const [galat, setGalat] = useState(null)
  const [ulang, setUlang] = useState(0)

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
      cek(await supabase.from('pengaturan_notifikasi').update({ aktif: atur.aktif, mode: atur.mode || 'manual', url_aplikasi: atur.url_aplikasi.trim(), jenis_nonaktif: atur.jenis_nonaktif, updated_at: new Date().toISOString() }).eq('id', 1))
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
      if ((atur.mode || 'manual') === 'otomatis') await proses(true)
      else { setSibuk(null); setUlang((x) => x + 1) }
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
    <Halaman judul="Notifikasi WhatsApp" sub="Pesan disusun sistem saat status pengajuan, jadwal, pembayaran, atau tanda tangan berubah. Nomor diambil dari kolom WhatsApp di profil setiap akun (pemohon mengisinya di formulir pengajuan).">
      {!atur.aktif ? <Pemberitahuan jenis="amber" judul="Notifikasi sedang nonaktif">Tidak ada pesan yang masuk antrean sampai notifikasi diaktifkan.</Pemberitahuan> : null}
      <Kartu judul="Pengaturan" kaki={<Tombol jenis="primary" ikon={Save} sibuk={sibuk === 'simpan'} onClick={simpan}>Simpan pengaturan</Tombol>}>
        <div className="ad-form">
          <div className="input-group">
            <span className="input-label">Status</span>
            <PilihSegmen pilihan={[{ v: true, l: 'Aktif' }, { v: false, l: 'Nonaktif' }]} nilai={atur.aktif} onUbah={(v) => setAtur((s) => ({ ...s, aktif: v }))} label="Status notifikasi" />
          </div>
          <div className="input-group">
            <span className="input-label">Cara kirim</span>
            <PilihSegmen pilihan={[{ v: 'manual', l: 'Manual (WA Business)' }, { v: 'otomatis', l: 'Otomatis (Fonnte)' }]} nilai={atur.mode || 'manual'} onUbah={(v) => setAtur((s) => ({ ...s, mode: v }))} label="Cara kirim" />
            <span className="pm-kecil">{(atur.mode || 'manual') === 'manual'
              ? 'Staf (BAAK, PMB, Sekretaris, Ketua Tim) mengirim dari nomor WA Business institusi lewat menu WA keluar: pesan terbuka di WhatsApp Desktop/Web, tekan Kirim, lalu tandai terkirim.'
              : 'Pesan dikirim otomatis oleh Edge Function notifikasi-wa melalui Fonnte. Memerlukan FONNTE_TOKEN dan Database Webhook.'}</span>
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

      {(atur.mode || 'manual') === 'manual' ? (
        <>
          <div className="pm-baris-aksi"><Tombol ikon={Send} sibuk={sibuk === 'uji'} onClick={uji}>Masukkan pesan uji untuk saya</Tombol></div>
          <DaftarWaKeluar key={ulang} />
        </>
      ) : (
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
      )}
    </Halaman>
  )
}

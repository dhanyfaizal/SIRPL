// WA keluar: pesan WhatsApp yang disusun sistem dan dikirim manual oleh staf
// lewat nomor WA Business institusi (klik untuk membuka WhatsApp Desktop/Web).
import { useCallback, useEffect, useState } from 'react'
import { Check, ExternalLink, MessageCircle, SkipForward, Undo2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { tanggal } from '../pemohon/konstanta'
import { Halaman, Lencana, Pemberitahuan, PilihSegmen, Tombol } from '../pemohon/ui'
import { KATEGORI_WA, LABEL_WA, kategoriWa, tautanWa } from './jenis'
import '../pemohon/pemohon.css'

const STATUS = { menunggu: ['Belum dikirim', 'amber'], diproses: ['Diproses', 'indigo'], gagal: ['Gagal otomatis', 'red'], terkirim: ['Terkirim', 'green'], dilewati: ['Dilewati', 'slate'] }
const KEPALA = '*SIRPL STIKOM Yos Sudarso*'

// Daftar pesan dengan tombol kirim. Dipakai di halaman modul dan di Konsol Admin.
export function DaftarWaKeluar({ kategoriAwal = 'semua' }) {
  const [status, setStatus] = useState('menunggu')
  const [kategori, setKategori] = useState(kategoriAwal)
  const [daftar, setDaftar] = useState(null)
  const [galat, setGalat] = useState(null)
  const [dibuka, setDibuka] = useState(() => new Set())
  const [sibuk, setSibuk] = useState(null)

  const muat = useCallback(async () => {
    const { data, error } = await supabase.rpc('daftar_wa_keluar', { p_status: status, p_batas: 200 })
    if (error) { setGalat(error.message); return }
    setGalat(null); setDaftar(data || [])
  }, [status])
  useEffect(() => {
    let batal = false
    supabase.rpc('daftar_wa_keluar', { p_status: status, p_batas: 200 }).then(({ data, error }) => {
      if (batal) return
      if (error) setGalat(error.message); else { setGalat(null); setDaftar(data || []) }
    })
    return () => { batal = true }
  }, [status])

  const tandai = async (n, ke) => {
    setSibuk(n.id)
    try {
      const { error } = await supabase.rpc('tandai_wa', { p_id: n.id, p_status: ke })
      if (error) throw new Error(error.message)
      toast.success(ke === 'terkirim' ? 'Ditandai terkirim' : ke === 'dilewati' ? 'Pesan dilewati' : 'Dikembalikan ke belum dikirim')
      await muat()
    } catch (e) { toast.error(e.message) } finally { setSibuk(null) }
  }
  const buka = (n) => {
    window.open(tautanWa(n.no_wa, n.pesan), '_blank', 'noopener')
    setDibuka((s) => new Set(s).add(n.id))
  }

  if (galat) return <Pemberitahuan jenis="red" judul="Daftar WA keluar tidak dapat dimuat">{galat}. Pastikan migrasi 20261124000000_wa_manual.sql sudah dijalankan.</Pemberitahuan>
  const semua = daftar || []
  const hitKat = (v) => semua.filter((n) => v === 'semua' || kategoriWa(n.jenis) === v).length
  const baris = semua.filter((n) => kategori === 'semua' || kategoriWa(n.jenis) === kategori)

  return (
    <section className="card">
      <div className="pm-mk-alat">
        <PilihSegmen nilai={status} onUbah={setStatus} label="Status pesan"
          pilihan={[{ v: 'menunggu', l: 'Belum dikirim' }, { v: 'terkirim', l: 'Terkirim' }, { v: 'dilewati', l: 'Dilewati' }]} />
        <PilihSegmen nilai={kategori} onUbah={setKategori} label="Kelompok pesan"
          pilihan={[{ v: 'semua', l: `Semua (${hitKat('semua')})` }, ...KATEGORI_WA.map((k) => ({ v: k.v, l: `${k.l} (${hitKat(k.v)})` }))]} />
      </div>
      <div className="table-wrap">
        <table className="pm-tabel pm-tabel-responsif">
          <thead><tr><th style={{ width: 210 }}>Penerima</th><th style={{ width: 190 }}>Jenis</th><th>Pesan</th><th style={{ width: 230 }}>{status === 'menunggu' ? 'Kirim' : 'Status'}</th></tr></thead>
          <tbody>
            {baris.map((n) => {
              const [l, w] = STATUS[n.status] || [n.status, 'slate']
              return (
                <tr key={n.id}>
                  <td data-label="Penerima">
                    <div className="pm-tebal">{n.penerima || 'Tanpa nama'}</div>
                    <div className="pm-kecil">{n.untuk_pemohon ? 'Pemohon' : 'Staf'}{n.nomor_pendaftaran ? ` · ${n.nomor_pendaftaran}` : ''}</div>
                    <div className="pm-kecil">+{n.no_wa}</div>
                  </td>
                  <td data-label="Jenis"><div>{LABEL_WA[n.jenis] || n.jenis}</div><div className="pm-kecil">{tanggal(n.created_at, true)}</div></td>
                  <td data-label="Pesan" className="pm-kecil ad-pesan" style={{ whiteSpace: 'pre-line' }}>{n.pesan.replace(KEPALA, '').trim()}</td>
                  <td data-label="">
                    {status === 'menunggu' ? (
                      <div className="pm-tumpuk">
                        <Tombol jenis={dibuka.has(n.id) ? 'secondary' : 'primary'} ikon={MessageCircle} onClick={() => buka(n)}>{dibuka.has(n.id) ? 'Buka lagi' : 'Buka WhatsApp'}</Tombol>
                        <div className="pm-baris-aksi">
                          <Tombol jenis={dibuka.has(n.id) ? 'primary' : 'ghost'} ikon={Check} sibuk={sibuk === n.id} onClick={() => tandai(n, 'terkirim')}>Tandai terkirim</Tombol>
                          <button type="button" className="btn btn-ghost btn-icon" title="Lewati (tidak perlu dikirim)" aria-label="Lewati" onClick={() => tandai(n, 'dilewati')}><SkipForward size={14} /></button>
                        </div>
                        {n.status === 'gagal' ? <Lencana warna="red">Gagal otomatis</Lencana> : null}
                      </div>
                    ) : (
                      <div className="pm-tumpuk">
                        <Lencana warna={w}>{l}</Lencana>
                        <span className="pm-kecil">{n.terkirim_at ? tanggal(n.terkirim_at, true) : ''}{n.pengirim ? ` · ${n.pengirim}` : ''}</span>
                        <div className="pm-baris-aksi">
                          <a className="btn btn-ghost btn-sm" href={tautanWa(n.no_wa)} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Chat</a>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => tandai(n, 'menunggu')}><Undo2 size={13} /> Batal</button>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {daftar && !baris.length ? <p className="pm-kosong">{status === 'menunggu' ? 'Tidak ada pesan yang menunggu dikirim.' : 'Belum ada pesan.'}</p> : null}
        {!daftar ? <div className="sk" style={{ height: 60, margin: 16 }} /> : null}
      </div>
    </section>
  )
}

// Halaman modul (Tim Pengelola, PMB).
export default function WaKeluar() {
  const { role } = useAuth()
  return (
    <Halaman judul="WA keluar"
      sub="Pesan WhatsApp yang disusun sistem. Klik Buka WhatsApp untuk membuka WhatsApp Desktop/Web dengan nomor dan isi pesan terisi, tekan Kirim di WhatsApp, lalu tandai terkirim. Kirim dari nomor WA Business STIKOM Yos Sudarso.">
      <DaftarWaKeluar kategoriAwal={role === 'pmb' ? 'pembayaran' : 'semua'} />
    </Halaman>
  )
}

// BAAK menetapkan NIM pemohon yang sudah ditetapkan dengan SK.
import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { usePimpinan } from '../PimpinanData'
import { BOLEH, ringkasHasil } from '../aturan'
import { Halaman, Kartu, Kerangka, Lencana, PilihSegmen, Tombol } from '../../pemohon/ui'

const rupiah = (n) => `Rp${Number(n).toLocaleString('id-ID')}`

export default function Nim() {
  const { siap, data, peta, role, muat } = usePimpinan()
  const [lingkup, setLingkup] = useState('belum')
  const [isi, setIsi] = useState({})
  const [sibuk, setSibuk] = useState(null)
  // Sisa tagihan per pemohon: NIM baru dapat ditetapkan setelah seluruh biaya lunas.
  const [sisa, setSisa] = useState({})
  const idBelum = siap ? data.pengajuan.filter((p) => p.status === 'sk_terbit' && p.alur_versi !== 1).map((p) => p.id).join(',') : ''
  useEffect(() => {
    if (!idBelum) return
    let batal = false
    Promise.all(idBelum.split(',').map((id) => supabase.rpc('sisa_tagihan', { p_pengajuan: id }).then(({ data: n, error }) => [id, error ? -1 : Number(n)])))
      .then((r) => { if (!batal) setSisa(Object.fromEntries(r)) })
    return () => { batal = true }
  }, [idBelum])
  if (!siap) return <Kerangka />
  const boleh = BOLEH.tetapkanNim(role)
  // "Sudah ber-NIM" hanya memuat pengajuan alur Juknis yang benar-benar ber-NIM (data lama alur v1 tidak ikut).
  const belum = data.pengajuan.filter((p) => p.status === 'sk_terbit')
  const sudah = data.pengajuan.filter((p) => p.status === 'selesai' && p.alur_versi !== 1 && p.nim)
  const baris = lingkup === 'belum' ? belum : sudah

  const simpan = async (p) => {
    const nim = (isi[p.id] ?? p.nim ?? '').trim()
    if (!nim) { toast.error('Isi NIM'); return }
    setSibuk(p.id)
    try {
      const { error } = await supabase.rpc('tetapkan_nim', { p_pengajuan: p.id, p_nim: nim })
      if (error) throw new Error(error.message)
      toast.success(`NIM ${nim} ditetapkan`)
      setIsi((s) => { const n = { ...s }; delete n[p.id]; return n })
      await muat()
    } catch (e) { toast.error(e.message) } finally { setSibuk(null) }
  }

  return (
    <Halaman judul="Penetapan NIM" sub="Pemohon yang sudah ditetapkan dengan SK Ketua menjadi mahasiswa setelah BAAK menetapkan NIM."
      aksi={<PilihSegmen pilihan={[{ v: 'belum', l: `Belum ber-NIM (${belum.length})` }, { v: 'sudah', l: `Sudah ber-NIM (${sudah.length})` }]} nilai={lingkup} onUbah={setLingkup} label="Lingkup" />}>
      <Kartu padat>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr><th>Pemohon</th><th style={{ width: 190 }}>Program studi</th><th style={{ width: 220 }}>SK</th><th style={{ width: 120 }}>SKS diakui</th>{lingkup === 'belum' ? <th style={{ width: 170 }}>Pembayaran</th> : null}<th style={{ width: 280 }}>NIM</th></tr></thead>
            <tbody>
              {baris.map((p) => {
                const sk = peta.sk[p.sk_id]
                const nilai = isi[p.id] ?? p.nim ?? ''
                return (
                  <tr key={p.id}>
                    <td data-label="Pemohon"><div className="pm-tebal">{peta.orang[p.user_id]?.nama_lengkap || 'Pemohon'}</div><div className="pm-kecil">{p.nomor_pendaftaran} · {peta.orang[p.user_id]?.email}</div></td>
                    <td data-label="Program studi">{peta.prodi[p.prodi_pilihan_id]?.nama}</td>
                    <td className="pm-kecil" data-label="SK">{sk ? sk.nomor_sk : '-'}</td>
                    <td data-label="SKS diakui">{ringkasHasil(p, data).sksDiakui} SKS</td>
                    {lingkup === 'belum' ? (
                      <td data-label="Pembayaran">{p.alur_versi === 1 || sisa[p.id] < 0 ? '-' : sisa[p.id] == null ? <span className="pm-kecil">Memeriksa…</span>
                        : sisa[p.id] > 0 ? <><Lencana warna="amber">Belum lunas</Lencana><div className="pm-kecil">Sisa {rupiah(sisa[p.id])}</div></>
                        : <Lencana warna="green">Lunas</Lencana>}</td>
                    ) : null}
                    <td data-label="NIM">
                      {boleh && lingkup === 'belum' && p.alur_versi !== 1 && sisa[p.id] > 0 ? <span className="pm-kecil">Menunggu pelunasan</span>
                      : boleh && lingkup === 'belum' ? (
                        <div className="pm-baris-aksi">
                          <input className="input" style={{ width: 160 }} value={nilai} onChange={(e) => setIsi((s) => ({ ...s, [p.id]: e.target.value }))} aria-label={`NIM ${peta.orang[p.user_id]?.nama_lengkap || ''}`} placeholder="NIM" />
                          {nilai.trim() && nilai.trim() !== (p.nim || '') ? <Tombol ikon={Save} sibuk={sibuk === p.id} onClick={() => simpan(p)}>Simpan</Tombol> : null}
                        </div>
                      ) : p.nim ? <span className="pm-tebal">{p.nim}</span> : <Lencana warna="amber">Belum</Lencana>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!baris.length ? <p className="pm-kosong">{lingkup === 'belum' ? 'Tidak ada pemohon yang menunggu NIM.' : 'Belum ada pemohon yang ber-NIM.'}</p> : null}
        </div>
      </Kartu>
    </Halaman>
  )
}

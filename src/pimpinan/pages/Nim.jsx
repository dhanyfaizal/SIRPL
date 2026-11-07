// BAAK menetapkan NIM pemohon yang sudah ditetapkan dengan SK.
import { useState } from 'react'
import { Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { usePimpinan } from '../PimpinanData'
import { BOLEH, ringkasHasil } from '../aturan'
import { Halaman, Kartu, Kerangka, Lencana, PilihSegmen, Tombol } from '../../pemohon/ui'

export default function Nim() {
  const { siap, data, peta, role, muat } = usePimpinan()
  const [lingkup, setLingkup] = useState('belum')
  const [isi, setIsi] = useState({})
  const [sibuk, setSibuk] = useState(null)
  if (!siap) return <Kerangka />
  const boleh = BOLEH.tetapkanNim(role)
  const baris = data.pengajuan.filter((p) => (lingkup === 'belum' ? p.status === 'sk_terbit' : p.status === 'selesai'))

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
      aksi={<PilihSegmen pilihan={[{ v: 'belum', l: `Belum ber-NIM (${data.pengajuan.filter((p) => p.status === 'sk_terbit').length})` }, { v: 'sudah', l: 'Sudah ber-NIM' }]} nilai={lingkup} onUbah={setLingkup} label="Lingkup" />}>
      <Kartu padat>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr><th>Pemohon</th><th style={{ width: 190 }}>Program studi</th><th style={{ width: 220 }}>SK</th><th style={{ width: 120 }}>SKS diakui</th><th style={{ width: 280 }}>NIM</th></tr></thead>
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
                    <td data-label="NIM">
                      {boleh ? (
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

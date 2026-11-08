// Pengguna dan peran: verifikasi akun SSO, atur peran, prodi, dan nama.
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pencil, Save, UserCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAdmin } from '../AdminData'
import { GRUP_PERAN, LABEL_PERAN, PERAN } from '../aturan'
import { tanggal } from '../../pemohon/konstanta'
import { Bidang, Dialog, Halaman, Kerangka, Lencana, Pemberitahuan, PilihSegmen, Tombol } from '../../pemohon/ui'

export default function Pengguna() {
  const { siap, data, peta, galat, muat, userId } = useAdmin()
  const [sp, setSp] = useSearchParams()
  const [cari, setCari] = useState(sp.get('cari') || '')
  const [grup, setGrup] = useState(sp.get('saring') === 'belum' ? 'semua' : 'staf')
  const saring = sp.get('saring') || 'semua'
  const [ubah, setUbah] = useState(null)
  const [sibuk, setSibuk] = useState(null)

  const baris = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return (data?.pengguna || [])
      .filter((u) => grup === 'semua' || (grup === 'pemohon' ? u.role === 'calon_rpl' : u.role !== 'calon_rpl'))
      .filter((u) => saring === 'semua' || (saring === 'belum' ? !u.is_verified : u.is_verified))
      .filter((u) => !q || [u.nama_lengkap, u.email, LABEL_PERAN[u.role]].some((v) => (v || '').toLowerCase().includes(q)))
  }, [data, cari, grup, saring])

  if (galat && !siap) return <Halaman judul="Pengguna dan peran"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />

  const setSaring = (v) => { const n = new URLSearchParams(sp); if (v === 'semua') n.delete('saring'); else n.set('saring', v); setSp(n, { replace: true }) }
  const punyaPengajuan = new Set(data.pengajuan.filter((p) => p.status !== 'draft').map((p) => p.user_id))

  const simpan = async (f) => {
    setSibuk(f.id)
    try {
      const { error } = await supabase.rpc('atur_pengguna', { p_id: f.id, p_role: f.role, p_prodi: f.prodi_id || null, p_verified: f.is_verified, p_nama: f.nama_lengkap })
      if (error) throw new Error(error.message)
      toast.success('Data pengguna disimpan')
      setUbah(null)
      await muat()
    } catch (e) { toast.error(e.message) } finally { setSibuk(null) }
  }
  const verifikasi = (u) => simpan({ ...u, is_verified: true })

  const perluProdi = ubah && (ubah.role.startsWith('kaprodi_') || ubah.role === 'asessor')
  const peranTerkunci = ubah && ubah.roleAwal === 'calon_rpl' && punyaPengajuan.has(ubah.id)
  const pilihPeran = (role) => {
    const kode = PERAN.find((p) => p.v === role)?.prodi
    const prodi = kode ? data.prodi.find((x) => x.kode === kode || (kode === 'TI' && x.kode === 'IF'))?.id : null
    setUbah((s) => ({ ...s, role, prodi_id: prodi || (role === 'asessor' ? s.prodi_id : null) }))
  }

  return (
    <Halaman judul="Pengguna dan peran" sub="Akun dibuat sendiri oleh pengguna lewat masuk dengan Google. Setiap akun baru perlu diverifikasi sebelum dapat memakai SIRPL; akun staf juga perlu diberi peran.">
      <section className="card">
        <div className="pm-mk-alat">
          <div className="pm-baris-aksi">
            <div className="pm-input-ikon pm-cari">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              <input className="input" type="search" placeholder="Cari nama, email, atau peran" value={cari} onChange={(e) => setCari(e.target.value)} aria-label="Cari pengguna" />
            </div>
            <PilihSegmen pilihan={[{ v: 'staf', l: 'Staf' }, { v: 'pemohon', l: 'Pemohon' }, { v: 'semua', l: 'Semua' }]} nilai={grup} onUbah={setGrup} label="Jenis akun" />
            <PilihSegmen pilihan={[{ v: 'semua', l: 'Semua status' }, { v: 'belum', l: `Belum diverifikasi (${data.pengguna.filter((u) => !u.is_verified).length})` }, { v: 'sudah', l: 'Terverifikasi' }]} nilai={saring} onUbah={setSaring} label="Status verifikasi" />
          </div>
          <span className="pm-kecil">{baris.length} akun</span>
        </div>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr><th>Nama</th><th style={{ width: 240 }}>Peran</th><th style={{ width: 170 }}>Program studi</th><th style={{ width: 120 }}>Terdaftar</th><th style={{ width: 210 }}><span className="sr-only">Aksi</span></th></tr></thead>
            <tbody>
              {baris.map((u) => (
                <tr key={u.id}>
                  <td data-label="Nama"><div className="pm-tebal">{u.nama_lengkap || '-'}{u.id === userId ? <span className="pm-kecil"> (Anda)</span> : null}</div><div className="pm-kecil">{u.email}{u.no_whatsapp ? ` · ${u.no_whatsapp}` : ''}</div></td>
                  <td data-label="Peran">{LABEL_PERAN[u.role] || u.role}</td>
                  <td data-label="Program studi">{peta.prodi[u.prodi_id]?.nama || '-'}</td>
                  <td data-label="Terdaftar" className="pm-kecil">{tanggal(u.created_at)}</td>
                  <td data-label="Aksi">
                    <div className="pm-baris-aksi ad-aksi-kanan">
                      {u.is_verified ? <Lencana warna="green">Terverifikasi</Lencana> : <Tombol jenis="primary" ikon={UserCheck} sibuk={sibuk === u.id} onClick={() => verifikasi(u)}>Verifikasi</Tombol>}
                      <button type="button" className="btn btn-ghost btn-icon" title="Ubah" aria-label={`Ubah ${u.nama_lengkap || u.email}`} onClick={() => setUbah({ ...u, nama_lengkap: u.nama_lengkap || '', roleAwal: u.role })}><Pencil size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!baris.length ? <p className="pm-kosong">Tidak ada akun yang cocok.</p> : null}
        </div>
      </section>

      <Dialog buka={!!ubah} judul="Ubah pengguna" onTutup={() => setUbah(null)} lebar={540}
        kaki={<><Tombol onClick={() => setUbah(null)}>Batal</Tombol><Tombol jenis="primary" ikon={Save} sibuk={sibuk === ubah?.id} onClick={() => simpan(ubah)}>Simpan</Tombol></>}>
        {ubah ? (
          <div className="pm-tumpuk">
            <div className="pm-kecil">{ubah.email}</div>
            <Bidang label="Nama lengkap" wajib hint="Dipakai pada dokumen bertanda tangan. Tulis lengkap dengan gelar.">
              <input className="input" value={ubah.nama_lengkap} onChange={(e) => setUbah((s) => ({ ...s, nama_lengkap: e.target.value }))} />
            </Bidang>
            <Bidang label="Peran" wajib hint={peranTerkunci ? 'Akun ini sudah memiliki pengajuan RPL sehingga perannya tidak dapat diubah.' : undefined}>
              <select className="input" value={ubah.role} onChange={(e) => pilihPeran(e.target.value)} disabled={peranTerkunci}>
                {GRUP_PERAN.map((g) => (
                  <optgroup key={g} label={g}>{PERAN.filter((p) => p.grup === g).map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}</optgroup>
                ))}
              </select>
            </Bidang>
            {perluProdi ? (
              <Bidang label={ubah.role === 'asessor' ? 'Homebase program studi' : 'Program studi'} wajib={ubah.role !== 'asessor'}>
                <select className="input" value={ubah.prodi_id || ''} onChange={(e) => setUbah((s) => ({ ...s, prodi_id: e.target.value || null }))}>
                  <option value="">{ubah.role === 'asessor' ? 'Tidak ada / praktisi' : 'Pilih'}</option>
                  {data.prodi.map((x) => <option key={x.id} value={x.id}>{x.nama}</option>)}
                </select>
              </Bidang>
            ) : null}
            <div className="input-group">
              <span className="input-label">Status akun</span>
              <PilihSegmen pilihan={[{ v: true, l: 'Terverifikasi' }, { v: false, l: 'Belum / nonaktif' }]} nilai={ubah.is_verified} onUbah={(v) => setUbah((s) => ({ ...s, is_verified: v }))} label="Status akun" />
            </div>
            {ubah.id === userId ? <Pemberitahuan jenis="amber">Anda sedang mengubah akun sendiri. Sistem menolak perubahan bila tidak ada Admin aktif lain.</Pemberitahuan> : null}
          </div>
        ) : null}
      </Dialog>
    </Halaman>
  )
}

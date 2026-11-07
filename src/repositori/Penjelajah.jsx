// Penjelajah folder repositori pelaporan RPL:
// PRODI / 01_TRANSFER_KREDIT | 02_PEROLEHAN_KREDIT / NIM_NAMA / SUBFOLDER / berkas
import { useMemo, useState } from 'react'
import { ChevronRight, FileText, Folder, Search } from 'lucide-react'

const TINGKAT = ['folder_prodi', 'folder_mekanisme', 'folder_mahasiswa', 'subfolder']
const LABEL = ['Program studi', 'Mekanisme', 'Mahasiswa', 'Kategori']

export default function Penjelajah({ berkas, onBuka, sibukId }) {
  const [jalur, setJalur] = useState([])
  const [cari, setCari] = useState('')
  const akar = berkas[0]?.folder_semester || 'Repositori pelaporan RPL'
  const di = useMemo(() => berkas.filter((b) => jalur.every((v, i) => b[TINGKAT[i]] === v)), [berkas, jalur])
  const tingkat = jalur.length
  const q = cari.trim().toLowerCase()

  const isi = useMemo(() => {
    if (tingkat >= TINGKAT.length) return { folder: [], berkas: di }
    const kunci = TINGKAT[tingkat]
    const peta = new Map()
    for (const b of di) {
      const nama = b[kunci] || 'LAINNYA'
      const x = peta.get(nama) || { nama, jumlah: 0, mhs: new Set() }
      x.jumlah += 1; x.mhs.add(b.folder_mahasiswa); peta.set(nama, x)
    }
    return { folder: [...peta.values()].sort((a, b) => a.nama.localeCompare(b.nama)), berkas: [] }
  }, [di, tingkat])

  const folderTampil = isi.folder.filter((f) => !q || f.nama.toLowerCase().includes(q))
  const berkasTampil = isi.berkas.filter((b) => !q || b.nama_berkas.toLowerCase().includes(q))

  return (
    <section className="card rp-jelajah">
      <nav className="rp-remah" aria-label="Lokasi folder">
        <button type="button" className={tingkat === 0 ? 'is-on' : ''} onClick={() => { setJalur([]); setCari('') }}>{akar}</button>
        {jalur.map((v, i) => (
          <span key={i} className="rp-remah-item">
            <ChevronRight size={14} aria-hidden="true" />
            <button type="button" className={i === jalur.length - 1 ? 'is-on' : ''} onClick={() => { setJalur(jalur.slice(0, i + 1)); setCari('') }}>{v}</button>
          </span>
        ))}
      </nav>
      <div className="pm-mk-alat">
        <div className="pm-input-ikon pm-cari">
          <Search size={15} aria-hidden="true" />
          <input className="input" type="search" value={cari} onChange={(e) => setCari(e.target.value)}
            placeholder={tingkat < TINGKAT.length ? `Cari ${LABEL[tingkat].toLowerCase()}` : 'Cari berkas'} aria-label="Cari" />
        </div>
        <span className="pm-kecil">{tingkat < TINGKAT.length ? `${folderTampil.length} folder` : `${berkasTampil.length} berkas`}</span>
      </div>
      <ul className="rp-daftar">
        {folderTampil.map((f) => (
          <li key={f.nama}>
            <button type="button" className="rp-baris" onClick={() => { setJalur([...jalur, f.nama]); setCari('') }}>
              <Folder size={20} className="rp-ikon-folder" aria-hidden="true" />
              <span className="pm-grow rp-nama">{f.nama}</span>
              <span className="pm-kecil">{tingkat < 2 ? `${f.mhs.size} mahasiswa · ` : ''}{f.jumlah} berkas</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
        {berkasTampil.map((b, i) => (
          <li key={b.id || i}>
            <button type="button" className="rp-baris" onClick={() => onBuka(b)} disabled={sibukId === (b.id || b.sumber_id || b.storage_path)}>
              <FileText size={20} className={b.jenis === 'dokumen' || b.sumber === 'dokumen' ? 'rp-ikon-dok' : 'rp-ikon-berkas'} aria-hidden="true" />
              <span className="pm-grow rp-nama-berkas">{b.nama_berkas}</span>
              <span className="pm-kecil">{b.jenis === 'dokumen' || b.sumber === 'dokumen' ? 'Dokumen bertanda tangan' : 'Berkas unggahan'}</span>
            </button>
          </li>
        ))}
        {!folderTampil.length && !berkasTampil.length ? <li><p className="pm-kosong">{berkas.length ? 'Tidak ada yang cocok.' : 'Repositori masih kosong. Berkas muncul setelah pemohon ditetapkan dengan SK.'}</p></li> : null}
      </ul>
    </section>
  )
}

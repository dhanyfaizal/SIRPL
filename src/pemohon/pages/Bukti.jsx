import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { usePemohon } from '../PemohonData'
import * as api from '../api'
import { BUKTI_WAJIB_SAH, JENIS_BUKTI, LABEL_BUKTI } from '../konstanta'
import { Bidang, BukaBerkas, Dialog, Halaman, Kartu, Kerangka, Lencana, Pemberitahuan, PilihBerkas, Tombol } from '../ui'

const KOSONG = { jenis: '', nama_dokumen: '', deskripsi: '', tautan: '', disahkan_atasan: false, mekanisme: '' }

function FormBukti({ awal, onTutup }) {
  const { data, pengajuan, userId, muatDetail } = usePemohon()
  const [f, setF] = useState(awal ? { ...KOSONG, ...awal, mekanisme: awal.mekanisme || '', tautan: awal.tautan || '', deskripsi: awal.deskripsi || '' } : KOSONG)
  const [file, setFile] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const wajibSah = BUKTI_WAJIB_SAH.has(f.jenis)
  const adaBerkas = !!file || !!awal?.file_url || !!f.tautan.trim()
  const gabungan = pengajuan.jenis_rpl === 'gabungan'

  const simpan = async () => {
    if (wajibSah && !f.disahkan_atasan) { toast.error('Bukti jenis ini wajib disahkan atasan atau pihak berwenang'); return }
    setSibuk(true)
    try {
      let file_url = awal?.file_url || null
      let ukuran_byte = awal?.ukuran_byte || null
      if (file) {
        file_url = await api.unggahBerkas(userId, pengajuan.id, file, 'bukti')
        ukuran_byte = file.size
      }
      const isi = {
        jenis: f.jenis, nama_dokumen: f.nama_dokumen.trim(), deskripsi: f.deskripsi.trim() || null,
        tautan: f.tautan.trim() || null, disahkan_atasan: f.disahkan_atasan, file_url, ukuran_byte,
        mekanisme: gabungan ? (f.mekanisme || null) : null,
      }
      if (awal) {
        await api.ubahBukti(awal.id, isi)
        if (file && awal.file_url) await api.hapusBerkasStorage(awal.file_url)
      } else {
        const nomor = Math.max(0, ...data.bukti.map((b) => b.nomor)) + 1
        await api.tambahBukti({ ...isi, pengajuan_id: pengajuan.id, nomor })
      }
      await muatDetail()
      toast.success(awal ? 'Bukti diperbarui' : 'Bukti ditambahkan')
      onTutup()
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Dialog buka judul={awal ? `Ubah bukti nomor ${awal.nomor}` : 'Tambah bukti portofolio'} onTutup={onTutup} lebar={560}
      kaki={<>
        <Tombol onClick={onTutup}>Batal</Tombol>
        <Tombol jenis="primary" sibuk={sibuk} disabled={!f.jenis || !f.nama_dokumen.trim() || !adaBerkas} onClick={simpan}>Simpan bukti</Tombol>
      </>}>
      <Bidang label="Jenis bukti" wajib>
        <select className="input" value={f.jenis} onChange={set('jenis')}>
          <option value="">Pilih jenis bukti</option>
          {JENIS_BUKTI.map((j) => <option key={j.v} value={j.v}>{j.no}. {j.l}{j.wajibSah ? ' (disahkan atasan)' : ''}</option>)}
        </select>
      </Bidang>
      <Bidang label="Nama dokumen" wajib hint="Contoh: Sertifikat BNSP Junior Network Administrator 2024">
        <input className="input" value={f.nama_dokumen} onChange={set('nama_dokumen')} maxLength={255} />
      </Bidang>
      <Bidang label="Deskripsi singkat" hint="Jelaskan isi bukti dan kaitannya dengan kemampuan yang Anda klaim.">
        <textarea className="input" rows={3} value={f.deskripsi} onChange={set('deskripsi')} />
      </Bidang>
      {gabungan ? (
        <Bidang label="Dipakai untuk">
          <select className="input" value={f.mekanisme} onChange={set('mekanisme')}>
            <option value="">Transfer dan perolehan kredit</option>
            <option value="transfer">Transfer kredit</option>
            <option value="perolehan">Perolehan kredit</option>
          </select>
        </Bidang>
      ) : null}
      <div className="input-group">
        <span className="input-label">Berkas atau tautan <span className="pm-wajib">*</span></span>
        <div className="pm-baris-aksi">
          <PilihBerkas label={file ? 'Ganti berkas' : awal?.file_url ? 'Ganti berkas' : 'Pilih berkas'} onPilih={setFile} />
          <span className="pm-kecil">{file ? file.name : awal?.file_url ? 'Berkas sudah ada' : 'PDF, JPG, atau PNG, maks 10 MB'}</span>
        </div>
        <input className="input" placeholder="Atau tautan (mis. repositori proyek, video demo)" value={f.tautan} onChange={set('tautan')} />
      </div>
      <label className="pm-centang">
        <input type="checkbox" checked={f.disahkan_atasan} onChange={set('disahkan_atasan')} />
        <span>Dokumen ini sudah disahkan atasan atau pihak yang berwenang{wajibSah ? <b className="pm-wajib"> (wajib untuk jenis ini)</b> : null}</span>
      </label>
    </Dialog>
  )
}

export default function Bukti() {
  const { siap, data, pengajuan, bisaDiubah, muatDetail } = usePemohon()
  const [form, setForm] = useState(null)
  const [hapus, setHapus] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  if (!siap) return <Kerangka />
  if (!pengajuan) return <Navigate to="/pemohon" replace />

  const bolehTambah = bisaDiubah || ['menunggu_bukti_tambahan', 'klarifikasi'].includes(pengajuan.status)
  const dirujuk = (no) => data.evaluasi.some((e) => (e.butir || []).some((b) => (b.bukti || []).includes(no)))

  const konfirmasiHapus = async () => {
    setSibuk(true)
    try {
      await api.hapusBukti(hapus.id)
      if (hapus.file_url) await api.hapusBerkasStorage(hapus.file_url)
      await muatDetail()
      toast.success('Bukti dihapus')
      setHapus(null)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Halaman judul="Bukti portofolio" sub="Langkah 3. Setiap bukti diberi nomor dan dirujuk di Formulir Evaluasi Diri. Satu bukti boleh dipakai untuk beberapa pernyataan."
      aksi={bolehTambah ? <Tombol jenis="primary" ikon={Plus} onClick={() => setForm('baru')}>Tambah bukti</Tombol> : null}>
      {pengajuan.status === 'menunggu_bukti_tambahan' ? (
        <Pemberitahuan jenis="amber" judul="Asesor meminta bukti tambahan">{pengajuan.catatan_revisi || 'Tambahkan bukti yang diminta, lalu beri tahu asesor melalui Sekretariat.'}</Pemberitahuan>
      ) : null}
      <Kartu padat>
        {data.bukti.length ? (
          <div className="table-wrap">
            <table className="pm-tabel">
              <thead><tr><th style={{ width: 56 }}>No.</th><th>Dokumen</th><th style={{ width: 230 }}>Jenis</th><th style={{ width: 130 }}>Status</th><th style={{ width: 150 }}><span className="pm-sr">Aksi</span></th></tr></thead>
              <tbody>
                {data.bukti.map((b) => (
                  <tr key={b.id}>
                    <td className="pm-tebal">{b.nomor}</td>
                    <td>
                      <div className="pm-tebal">{b.nama_dokumen}</div>
                      {b.deskripsi ? <div className="pm-kecil">{b.deskripsi}</div> : null}
                      {b.tautan ? <a className="pm-tautan" href={b.tautan} target="_blank" rel="noreferrer">{b.tautan}</a> : null}
                    </td>
                    <td className="pm-kecil">{LABEL_BUKTI[b.jenis] || b.jenis}</td>
                    <td>
                      <div className="pm-tumpuk">
                        {dirujuk(b.nomor) ? <Lencana warna="green">Dirujuk F03</Lencana> : <Lencana>Belum dirujuk</Lencana>}
                        {b.is_bukti_tambahan ? <Lencana warna="indigo">Bukti tambahan</Lencana> : null}
                        {b.disahkan_atasan ? <span className="pm-kecil">Disahkan atasan</span> : null}
                      </div>
                    </td>
                    <td>
                      <div className="pm-baris-aksi pm-kanan">
                        <BukaBerkas path={b.file_url} />
                        {bisaDiubah ? <>
                          <button type="button" className="btn btn-ghost btn-icon" aria-label={`Ubah bukti ${b.nomor}`} onClick={() => setForm(b)}><Pencil size={14} /></button>
                          <button type="button" className="btn btn-ghost btn-icon" aria-label={`Hapus bukti ${b.nomor}`} onClick={() => setHapus(b)}><Trash2 size={14} /></button>
                        </> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="pm-kosong-besar">
            <div className="pm-tebal">Belum ada bukti</div>
            <p className="pm-kecil">Contoh bukti: sertifikat kompetensi, surat keterangan kerja, logbook, dokumen perancangan, atau penilaian kinerja.</p>
            {bolehTambah ? <Tombol jenis="primary" ikon={Plus} onClick={() => setForm('baru')}>Tambah bukti pertama</Tombol> : null}
          </div>
        )}
      </Kartu>

      <Kartu judul="Prinsip penilaian bukti">
        <ul className="pm-daftar">
          <li><b>Valid</b>: ada hubungan yang jelas antara bukti dan capaian pembelajaran mata kuliah yang dinilai.</li>
          <li><b>Autentik</b>: dapat dibuktikan sebagai karya Anda sendiri dan dapat diverifikasi ke penerbitnya.</li>
          <li><b>Terkini</b>: menunjukkan pengetahuan dan keterampilan Anda saat ini.</li>
          <li><b>Memadai</b>: menunjukkan kemampuan dalam periode waktu dan konteks yang cukup.</li>
        </ul>
      </Kartu>

      {form ? <FormBukti awal={form === 'baru' ? null : form} onTutup={() => setForm(null)} /> : null}
      <Dialog buka={!!hapus} judul="Hapus bukti?" onTutup={() => setHapus(null)}
        kaki={<><Tombol onClick={() => setHapus(null)}>Batal</Tombol><Tombol jenis="danger" sibuk={sibuk} onClick={konfirmasiHapus}>Hapus bukti</Tombol></>}>
        <p>Bukti nomor {hapus?.nomor} ({hapus?.nama_dokumen}) akan dihapus beserta berkasnya.
          {hapus && dirujuk(hapus.nomor) ? ' Bukti ini dirujuk di Formulir Evaluasi Diri, jadi periksa kembali rujukannya setelah dihapus.' : ''}</p>
      </Dialog>
    </Halaman>
  )
}

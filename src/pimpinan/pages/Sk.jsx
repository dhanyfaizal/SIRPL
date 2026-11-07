// SK Ketua STIKOM tentang penetapan hasil RPL (satu SK untuk banyak pemohon).
import { useMemo, useState } from 'react'
import { FileBadge, FilePlus2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { terbitkanLampiranSk } from '../../dokumen/PanelDokumen'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { usePimpinan } from '../PimpinanData'
import { BOLEH, ringkasHasil } from '../aturan'
import { tanggal } from '../../pemohon/konstanta'
import { BukaBerkas, Bidang, Dialog, Halaman, Kartu, Kerangka, Lencana, PilihBerkas, Tombol } from '../../pemohon/ui'

export default function Sk() {
  const { siap, data, peta, role, muat } = usePimpinan()
  const { user } = useAuth()
  const [prodiId, setProdiId] = useState('')
  const [pilih, setPilih] = useState(new Set())
  const [form, setForm] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  const siapSk = useMemo(() => (data?.pengajuan || []).filter((p) => p.status === 'menunggu_sk' && (!prodiId || p.prodi_pilihan_id === prodiId)), [data, prodiId])
  if (!siap) return <Kerangka />
  const boleh = BOLEH.terbitkanSk(role)
  const prodiAda = [...new Set(data.pengajuan.filter((p) => p.status === 'menunggu_sk').map((p) => p.prodi_pilihan_id))]
  const semua = siapSk.length > 0 && siapSk.every((p) => pilih.has(p.id))
  const aktif = data.periode.find((p) => p.is_aktif)

  const buka = () => {
    const satuProdi = [...new Set(siapSk.filter((p) => pilih.has(p.id)).map((p) => p.prodi_pilihan_id))]
    const nmProdi = satuProdi.length === 1 ? peta.prodi[satuProdi[0]]?.nama : null
    setForm({ nomor: '', tanggal: new Date().toLocaleDateString('sv-SE'), file: null,
      perihal: `Penetapan Hasil Rekognisi Pembelajaran Lampau${nmProdi ? ` Program Studi ${nmProdi}` : ''}${aktif ? ` Periode ${aktif.nama}` : ''}`,
      prodi: satuProdi.length === 1 ? satuProdi[0] : null })
  }
  const simpan = async () => {
    if (!form.nomor.trim() || !form.tanggal) { toast.error('Isi nomor dan tanggal SK'); return }
    setSibuk(true)
    try {
      let path = null
      if (form.file) {
        if (form.file.size > 10 * 1024 * 1024) throw new Error('Ukuran berkas maksimal 10 MB')
        path = `${user.id}/sk/${Date.now()}_${form.file.name.replace(/[^\w.-]+/g, '_').slice(-80)}`
        const up = await supabase.storage.from('rpl-documents').upload(path, form.file, { contentType: form.file.type || 'application/pdf' })
        if (up.error) throw new Error(up.error.message)
      }
      const { error } = await supabase.rpc('terbitkan_sk', { p_nomor: form.nomor.trim(), p_tanggal: form.tanggal, p_perihal: form.perihal, p_file: path, p_pengajuan: [...pilih], p_prodi: form.prodi })
      if (error) throw new Error(error.message)
      toast.success(`SK ${form.nomor.trim()} dicatat untuk ${pilih.size} pemohon`)
      setForm(null); setPilih(new Set())
      await muat()
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }
  const jumlahSk = (id) => data.pengajuan.filter((p) => p.sk_id === id).length
  const bolehF08 = ['admin', 'eksekutif', 'sekretaris', 'ketua_tim'].includes(role)
  const lampiran = async (s) => {
    const ids = data.pengajuan.filter((p) => p.sk_id === s.id).map((p) => p.id)
    if (!ids.length) { toast.error('SK ini tidak memuat pemohon yang masih aktif di daftar'); return }
    setSibuk(s.id)
    try {
      const n = await terbitkanLampiranSk(s, ids)
      toast.success(`${n} lampiran SK (F08) diterbitkan dan menunggu tanda tangan Ketua STIKOM`)
    } catch (e) { toast.error(e.message, { duration: 7000 }) } finally { setSibuk(false) }
  }

  return (
    <Halaman judul="SK Rekognisi" sub="Hasil yang sudah disetujui Komite RPL ditetapkan dengan SK Ketua STIKOM Yos Sudarso. Satu SK dapat memuat banyak pemohon.">
      <Kartu judul="Siap ditetapkan" sub={`${data.pengajuan.filter((p) => p.status === 'menunggu_sk').length} pemohon disetujui Komite`} padat
        aksi={prodiAda.length > 1 ? (
          <select className="input tm-saring" value={prodiId} onChange={(e) => { setProdiId(e.target.value); setPilih(new Set()) }} aria-label="Program studi">
            <option value="">Semua prodi</option>
            {prodiAda.map((id) => <option key={id} value={id}>{peta.prodi[id]?.nama}</option>)}
          </select>
        ) : null}>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr>
              {boleh ? <th style={{ width: 40 }}><input type="checkbox" aria-label="Pilih semua" checked={semua} onChange={() => setPilih(semua ? new Set() : new Set(siapSk.map((p) => p.id)))} /></th> : null}
              <th>Pemohon</th><th style={{ width: 200 }}>Program studi</th><th style={{ width: 120 }}>SKS diakui</th><th style={{ width: 160 }}>Disetujui Komite</th>
            </tr></thead>
            <tbody>
              {siapSk.map((p) => {
                const r = ringkasHasil(p, data)
                const k = data.komite.find((x) => x.pengajuan_id === p.id && x.keputusan === 'disetujui')
                return (
                  <tr key={p.id}>
                    {boleh ? <td data-label=""><input type="checkbox" aria-label="Pilih" checked={pilih.has(p.id)} onChange={() => setPilih((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })} /></td> : null}
                    <td data-label="Pemohon"><div className="pm-tebal">{peta.orang[p.user_id]?.nama_lengkap || 'Pemohon'}</div><div className="pm-kecil">{p.nomor_pendaftaran}</div></td>
                    <td data-label="Program studi">{peta.prodi[p.prodi_pilihan_id]?.nama}</td>
                    <td data-label="SKS diakui">{r.sksDiakui} SKS</td>
                    <td className="pm-kecil" data-label="Disetujui">{k ? tanggal(k.created_at) : '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!siapSk.length ? <p className="pm-kosong">Belum ada hasil yang disetujui Komite.</p> : null}
        </div>
        {boleh && siapSk.length ? (
          <div className="card-body pm-baris-aksi">
            <span className="pm-kecil pm-grow">{pilih.size} pemohon dipilih</span>
            <Tombol jenis="primary" ikon={FileBadge} disabled={!pilih.size} onClick={buka}>Catat SK</Tombol>
          </div>
        ) : null}
      </Kartu>

      <Kartu judul="SK yang sudah terbit" sub="Lampiran SK (F08) per pemohon ditandatangani Ketua STIKOM secara elektronik." padat aksi={<Link to="/tanda-tangan" className="btn btn-ghost btn-sm">Tanda tangan dokumen</Link>}>
        {data.sk.length ? (
          <div className="table-wrap">
            <table className="pm-tabel pm-tabel-responsif">
              <thead><tr><th style={{ width: 220 }}>Nomor SK</th><th>Perihal</th><th style={{ width: 130 }}>Tanggal</th><th style={{ width: 100 }}>Pemohon</th><th style={{ width: 130 }}><span className="pm-sr">Berkas</span></th>{bolehF08 ? <th style={{ width: 190 }}><span className="pm-sr">Lampiran</span></th> : null}</tr></thead>
              <tbody>
                {data.sk.map((s) => (
                  <tr key={s.id}>
                    <td className="pm-tebal" data-label="Nomor">{s.nomor_sk}</td>
                    <td data-label="Perihal">{s.perihal || '-'}</td>
                    <td data-label="Tanggal">{tanggal(s.tanggal_sk)}</td>
                    <td data-label="Pemohon">{jumlahSk(s.id)}</td>
                    <td data-label="">{s.file_sk_url ? <BukaBerkas path={s.file_sk_url} label="Buka" /> : <Lencana>Tanpa berkas</Lencana>}</td>
                    {bolehF08 ? <td data-label=""><Tombol ikon={FilePlus2} sibuk={sibuk === s.id} onClick={() => lampiran(s)}>Terbitkan lampiran F08</Tombol></td> : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="pm-kosong">Belum ada SK.</p>}
      </Kartu>

      <Dialog buka={!!form} judul={`Catat SK untuk ${pilih.size} pemohon`} onTutup={() => setForm(null)} lebar={600}
        kaki={<><Tombol onClick={() => setForm(null)}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk} onClick={simpan}>Catat SK</Tombol></>}>
        {form ? (
          <div className="pm-tumpuk-besar">
            <div className="pm-form-2">
              <Bidang label="Nomor SK" wajib><input className="input" value={form.nomor} onChange={(e) => setForm((s) => ({ ...s, nomor: e.target.value }))} placeholder="mis. 123/SK/STIKOM-YS/XI/2026" /></Bidang>
              <Bidang label="Tanggal SK" wajib><input className="input" type="date" value={form.tanggal} onChange={(e) => setForm((s) => ({ ...s, tanggal: e.target.value }))} /></Bidang>
              <Bidang label="Perihal" lebar><input className="input" value={form.perihal} onChange={(e) => setForm((s) => ({ ...s, perihal: e.target.value }))} /></Bidang>
              <Bidang label="Berkas SK bertanda tangan (PDF)" lebar hint="Opsional. Lampiran SK (F08) per pemohon dibuat otomatis oleh modul dokumen.">
                <div className="pm-baris-aksi"><PilihBerkas label={form.file ? 'Ganti berkas' : 'Pilih berkas'} onPilih={(f) => setForm((s) => ({ ...s, file: f }))} terima=".pdf" />{form.file ? <span className="pm-kecil">{form.file.name}</span> : null}</div>
              </Bidang>
            </div>
            <p className="pm-kecil">Setelah dicatat, status pemohon menjadi "SK terbit" dan BAAK dapat menetapkan NIM.</p>
          </div>
        ) : null}
      </Dialog>
    </Halaman>
  )
}

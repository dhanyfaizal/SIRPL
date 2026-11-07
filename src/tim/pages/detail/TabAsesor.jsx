import { useMemo, useState } from 'react'
import { PlayCircle, Trash2, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTim } from '../../TimData'
import * as api from '../../api'
import { PERAN_PENUGASAN } from '../../aturan'
import { tanggal } from '../../../pemohon/konstanta'
import { BarTahap, Bidang, Dialog, Kartu, Lencana, Pemberitahuan, Tombol } from '../../../pemohon/ui'

const KODE_PERAN = { kaprodi_ti: 'IF', kaprodi_si: 'SI', kaprodi_dkv: 'DKV', kaprodi_ka: 'KA' }
const LABEL_ROLE = { asessor: 'Asesor', ketua_tim: 'Ketua Tim', kaprodi_ti: 'Koordinator Prodi', kaprodi_si: 'Koordinator Prodi', kaprodi_dkv: 'Koordinator Prodi', kaprodi_ka: 'Koordinator Prodi' }
const LABEL_PERAN = Object.fromEntries(PERAN_PENUGASAN.map((x) => [x.v, x.l]))
const BELUM_BOLEH = ['diajukan', 'dikembalikan_sekretariat', 'dibatalkan', 'tidak_memenuhi_syarat']

export default function TabAsesor({ p }) {
  const { data, peta, bisaTugaskan, ubah, gantiPengajuan } = useTim()
  const prodi = peta.prodi[p.prodi_pilihan_id]
  const tugas = data.penugasan.filter((a) => a.pengajuan_id === p.id)
  const [asesor, setAsesor] = useState('')
  const [peran, setPeran] = useState(tugas.length ? 'anggota' : 'koordinator')
  const [sibuk, setSibuk] = useState(null)
  const [cabut, setCabut] = useState(null)

  const kandidat = useMemo(() => {
    const sudah = new Set(tugas.map((a) => a.asesor_id))
    const semua = data.staf.filter((s) => api.PERAN_ASESOR.includes(s.role) && !sudah.has(s.id))
    const prodiIni = (s) => s.prodi_id === p.prodi_pilihan_id || KODE_PERAN[s.role] === prodi?.kode
    return { ini: semua.filter(prodiIni), lain: semua.filter((s) => !prodiIni(s)) }
  }, [data.staf, tugas, p.prodi_pilihan_id, prodi?.kode])

  const tambah = async () => {
    setSibuk('tambah')
    try {
      const baru = await api.tugaskanAsesor(p.id, asesor, peran)
      ubah((d) => ({ penugasan: [...d.penugasan, baru] }))
      setAsesor(''); setPeran('anggota')
      toast.success('Asesor ditugaskan')
    } catch (e) { toast.error(e.message) } finally { setSibuk(null) }
  }
  const hapus = async () => {
    setSibuk('hapus')
    try {
      await api.cabutAsesor(p.id, cabut.asesor_id)
      ubah((d) => ({ penugasan: d.penugasan.filter((a) => !(a.pengajuan_id === p.id && a.asesor_id === cabut.asesor_id)) }))
      setCabut(null)
      toast.success('Penugasan dicabut')
    } catch (e) { toast.error(e.message) } finally { setSibuk(null) }
  }
  const mulai = async () => {
    setSibuk('mulai')
    try {
      gantiPengajuan(await api.ubahPengajuan(p.id, { status: 'asesmen' }))
      toast.success('Asesmen dimulai. Asesor dapat menilai pengajuan ini.')
    } catch (e) { toast.error(e.message) } finally { setSibuk(null) }
  }

  const belumBoleh = BELUM_BOLEH.includes(p.status)
  const nama = (s) => s?.nama_lengkap || s?.email || 'Tanpa nama'
  const opsi = (s) => <option key={s.id} value={s.id}>{nama(s)} · {LABEL_ROLE[s.role]}{peta.prodi[s.prodi_id] ? ` ${peta.prodi[s.prodi_id].kode}` : KODE_PERAN[s.role] ? ` ${KODE_PERAN[s.role]}` : ''}</option>

  return (
    <>
      {belumBoleh ? <Pemberitahuan jenis="indigo">Asesor ditugaskan setelah Sekretariat menyatakan berkas lengkap.</Pemberitahuan> : null}
      {!bisaTugaskan && !belumBoleh ? <Pemberitahuan jenis="indigo">Penugasan Tim Penilai dilakukan Ketua Tim Pengelola RPL (Pedoman 2.7). Anda dapat melihat susunan asesor di sini.</Pemberitahuan> : null}

      <Kartu judul="Tim penilai untuk pengajuan ini" sub={`${prodi?.nama || ''} · koordinator asesor memimpin penilaian dan pleno prodi`} padat>
        {tugas.length ? (
          <ul className="tm-daftar">
            {tugas.map((a) => {
              const s = peta.staf[a.asesor_id]
              return (
                <li key={a.asesor_id} className="tm-baris">
                  <span className="pm-avatar" aria-hidden="true">{nama(s).split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</span>
                  <div className="pm-grow">
                    <div className="pm-tebal">{nama(s)}</div>
                    <div className="pm-kecil">{s?.email}{a.created_at ? ` · ditugaskan ${tanggal(a.created_at)}` : ''}{peta.staf[a.ditugaskan_oleh] ? ` oleh ${peta.staf[a.ditugaskan_oleh].nama_lengkap}` : ''}</div>
                  </div>
                  <Lencana warna={a.peran === 'koordinator' ? 'indigo' : a.peran === 'praktisi' ? 'amber' : 'slate'}>{LABEL_PERAN[a.peran]}</Lencana>
                  {bisaTugaskan ? <button type="button" className="btn btn-ghost btn-icon" aria-label={`Cabut ${nama(s)}`} onClick={() => setCabut(a)}><Trash2 size={14} /></button> : null}
                </li>
              )
            })}
          </ul>
        ) : <p className="pm-kosong">Belum ada asesor yang ditugaskan.</p>}
      </Kartu>

      {bisaTugaskan && !belumBoleh ? (
        <Kartu judul="Tugaskan asesor" kaki={<Tombol jenis="primary" ikon={UserPlus} disabled={!asesor} sibuk={sibuk === 'tambah'} onClick={tambah}>Tugaskan</Tombol>}>
          <div className="pm-form-2">
            <Bidang label="Asesor" hint={kandidat.ini.length ? null : 'Belum ada asesor yang terdaftar untuk prodi ini. Atur prodi akun asesor di Manajemen Pengguna.'}>
              <select className="input" value={asesor} onChange={(e) => setAsesor(e.target.value)}>
                <option value="">Pilih asesor</option>
                {kandidat.ini.length ? <optgroup label={`Program studi ${prodi?.nama || ''}`}>{kandidat.ini.map(opsi)}</optgroup> : null}
                {kandidat.lain.length ? <optgroup label="Program studi lain">{kandidat.lain.map(opsi)}</optgroup> : null}
              </select>
            </Bidang>
            <Bidang label="Peran dalam tim">
              <select className="input" value={peran} onChange={(e) => setPeran(e.target.value)}>
                {PERAN_PENUGASAN.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}
              </select>
            </Bidang>
          </div>
        </Kartu>
      ) : null}

      {p.status === 'terverifikasi' && bisaTugaskan ? (
        <BarTahap info={tugas.length ? `${tugas.length} asesor ditugaskan` : 'Tugaskan minimal satu asesor'}>
          <Tombol jenis="primary" ikon={PlayCircle} disabled={!tugas.length} sibuk={sibuk === 'mulai'} onClick={mulai}>Mulai asesmen</Tombol>
        </BarTahap>
      ) : null}

      <Dialog buka={!!cabut} judul="Cabut penugasan asesor" onTutup={() => setCabut(null)}
        kaki={<><Tombol onClick={() => setCabut(null)}>Batal</Tombol><Tombol jenis="danger" sibuk={sibuk === 'hapus'} onClick={hapus}>Cabut</Tombol></>}>
        <p><b>{nama(peta.staf[cabut?.asesor_id])}</b> tidak lagi dapat menilai pengajuan ini. Penilaian yang sudah diisi tetap tersimpan.</p>
      </Dialog>
    </>
  )
}

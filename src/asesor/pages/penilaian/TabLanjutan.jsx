// Penilaian lanjutan: wawancara (wajib untuk perolehan), unjuk kerja, uji tulis.
// Lembar F10 per mata kuliah per jadwal (Juknis II.D.2.c.4-7).
import { useMemo, useState } from 'react'
import { CircleCheck, ExternalLink, Plus, Save, Trash2, UserX } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAsesor } from '../../AsesorData'
import * as api from '../../api'
import { daftarSubCpmk } from '../../aturan'
import { JENIS_ASESMEN, STATUS_JADWAL, TAHAP_JADWAL } from '../../../tim/aturan'
import { tanggal } from '../../../pemohon/konstanta'
import { Bidang, Dialog, Kartu, Lencana, Pemberitahuan, PilihSegmen, Tombol } from '../../../pemohon/ui'

const LABEL_JENIS = Object.fromEntries(JENIS_ASESMEN.map((j) => [j.v, j.l]))
const LABEL_TAHAP = Object.fromEntries(TAHAP_JADWAL.map((j) => [j.v, j.l]))
const HASIL = [{ v: 'memenuhi', l: 'Memenuhi' }, { v: 'belum_memenuhi', l: 'Belum memenuhi' }]
const HASIL_BUTIR = [{ v: 'memenuhi', l: 'Memenuhi' }, { v: 'belum_memenuhi', l: 'Belum' }]

function LembarF10({ p, j, mk, ada, boleh }) {
  const { ubahDetail } = useAsesor()
  const sub = useMemo(() => daftarSubCpmk(mk), [mk])
  const awal = useMemo(() => ({
    butir: (ada?.butir?.length ? ada.butir : sub.map((s) => ({ sub_cpmk: s.kode, pertanyaan: '', ringkasan_jawaban: '', hasil: '' }))),
    hasil: ada?.hasil || '', perlu_bukti_tambahan: !!ada?.perlu_bukti_tambahan, bukti_tambahan_diminta: ada?.bukti_tambahan_diminta || '', catatan: ada?.catatan || '',
  }), [ada, sub])
  const [f, setF] = useState(awal)
  const [sibuk, setSibuk] = useState(false)
  const kotor = JSON.stringify(f) !== JSON.stringify(awal)
  const ubahButir = (i, nilai) => setF((s) => ({ ...s, butir: s.butir.map((b, k) => (k === i ? { ...b, ...nilai } : b)) }))

  const simpan = async () => {
    if (!f.hasil) { toast.error('Pilih hasil untuk mata kuliah ini'); return }
    setSibuk(true)
    try {
      const hasil = await api.simpanLanjutan({
        jadwal_id: j.id, pengajuan_id: p.id, mk_id: mk.id,
        butir: f.butir.filter((b) => b.pertanyaan.trim() || b.ringkasan_jawaban.trim()).map((b) => ({ ...b, pertanyaan: b.pertanyaan.trim(), ringkasan_jawaban: b.ringkasan_jawaban.trim() })),
        hasil: f.hasil, perlu_bukti_tambahan: f.perlu_bukti_tambahan,
        bukti_tambahan_diminta: f.perlu_bukti_tambahan ? (f.bukti_tambahan_diminta.trim() || null) : null,
        catatan: f.catatan.trim() || null,
      })
      ubahDetail(p.id, (x) => ({ lanjutan: [...(x.lanjutan || []).filter((r) => r.id !== hasil.id), hasil] }))
      toast.success(`Lembar penilaian ${mk.nama_mk} disimpan`)
    } catch (e) { toast.error(e.message, { duration: 6000 }) } finally { setSibuk(false) }
  }

  return (
    <details className="as-f10" open={!ada && boleh}>
      <summary>
        <span className="pm-tebal pm-grow">{mk.nama_mk}</span>
        <span className="pm-kecil">{mk.sks} SKS</span>
        {ada?.hasil ? <Lencana warna={ada.hasil === 'memenuhi' ? 'green' : 'red'}>{ada.hasil === 'memenuhi' ? 'Memenuhi' : 'Belum memenuhi'}</Lencana> : <Lencana>Belum diisi</Lencana>}
      </summary>
      <div className="as-f10-isi">
        <div className="table-wrap">
          <table className="pm-tabel as-tabel-f10">
            <thead><tr><th style={{ width: 140 }}>Butir</th><th>Pertanyaan / tugas</th><th>Ringkasan jawaban / unjuk kerja</th><th style={{ width: 196 }}>Hasil</th>{boleh ? <th style={{ width: 44 }}><span className="pm-sr">Hapus</span></th> : null}</tr></thead>
            <tbody>
              {f.butir.map((b, i) => (
                <tr key={i}>
                  <td data-label="Butir">
                    <select className="input" value={b.sub_cpmk || ''} disabled={!boleh} onChange={(e) => ubahButir(i, { sub_cpmk: e.target.value })} aria-label="Sub-CPMK">
                      <option value="">Umum</option>
                      {sub.map((s) => <option key={s.kode} value={s.kode}>{s.kode}</option>)}
                    </select>
                  </td>
                  <td data-label="Pertanyaan"><textarea className="input" rows={2} value={b.pertanyaan} disabled={!boleh} onChange={(e) => ubahButir(i, { pertanyaan: e.target.value })} aria-label="Pertanyaan" placeholder={sub.find((s) => s.kode === b.sub_cpmk)?.deskripsi?.slice(0, 80) || ''} /></td>
                  <td data-label="Jawaban"><textarea className="input" rows={2} value={b.ringkasan_jawaban} disabled={!boleh} onChange={(e) => ubahButir(i, { ringkasan_jawaban: e.target.value })} aria-label="Ringkasan jawaban" /></td>
                  <td data-label="Hasil"><PilihSegmen pilihan={HASIL_BUTIR} nilai={b.hasil} onUbah={(v) => ubahButir(i, { hasil: v })} nonaktif={!boleh} label="Hasil butir" /></td>
                  {boleh ? <td data-label=""><button type="button" className="btn btn-ghost btn-icon" aria-label="Hapus butir" onClick={() => setF((s) => ({ ...s, butir: s.butir.filter((_, k) => k !== i) }))}><Trash2 size={14} /></button></td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {boleh ? <div><Tombol ikon={Plus} onClick={() => setF((s) => ({ ...s, butir: [...s.butir, { sub_cpmk: '', pertanyaan: '', ringkasan_jawaban: '', hasil: '' }] }))}>Tambah butir</Tombol></div> : null}
        <div className="pm-form-2">
          <Bidang label="Hasil mata kuliah" wajib><PilihSegmen pilihan={HASIL} nilai={f.hasil} onUbah={(v) => setF((s) => ({ ...s, hasil: v }))} nonaktif={!boleh} label="Hasil mata kuliah" /></Bidang>
          <Bidang label="Bukti tambahan">
            <label className="pm-centang"><input type="checkbox" checked={f.perlu_bukti_tambahan} disabled={!boleh} onChange={(e) => setF((s) => ({ ...s, perlu_bukti_tambahan: e.target.checked }))} /> Perlu bukti tambahan</label>
          </Bidang>
          {f.perlu_bukti_tambahan ? (
            <Bidang label="Bukti yang diminta" lebar hint="Kirim permintaan ke pemohon dari tab Ringkasan dan pleno">
              <input className="input" value={f.bukti_tambahan_diminta} disabled={!boleh} onChange={(e) => setF((s) => ({ ...s, bukti_tambahan_diminta: e.target.value }))} />
            </Bidang>
          ) : null}
          <Bidang label="Catatan asesor" lebar><textarea className="input" rows={2} value={f.catatan} disabled={!boleh} onChange={(e) => setF((s) => ({ ...s, catatan: e.target.value }))} /></Bidang>
        </div>
        {boleh ? <div className="pm-baris-aksi"><Tombol jenis="primary" ikon={Save} sibuk={sibuk} disabled={!kotor && !!ada} onClick={simpan}>Simpan lembar penilaian</Tombol></div> : null}
      </div>
    </details>
  )
}

export default function TabLanjutan({ p, d, bolehNilai, tugas }) {
  const { data, ubah, role } = useAsesor()
  const [catat, setCatat] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  const jadwal = data.jadwal.filter((j) => j.pengajuan_id === p.id).sort((a, b) => new Date(b.waktu) - new Date(a.waktu))
  const bolehCatat = !!tugas || role === 'admin'
  const kini = Date.now()
  const perolehanTanpa = d.mkDiajukan.filter((m) => m.mekanisme === 'perolehan'
    && !jadwal.some((j) => j.jenis === 'wawancara' && j.status === 'selesai' && (j.mk_ids || []).includes(m.mk_id)))

  const simpanCatatan = async () => {
    setSibuk(true)
    try {
      const hasil = await api.catatJadwal(catat.j.id, { status: catat.status, hasil: catat.hasil.trim() || null, catatan_kehadiran: catat.status === 'tidak_hadir' ? (catat.hasil.trim() || null) : null })
      ubah((x) => ({ jadwal: x.jadwal.map((r) => (r.id === hasil.id ? hasil : r)) }))
      toast.success(catat.status === 'selesai' ? 'Jadwal ditandai selesai' : 'Ketidakhadiran dicatat')
      setCatat(null)
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <div className="pm-tumpuk-besar">
      {perolehanTanpa.length ? (
        <Pemberitahuan jenis="amber" judul={`${perolehanTanpa.length} mata kuliah perolehan belum diwawancarai`}>
          Wawancara wajib untuk perolehan kredit sebelum pleno hasil rekognisi. Jadwal dibuat Sekretariat RPL; tandai selesai setelah wawancara berlangsung.
        </Pemberitahuan>
      ) : null}
      {!jadwal.length ? <Kartu><p className="pm-kosong">Belum ada jadwal asesmen untuk pengajuan ini.</p></Kartu> : null}
      {jadwal.map((j) => {
        const st = STATUS_JADWAL[j.status] || { label: j.status, warna: 'slate' }
        const lewat = new Date(j.waktu).getTime() <= kini
        const mkJadwal = (j.mk_ids || []).map((id) => d.mataKuliah.find((x) => x.id === id)).filter(Boolean)
        const bolehF10 = bolehNilai && (j.status === 'selesai' || (j.status === 'dijadwalkan' && lewat))
        return (
          <Kartu key={j.id} judul={`${LABEL_JENIS[j.jenis] || j.jenis} · ${tanggal(j.waktu, true)} WIB`}
            sub={<>{LABEL_TAHAP[j.tahap] || j.tahap} · {j.durasi_menit || 60} menit · {j.mode === 'daring' ? 'Daring' : `Luring, ${j.ruangan || '-'}`}{j.konfirmasi_hadir_at ? ' · pemohon sudah konfirmasi hadir' : ''}</>}
            aksi={<div className="pm-baris-aksi">
              <Lencana warna={st.warna}>{st.label}</Lencana>
              {j.mode === 'daring' && j.tautan_undangan && j.status === 'dijadwalkan' ? <a className="btn btn-secondary btn-sm" href={j.tautan_undangan} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Buka Meet</a> : null}
            </div>}>
            <div className="pm-tumpuk-besar">
              {j.hasil ? <p className="pm-kecil"><b>Catatan pelaksanaan:</b> {j.hasil}</p> : null}
              {bolehCatat && j.status === 'dijadwalkan' ? (
                lewat ? (
                  <div className="pm-baris-aksi">
                    <Tombol jenis="primary" ikon={CircleCheck} onClick={() => setCatat({ j, status: 'selesai', hasil: '' })}>Tandai selesai</Tombol>
                    <Tombol ikon={UserX} onClick={() => setCatat({ j, status: 'tidak_hadir', hasil: '' })}>Pemohon tidak hadir</Tombol>
                  </div>
                ) : <p className="pm-kecil">Lembar penilaian dapat diisi setelah jadwal berlangsung.</p>
              ) : null}
              {mkJadwal.length ? mkJadwal.map((mk) => (
                <LembarF10 key={mk.id} p={p} j={j} mk={mk} ada={d.lanjutan.find((x) => x.jadwal_id === j.id && x.mk_id === mk.id)} boleh={bolehF10} />
              )) : <p className="pm-kecil">Jadwal ini tidak menyebutkan mata kuliah.</p>}
            </div>
          </Kartu>
        )
      })}
      <Dialog buka={!!catat} judul={catat?.status === 'selesai' ? 'Tandai jadwal selesai' : 'Catat ketidakhadiran'} onTutup={() => setCatat(null)}
        kaki={<><Tombol onClick={() => setCatat(null)}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk} onClick={simpanCatatan}>Simpan</Tombol></>}>
        <Bidang label={catat?.status === 'selesai' ? 'Catatan pelaksanaan (opsional)' : 'Keterangan'} hint={catat?.status === 'selesai' ? 'Mis. wawancara berjalan 45 menit melalui Google Meet.' : 'Sekretariat akan menjadwalkan ulang.'}>
          <textarea className="input" rows={3} value={catat?.hasil || ''} onChange={(e) => setCatat((s) => ({ ...s, hasil: e.target.value }))} />
        </Bidang>
      </Dialog>
    </div>
  )
}

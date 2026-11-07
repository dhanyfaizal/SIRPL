import { useEffect, useMemo, useState } from 'react'
import { Check, CornerUpLeft, ExternalLink, Save, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTim } from '../../TimData'
import * as api from '../../api'
import { butirPeriksa, catatanPerbaikan, gabungPeriksa } from '../../aturan'
import { KATEGORI_RIWAYAT, LABEL_BUKTI, STATUS_PDDIKTI, tanggal } from '../../../pemohon/konstanta'
import { mkTertutup } from '../../../pemohon/kelengkapan'
import { BarTahap, Bidang, BukaBerkas, Dialog, Kartu, Lencana, Pemberitahuan, PilihSegmen, Tombol } from '../../../pemohon/ui'

const PILIH_SESUAI = [{ v: 'ya', l: 'Sesuai' }, { v: 'tidak', l: 'Perlu perbaikan' }]
const PILIH_YA = [{ v: 'ya', l: 'Sesuai' }, { v: 'tidak', l: 'Tidak sesuai' }]
const STATUS_KERJA = { pegawai_tetap: 'Pegawai tetap', pegawai_honorer: 'Pegawai honorer', pns: 'PNS', tidak_bekerja: 'Tidak bekerja' }
const keNilai = (b) => (b === true ? 'ya' : b === false ? 'tidak' : null)

function DaftarPeriksa({ p, d, children }) {
  const { bisaVerifikasi, ubahDetail, gantiPengajuan, peta } = useTim()
  const butir = useMemo(() => butirPeriksa(p, d), [p, d])
  const [periksa, setPeriksa] = useState(() => gabungPeriksa(butir, d.verBerkas))
  const [catatan, setCatatan] = useState(d.verBerkas?.catatan || '')
  const [ubah, setUbah] = useState(false)
  const [sibuk, setSibuk] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [teks, setTeks] = useState('')
  useEffect(() => { setPeriksa(gabungPeriksa(butir, d.verBerkas)); setCatatan(d.verBerkas?.catatan || ''); setUbah(false) }, [butir, d.verBerkas])

  const bolehUbah = bisaVerifikasi && p.status === 'diajukan'
  const atur = (kode, nilai) => { setUbah(true); setPeriksa((s) => s.map((x) => (x.kode === kode ? { ...x, ...nilai } : x))) }
  const belum = periksa.filter((x) => x.sesuai === null).length
  const perbaikan = periksa.filter((x) => x.sesuai === false)
  const semuaSesuai = !belum && !perbaikan.length

  const simpan = async () => {
    const isi = periksa.map(({ kode, label, sesuai, catatan: c }) => ({ kode, label, sesuai, catatan: c || null }))
    const hasil = await api.simpanVerifikasiBerkas(p.id, isi, catatan.trim())
    ubahDetail(p.id, () => ({ verBerkas: hasil }))
    setUbah(false)
    return hasil
  }
  const jalankan = async (jenis, fn) => {
    setSibuk(jenis)
    try { await fn() } catch (e) { toast.error(e.message, { duration: 7000 }) } finally { setSibuk(null) }
  }
  const ubahStatus = async (status, catatanRevisi) => {
    await simpan()
    const baru = await api.ubahPengajuan(p.id, { status, catatan_revisi: catatanRevisi })
    gantiPengajuan(baru)
    setDialog(null)
  }

  const pemeriksa = d.verBerkas?.diperiksa_oleh ? peta.staf[d.verBerkas.diperiksa_oleh]?.nama_lengkap : null
  return (
    <>
      <Kartu judul="Daftar periksa kelengkapan berkas"
        sub={d.verBerkas ? `Terakhir diperiksa ${tanggal(d.verBerkas.diperiksa_at, true)}${pemeriksa ? ` oleh ${pemeriksa}` : ''}` : 'Periksa setiap butir, lalu nyatakan lengkap atau kembalikan ke pemohon.'}
        padat>
        <ol className="tm-periksa">
          {periksa.map((x) => (
            <li key={x.kode} className={x.sesuai === false ? 'is-salah' : x.sesuai ? 'is-ok' : ''}>
              <div className="tm-periksa-isi">
                <div className="tm-periksa-judul">
                  <span className="pm-tebal">{x.label}</span>
                  {!x.ada ? <Lencana warna="red">Belum diisi pemohon</Lencana> : null}
                </div>
                <div className="pm-kecil">{x.ket}</div>
                {x.path ? <div className="tm-periksa-berkas"><BukaBerkas path={x.path} label="Buka berkas" /></div> : null}
                {x.sesuai === false ? (
                  <input className="input tm-periksa-catatan" placeholder="Apa yang perlu diperbaiki pemohon?" value={x.catatan}
                    disabled={!bolehUbah} aria-label={`Catatan perbaikan ${x.label}`} onChange={(e) => atur(x.kode, { catatan: e.target.value })} />
                ) : null}
              </div>
              <PilihSegmen pilihan={PILIH_SESUAI} nilai={keNilai(x.sesuai)} nonaktif={!bolehUbah} label={`Hasil periksa ${x.label}`}
                onUbah={(v) => atur(x.kode, { sesuai: v === 'ya' })} />
            </li>
          ))}
        </ol>
        <div className="tm-periksa-kaki">
          <Bidang label="Catatan internal (tidak tampil ke pemohon)">
            <textarea className="input" rows={2} value={catatan} disabled={!bolehUbah} onChange={(e) => { setUbah(true); setCatatan(e.target.value) }} />
          </Bidang>
        </div>
      </Kartu>

      {p.status === 'dikembalikan_sekretariat' && p.catatan_revisi ? (
        <Pemberitahuan jenis="amber" judul="Catatan yang dikirim ke pemohon"><div className="tm-pre">{p.catatan_revisi}</div></Pemberitahuan>
      ) : null}
      {p.status === 'tidak_memenuhi_syarat' && p.catatan_revisi ? (
        <Pemberitahuan jenis="red" judul="Alasan tidak memenuhi syarat"><div className="tm-pre">{p.catatan_revisi}</div></Pemberitahuan>
      ) : null}

      {children}

      {bolehUbah ? (
        <BarTahap info={belum ? `${belum} butir belum diperiksa` : perbaikan.length ? `${perbaikan.length} butir perlu perbaikan` : 'Semua butir sesuai'}>
          <button type="button" className="btn btn-ghost" onClick={() => { setTeks(''); setDialog('tolak') }}>Tidak memenuhi syarat</button>
          {ubah ? <Tombol ikon={Save} sibuk={sibuk === 'simpan'} onClick={() => jalankan('simpan', async () => { await simpan(); toast.success('Hasil pemeriksaan disimpan') })}>Simpan</Tombol> : null}
          <Tombol ikon={CornerUpLeft} disabled={!perbaikan.length} onClick={() => { setTeks(catatanPerbaikan(periksa)); setDialog('kembali') }}>Kembalikan ke pemohon</Tombol>
          <Tombol jenis="primary" ikon={Check} disabled={!semuaSesuai} sibuk={sibuk === 'lengkap'}
            onClick={() => jalankan('lengkap', async () => { await ubahStatus('terverifikasi', null); toast.success('Berkas dinyatakan lengkap') })}>Nyatakan lengkap</Tombol>
        </BarTahap>
      ) : null}

      <Dialog buka={dialog === 'kembali'} judul="Kembalikan ke pemohon" lebar={560} onTutup={() => setDialog(null)}
        kaki={<><Tombol onClick={() => setDialog(null)}>Batal</Tombol>
          <Tombol jenis="primary" ikon={CornerUpLeft} sibuk={sibuk === 'kembali'} disabled={!teks.trim()}
            onClick={() => jalankan('kembali', async () => { await ubahStatus('dikembalikan_sekretariat', teks.trim()); toast.success('Pengajuan dikembalikan ke pemohon') })}>Kembalikan</Tombol></>}>
        <p>Pemohon dapat memperbaiki data dan berkas, lalu mengirim ulang. Catatan berikut tampil di beranda pemohon.</p>
        <Bidang label="Catatan untuk pemohon">
          <textarea className="input" rows={6} value={teks} onChange={(e) => setTeks(e.target.value)} />
        </Bidang>
      </Dialog>
      <Dialog buka={dialog === 'tolak'} judul="Nyatakan tidak memenuhi syarat" lebar={560} onTutup={() => setDialog(null)}
        kaki={<><Tombol onClick={() => setDialog(null)}>Batal</Tombol>
          <Tombol jenis="danger" sibuk={sibuk === 'tolak'} disabled={!teks.trim()}
            onClick={() => jalankan('tolak', async () => { await ubahStatus('tidak_memenuhi_syarat', teks.trim()); toast.success('Pengajuan dinyatakan tidak memenuhi syarat') })}>Nyatakan tidak memenuhi syarat</Tombol></>}>
        <Pemberitahuan jenis="red">Pengajuan berhenti dan tidak dapat dikirim ulang. Gunakan hanya bila syarat Juknis tidak terpenuhi, misalnya status di PDDikti tidak memenuhi ketentuan.</Pemberitahuan>
        <Bidang label="Alasan (tampil ke pemohon)">
          <textarea className="input" rows={4} value={teks} onChange={(e) => setTeks(e.target.value)} />
        </Bidang>
      </Dialog>
    </>
  )
}

function KartuPddikti({ p, d }) {
  const { bisaVerifikasi, ubahDetail, peta } = useTim()
  const v = d.verPddikti
  const [f, setF] = useState(() => ({ ijazah_sesuai: v?.ijazah_sesuai ?? null, transkrip_sesuai: v?.transkrip_sesuai ?? null,
    status_mahasiswa_pddikti: v?.status_mahasiswa_pddikti || p.status_pddikti_asal || '', tautan_bukti: v?.tautan_bukti || '', catatan: v?.catatan || '' }))
  const [sibuk, setSibuk] = useState(false)
  const boleh = bisaVerifikasi && !['selesai', 'dibatalkan', 'tidak_memenuhi_syarat'].includes(p.status)
  const simpan = async () => {
    if (f.tautan_bukti && !/^https:\/\//i.test(f.tautan_bukti)) { toast.error('Tautan bukti harus diawali https://'); return }
    setSibuk(true)
    try {
      const hasil = await api.simpanVerifikasiPddikti(p.id, { ...f, tautan_bukti: f.tautan_bukti || null, catatan: f.catatan || null, status_mahasiswa_pddikti: f.status_mahasiswa_pddikti || null })
      ubahDetail(p.id, () => ({ verPddikti: hasil }))
      toast.success('Hasil cek PDDikti disimpan')
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }
  return (
    <Kartu judul="Cek keaslian di PDDikti" sub={v ? `Diperiksa ${tanggal(v.diperiksa_at, true)}${peta.staf[v.diperiksa_oleh] ? ` oleh ${peta.staf[v.diperiksa_oleh].nama_lengkap}` : ''}` : 'Juknis II.D.2.b: ijazah dan transkrip dicocokkan dengan PDDikti'}
      aksi={<a className="btn btn-ghost btn-sm" href="https://pddikti.kemdiktisaintek.go.id" target="_blank" rel="noreferrer"><ExternalLink size={13} /> Buka PDDikti</a>}
      kaki={boleh ? <Tombol jenis="primary" ikon={Save} sibuk={sibuk} onClick={simpan}>Simpan hasil cek</Tombol> : null}>
      <div className="pm-form-2">
        <Bidang label="Ijazah perguruan tinggi asal">
          <PilihSegmen pilihan={PILIH_YA} nilai={keNilai(f.ijazah_sesuai)} nonaktif={!boleh} label="Ijazah sesuai PDDikti" onUbah={(x) => setF((s) => ({ ...s, ijazah_sesuai: x === 'ya' }))} />
        </Bidang>
        <Bidang label="Transkrip nilai">
          <PilihSegmen pilihan={PILIH_YA} nilai={keNilai(f.transkrip_sesuai)} nonaktif={!boleh} label="Transkrip sesuai PDDikti" onUbah={(x) => setF((s) => ({ ...s, transkrip_sesuai: x === 'ya' }))} />
        </Bidang>
        <Bidang label="Status mahasiswa menurut PDDikti" hint={p.status_pddikti_asal ? `Diisi pemohon: ${STATUS_PDDIKTI[p.status_pddikti_asal]}` : null}>
          <select className="input" value={f.status_mahasiswa_pddikti} disabled={!boleh} onChange={(e) => setF((s) => ({ ...s, status_mahasiswa_pddikti: e.target.value }))}>
            <option value="">Pilih status</option>
            {Object.entries(STATUS_PDDIKTI).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Bidang>
        <Bidang label="Tautan halaman PDDikti" hint="Opsional, untuk arsip.">
          <input className="input" type="url" placeholder="https://pddikti.kemdiktisaintek.go.id/..." value={f.tautan_bukti} disabled={!boleh} onChange={(e) => setF((s) => ({ ...s, tautan_bukti: e.target.value }))} />
        </Bidang>
        <Bidang label="Catatan" lebar>
          <textarea className="input" rows={2} value={f.catatan} disabled={!boleh} onChange={(e) => setF((s) => ({ ...s, catatan: e.target.value }))} />
        </Bidang>
      </div>
    </Kartu>
  )
}

function Baris({ l, v }) {
  return <div className="tm-dl-baris"><dt>{l}</dt><dd>{v || '-'}</dd></div>
}

export default function TabBerkas({ p, d }) {
  const transfer = ['transfer', 'gabungan'].includes(p.jenis_rpl)
  const b = d.biodata || {}
  const r = d.riwayat || {}
  const mk = d.mkDiajukan.map((m) => ({ ...m, mk: d.mataKuliah.find((x) => x.id === m.mk_id) })).filter((m) => m.mk)
  const sks = (mek) => mk.filter((m) => m.mekanisme === mek).reduce((n, m) => n + m.mk.sks, 0)
  const hitungRiwayat = Object.fromEntries(KATEGORI_RIWAYAT.map((k) => [k.v, d.butirRiwayat.filter((x) => x.kategori === k.v).length]))

  return (
    <>
      <DaftarPeriksa p={p} d={d}>

      <div className="tm-dua">
        <Kartu judul="Data pribadi (F02)">
          <dl className="tm-dl">
            <Baris l="Tempat, tanggal lahir" v={b.tempat_lahir ? `${b.tempat_lahir}, ${tanggal(b.tanggal_lahir)}` : null} />
            <Baris l="Jenis kelamin" v={b.jenis_kelamin === 'pria' ? 'Pria' : b.jenis_kelamin === 'wanita' ? 'Wanita' : null} />
            <Baris l="Kewarganegaraan" v={b.kewarganegaraan} />
            <Baris l="Agama" v={b.agama} />
            <Baris l="Alamat" v={[b.alamat, b.kode_pos].filter(Boolean).join(' ')} />
            <Baris l="Pendidikan terakhir" v={[b.pendidikan_terakhir, b.nama_sekolah_pt, b.tahun_lulus].filter(Boolean).join(' · ')} />
          </dl>
        </Kartu>
        <Kartu judul={transfer ? 'Perguruan tinggi asal dan pekerjaan' : 'Pekerjaan (F07)'}>
          <dl className="tm-dl">
            {transfer ? <>
              <Baris l="Perguruan tinggi asal" v={p.pt_asal} />
              <Baris l="Program studi asal" v={p.prodi_asal} />
              <Baris l="Status di PT asal" v={STATUS_PDDIKTI[p.status_pddikti_asal]} />
              {p.tanggal_mengundurkan_diri ? <Baris l="Tanggal keluar" v={tanggal(p.tanggal_mengundurkan_diri)} /> : null}
            </> : null}
            <Baris l="Institusi kerja" v={r.institusi_kerja} />
            <Baris l="Jabatan" v={r.jabatan} />
            <Baris l="Status pekerjaan" v={STATUS_KERJA[r.status_pekerjaan] || r.status_pekerjaan_lainnya || r.status_pekerjaan} />
            <Baris l="Isian riwayat hidup" v={KATEGORI_RIWAYAT.filter((k) => hitungRiwayat[k.v]).map((k) => `${k.l.split(' /')[0]} ${hitungRiwayat[k.v]}`).join(' · ')} />
          </dl>
        </Kartu>
      </div>

      {transfer ? <KartuPddikti p={p} d={d} /> : null}

      <Kartu judul="Mata kuliah yang diajukan" sub={`Transfer ${sks('transfer')} SKS · Perolehan ${sks('perolehan')} SKS`} padat>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr><th style={{ width: 110 }}>Kode</th><th>Mata kuliah</th><th style={{ width: 60 }}>SKS</th><th style={{ width: 70 }}>Smt</th><th style={{ width: 130 }}>Mekanisme</th><th style={{ width: 140 }}>F03</th></tr></thead>
            <tbody>
              {mk.map((m) => {
                const ev = d.evaluasi.find((e) => e.mk_id === m.mk_id)
                return (
                  <tr key={m.mk_id}>
                    <td className="pm-kecil" data-label="Kode">{m.mk.kode_mk}</td>
                    <td data-label="Mata kuliah">{m.mk.nama_mk}{mkTertutup(m.mk) ? <> <Lencana warna="red">Ditutup</Lencana></> : null}</td>
                    <td data-label="SKS">{m.mk.sks}</td><td data-label="Semester">{m.mk.semester}</td>
                    <td data-label="Mekanisme">{m.mekanisme === 'transfer' ? 'Transfer' : 'Perolehan'}</td>
                    <td data-label="F03">{m.mekanisme === 'transfer' ? <span className="pm-kecil">Tidak perlu</span>
                      : ev?.pernyataan_setuju ? <Lencana warna="green">{(ev.butir || []).length} butir terisi</Lencana> : <Lencana warna="amber">Belum</Lencana>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!mk.length ? <p className="pm-kosong">Belum ada mata kuliah.</p> : null}
        </div>
      </Kartu>

      <Kartu judul="Bukti portofolio" sub={`${d.bukti.length} bukti`} padat>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr><th style={{ width: 60 }}>No.</th><th>Dokumen</th><th style={{ width: 220 }}>Jenis</th><th style={{ width: 130 }}>Disahkan atasan</th><th style={{ width: 110 }}><span className="pm-sr">Berkas</span></th></tr></thead>
            <tbody>
              {d.bukti.map((x) => (
                <tr key={x.id}>
                  <td data-label="No.">{x.nomor}</td>
                  <td data-label="Dokumen"><div className="pm-tebal">{x.nama_dokumen}</div>{x.deskripsi ? <div className="pm-kecil">{x.deskripsi}</div> : null}</td>
                  <td data-label="Jenis" className="pm-kecil">{LABEL_BUKTI[x.jenis] || x.jenis}</td>
                  <td data-label="Disahkan">{x.disahkan_atasan ? <Check size={15} className="pm-ok" aria-label="Ya" /> : <X size={15} className="pm-none" aria-label="Tidak" />}</td>
                  <td data-label="">{x.file_url ? <BukaBerkas path={x.file_url} /> : x.tautan ? <a className="btn btn-ghost btn-sm" href={x.tautan} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Tautan</a> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.bukti.length ? <p className="pm-kosong">Belum ada bukti.</p> : null}
        </div>
      </Kartu>
      </DaftarPeriksa>
    </>
  )
}

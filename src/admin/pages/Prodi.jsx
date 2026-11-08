// Pengaturan program studi: penyelenggaraan RPL, akreditasi, dan batas SKS.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAdmin, cek } from '../AdminData'
import { Bidang, Dialog, Halaman, InputAngka, Kartu, Kerangka, Lencana, Pemberitahuan, Tombol } from '../../pemohon/ui'

const AKREDITASI = ['Unggul', 'Baik Sekali', 'Baik', 'A', 'B', 'C', 'Terakreditasi', 'Belum terakreditasi']
const minimalBaikSekali = (a) => ['unggul', 'a', 'baik sekali', 'b'].includes((a || '').trim().toLowerCase())

// Cermin fungsi prodi_boleh_transfer dan prodi_boleh_perolehan di basis data.
export function kelayakan(x) {
  const akr = (x.akreditasi || '').trim().toLowerCase()
  const terakreditasi = !!akr && !['tidak terakreditasi', 'belum terakreditasi'].includes(akr)
  const transfer = x.is_penyelenggara_rpl && x.menerima_transfer_kredit && x.sudah_ada_lulusan && terakreditasi
  const perolehan = x.is_penyelenggara_rpl && x.menerima_perolehan_kredit && (minimalBaikSekali(x.akreditasi)
    || (akr === 'terakreditasi' && minimalBaikSekali(x.akreditasi_sebelumnya) && !!x.file_sk_akreditasi_sebelumnya_url))
  const alasan = []
  if (!x.is_penyelenggara_rpl) alasan.push('belum ditandai penyelenggara RPL')
  else {
    if (x.menerima_transfer_kredit && !transfer) alasan.push(!x.sudah_ada_lulusan ? 'transfer kredit memerlukan prodi yang sudah memiliki lulusan' : 'transfer kredit memerlukan prodi terakreditasi')
    if (x.menerima_perolehan_kredit && !perolehan) alasan.push(akr === 'terakreditasi' ? 'perolehan kredit memerlukan akreditasi sebelumnya minimal Baik Sekali/B beserta berkas SK-nya' : 'perolehan kredit memerlukan akreditasi minimal Baik Sekali/B')
  }
  return { transfer, perolehan, alasan }
}

function Sakelar({ label, ket, nilai, onUbah }) {
  return (
    <label className="ad-sakelar">
      <input type="checkbox" checked={!!nilai} onChange={(e) => onUbah(e.target.checked)} />
      <span><span className="pm-tebal">{label}</span>{ket ? <span className="pm-kecil">{ket}</span> : null}</span>
    </label>
  )
}

export default function Prodi() {
  const { siap, data, galat, muat } = useAdmin()
  const [ubah, setUbah] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  if (galat && !siap) return <Halaman judul="Program studi"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />

  const aktif = data.periode.find((p) => p.is_aktif)
  const persen = Math.min(Number(aktif?.batas_rekognisi_persen || 70), 70)
  const set = (k) => (v) => setUbah((s) => ({ ...s, [k]: v?.target ? v.target.value : v }))

  const simpan = async () => {
    const f = ubah
    if (!f.nama.trim() || !f.kode.trim()) { toast.error('Isi kode dan nama program studi'); return }
    if (!(Number(f.beban_sks_minimal) > 0)) { toast.error('Isi beban SKS minimal'); return }
    setSibuk(true)
    try {
      const isi = {
        kode: f.kode.trim(), nama: f.nama.trim(), jenjang: f.jenjang || 'S1', kode_pddikti: f.kode_pddikti || null,
        akreditasi: f.akreditasi || null, akreditasi_sebelumnya: f.akreditasi_sebelumnya || null,
        beban_sks_minimal: Number(f.beban_sks_minimal), maks_sks_rpl: f.maks_sks_rpl ? Number(f.maks_sks_rpl) : null,
        is_penyelenggara_rpl: !!f.is_penyelenggara_rpl, menerima_transfer_kredit: !!f.menerima_transfer_kredit, menerima_perolehan_kredit: !!f.menerima_perolehan_kredit,
        sudah_ada_lulusan: !!f.sudah_ada_lulusan, is_active: !!f.is_active,
      }
      cek(await supabase.from('program_studi').update(isi).eq('id', f.id))
      toast.success('Program studi disimpan')
      setUbah(null)
      await muat()
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Halaman judul="Program studi" sub={`Batas SKS yang dapat direkognisi adalah yang lebih kecil antara batas prodi dan ${persen}% beban belajar minimal (periode ${aktif?.nama || 'aktif'}).`}>
      <div className="ad-kisi">
        {data.prodi.map((x) => {
          const k = kelayakan(x)
          const batas = Math.min(x.maks_sks_rpl || Infinity, Math.floor((x.beban_sks_minimal || 0) * persen / 100))
          const mk = data.pengajuan.filter((p) => p.prodi_pilihan_id === x.id && p.status !== 'draft').length
          return (
            <Kartu key={x.id} judul={x.nama} sub={`${x.jenjang || 'S1'} · kode ${x.kode}${x.kode_pddikti ? ` · PDDikti ${x.kode_pddikti}` : ''}`}
              aksi={<button type="button" className="btn btn-ghost btn-icon" title="Ubah" aria-label={`Ubah ${x.nama}`} onClick={() => setUbah({ ...x, akreditasi: x.akreditasi || '', akreditasi_sebelumnya: x.akreditasi_sebelumnya || '', kode_pddikti: x.kode_pddikti || '', maks_sks_rpl: x.maks_sks_rpl ? String(x.maks_sks_rpl) : '', beban_sks_minimal: String(x.beban_sks_minimal || '') })}><Pencil size={15} /></button>}>
              <div className="pm-baris-aksi">
                {x.is_penyelenggara_rpl ? <Lencana warna="indigo">Penyelenggara RPL</Lencana> : <Lencana>Tidak membuka RPL</Lencana>}
                {!x.is_active ? <Lencana warna="red">Nonaktif</Lencana> : null}
                {x.akreditasi ? <Lencana warna="slate">Akreditasi {x.akreditasi}</Lencana> : <Lencana warna="amber">Akreditasi belum diisi</Lencana>}
              </div>
              <dl className="ad-dl">
                <dt>Beban belajar minimal</dt><dd>{x.beban_sks_minimal} SKS</dd>
                <dt>Batas rekognisi</dt><dd>{Number.isFinite(batas) ? `${batas} SKS` : '-'}{x.maks_sks_rpl ? '' : ' (dari persentase)'}</dd>
                <dt>Transfer kredit</dt><dd>{k.transfer ? <Lencana warna="green">Dibuka</Lencana> : <Lencana>Tidak</Lencana>}</dd>
                <dt>Perolehan kredit</dt><dd>{k.perolehan ? <Lencana warna="green">Dibuka</Lencana> : <Lencana>Tidak</Lencana>}</dd>
                <dt>Pengajuan</dt><dd>{mk}</dd>
              </dl>
              {k.alasan.length && x.is_penyelenggara_rpl ? <p className="pm-kecil ad-peringatan">Belum memenuhi: {k.alasan.join('; ')}.</p> : null}
            </Kartu>
          )
        })}
      </div>
      <p className="pm-kecil">Mata kuliah dan status RPL setiap mata kuliah diatur di <Link to="/kurikulum-rpl">Mata kuliah RPL</Link>.</p>

      <Dialog buka={!!ubah} judul={ubah ? `Ubah ${ubah.nama}` : ''} onTutup={() => setUbah(null)} lebar={620}
        kaki={<><Tombol onClick={() => setUbah(null)}>Batal</Tombol><Tombol jenis="primary" ikon={Save} sibuk={sibuk} onClick={simpan}>Simpan</Tombol></>}>
        {ubah ? (
          <div className="ad-form">
            <div className="pm-form-2">
              <Bidang label="Kode" wajib><input className="input" value={ubah.kode} onChange={set('kode')} /></Bidang>
              <Bidang label="Jenjang">
                <select className="input" value={ubah.jenjang || 'S1'} onChange={set('jenjang')}>{['D3', 'D4', 'S1', 'S2'].map((j) => <option key={j}>{j}</option>)}</select>
              </Bidang>
              <Bidang label="Nama program studi" wajib lebar><input className="input" value={ubah.nama} onChange={set('nama')} /></Bidang>
              <Bidang label="Kode prodi PDDikti"><input className="input" value={ubah.kode_pddikti} onChange={set('kode_pddikti')} /></Bidang>
              <Bidang label="Akreditasi">
                <select className="input" value={ubah.akreditasi} onChange={set('akreditasi')}><option value="">Belum diisi</option>{AKREDITASI.map((a) => <option key={a}>{a}</option>)}</select>
              </Bidang>
              {ubah.akreditasi === 'Terakreditasi' ? (
                <Bidang label="Akreditasi sebelumnya" lebar hint="Untuk perolehan kredit, akreditasi sebelumnya minimal Baik Sekali/B dan berkas SK-nya tersimpan.">
                  <select className="input" value={ubah.akreditasi_sebelumnya} onChange={set('akreditasi_sebelumnya')}><option value="">Belum diisi</option>{AKREDITASI.slice(0, 6).map((a) => <option key={a}>{a}</option>)}</select>
                </Bidang>
              ) : null}
              <Bidang label="Beban belajar minimal (SKS)" wajib><InputAngka nilai={ubah.beban_sks_minimal} onUbah={set('beban_sks_minimal')} panjang={3} /></Bidang>
              <Bidang label="Batas SKS RPL" hint={`Kosongkan untuk memakai ${persen}% beban belajar (${Math.floor(Number(ubah.beban_sks_minimal || 0) * persen / 100)} SKS).`}>
                <InputAngka nilai={ubah.maks_sks_rpl} onUbah={set('maks_sks_rpl')} panjang={3} />
              </Bidang>
            </div>
            <div className="ad-sakelar-daftar">
              <Sakelar label="Penyelenggara RPL" ket="Program studi muncul pada pilihan pemohon." nilai={ubah.is_penyelenggara_rpl} onUbah={set('is_penyelenggara_rpl')} />
              <Sakelar label="Menerima transfer kredit" nilai={ubah.menerima_transfer_kredit} onUbah={set('menerima_transfer_kredit')} />
              <Sakelar label="Menerima perolehan kredit" nilai={ubah.menerima_perolehan_kredit} onUbah={set('menerima_perolehan_kredit')} />
              <Sakelar label="Sudah memiliki lulusan" ket="Syarat menerima transfer kredit." nilai={ubah.sudah_ada_lulusan} onUbah={set('sudah_ada_lulusan')} />
              <Sakelar label="Program studi aktif" nilai={ubah.is_active} onUbah={set('is_active')} />
            </div>
            {(() => { const k = kelayakan(ubah); return k.alasan.length ? <Pemberitahuan jenis="amber">Belum memenuhi: {k.alasan.join('; ')}.</Pemberitahuan> : null })()}
          </div>
        ) : null}
      </Dialog>
    </Halaman>
  )
}

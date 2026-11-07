// F01: Petunjuk untuk Pemohon RPL Tipe A. Narasi disalin dari Pedoman RPL
// STIKOM Yos Sudarso; daftar mata kuliah, batas SKS, dan biaya diambil dari data.
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import '../../pemohon/pemohon.css'
import '../dokumen.css'

const rp = (n) => `Rp${Number(n || 0).toLocaleString('id-ID')}`
const KOMPONEN = {
  pendaftaran: ['Biaya pendaftaran', 'Dibayar satu kali saat mendaftar'],
  asesmen_per_sks: ['Biaya asesmen RPL (per SKS)', 'Dihitung dari SKS yang diajukan'],
  kuliah_per_semester: ['Biaya kuliah (per semester)', 'Sesuai SK biaya pendidikan'],
  matrikulasi_per_mk: ['Matrikulasi (per mata kuliah)', 'Bila direkomendasikan asesor'],
  cuti_per_semester: ['Cuti akademik (per semester)', 'Bila mengajukan cuti'],
  lain_lain: ['Lain-lain (orientasi, wisuda, dan sebagainya)', ''],
}

export default function Petunjuk() {
  const navigate = useNavigate()
  const [param, setParam] = useSearchParams()
  const [d, setD] = useState(null)
  const [mk, setMk] = useState(null)
  useEffect(() => {
    Promise.all([
      supabase.from('program_studi').select('*').eq('is_active', true).order('nama'),
      supabase.from('periode_rpl').select('*').eq('is_aktif', true).maybeSingle(),
    ]).then(async ([p, per]) => {
      const tarif = per.data ? (await supabase.from('tarif_biaya').select('*').eq('periode_id', per.data.id).eq('is_internal', false)).data : []
      const prodi = (p.data || []).filter((x) => x.is_penyelenggara_rpl !== false)
      setD({ prodi, periode: per.data, tarif: tarif || [] })
      if (!param.get('prodi') && prodi[0]) setParam({ prodi: prodi[0].kode }, { replace: true })
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const prodi = d?.prodi.find((x) => x.kode === param.get('prodi'))
  useEffect(() => {
    if (!prodi) return
    setMk(null)
    supabase.from('mata_kuliah_kurikulum').select('*').eq('prodi_id', prodi.id).order('semester').order('kode_mk').then(({ data }) => setMk(data || []))
  }, [prodi?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const beban = prodi?.beban_sks_minimal || 144
  const maks = Math.min(prodi?.maks_sks_rpl || 100, Math.floor(beban * 0.7))
  const tarifProdi = (d?.tarif || []).filter((t) => !t.prodi_id || t.prodi_id === prodi?.id)
  const rpl = (m) => m.dapat_rpl !== false && !m.is_tugas_akhir && !m.rangkaian_ta

  return (
    <div className="cetak-latar">
      <div className="cetak-alat dk-alat no-print">
        <button type="button" className="btn btn-secondary" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))}><ArrowLeft size={14} /> Kembali</button>
        <select className="input" style={{ width: 'auto' }} value={param.get('prodi') || ''} onChange={(e) => setParam({ prodi: e.target.value })} aria-label="Program studi">
          {(d?.prodi || []).map((p) => <option key={p.id} value={p.kode}>{p.nama}</option>)}
        </select>
        <span className="pm-grow" />
        <button type="button" className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Cetak / simpan PDF</button>
      </div>
      <article className="cetak-halaman dk-halaman">
        <header className="cetak-kop">
          <img src="/logo-sys.png" alt="" />
          <div><div className="cetak-kop-nama">SEKOLAH TINGGI ILMU KOMPUTER YOS SUDARSO</div><div>Program Studi {prodi?.nama || '...'}</div></div>
          <div className="cetak-kode">F01</div>
        </header>
        <h1 className="cetak-judul">PETUNJUK UNTUK CALON MAHASISWA</h1>
        <p className="cetak-kecil">REKOGNISI PEMBELAJARAN LAMPAU (RPL) TIPE A{d?.periode ? ` · Periode ${d.periode.nama}` : ''}</p>

        <h2>I. Pendahuluan</h2>
        <p className="cetak-pernyataan">Rekognisi Pembelajaran Lampau (RPL) adalah pengakuan atas Capaian Pembelajaran (CP) seseorang yang diperoleh dari pendidikan formal, nonformal, informal, dan/atau pengalaman kerja sebagai dasar untuk melanjutkan pendidikan formal. RPL Tipe A di STIKOM Yos Sudarso adalah RPL untuk melanjutkan pendidikan formal pada program studi {prodi?.jenjang || 'Sarjana'} {prodi?.nama || ''}.</p>
        <p className="cetak-pernyataan">Pengakuan CP bersifat parsial, yaitu pengakuan terhadap mata kuliah dalam kurikulum program studi, dalam bentuk perolehan SKS atas hasil belajar dari: (1) program studi pada perguruan tinggi sebelumnya, melalui mekanisme <b>transfer kredit</b>; (2) pendidikan nonformal atau informal, melalui mekanisme <b>perolehan kredit</b>; dan/atau (3) pengalaman kerja setelah lulus pendidikan menengah atas atau sederajat, melalui mekanisme perolehan kredit.</p>
        <p className="cetak-pernyataan">Saudara dapat memilih mata kuliah yang diajukan untuk RPL sesuai kompetensi (capaian pembelajaran mata kuliah) yang menurut Saudara telah diperoleh. Mata kuliah yang dapat dipilih bertanda "v" pada kolom RPL. Untuk setiap mata kuliah perolehan kredit, Saudara mengisi Formulir Evaluasi Diri (F03) disertai bukti yang mendukung.</p>
        <p className="dk-kecil"><b>Tabel 1. Daftar mata kuliah Program Studi {prodi?.nama}</b></p>
        <table className="cetak-tabel">
          <thead><tr><th style={{ width: 28 }}>No</th><th style={{ width: 90 }}>Kode</th><th>Nama mata kuliah</th><th style={{ width: 36 }}>SKS</th><th style={{ width: 36 }}>Smt</th><th style={{ width: 40 }}>RPL</th><th style={{ width: 48 }}>Tidak</th><th style={{ width: 90 }}>FED</th></tr></thead>
          <tbody>
            {!mk ? <tr><td colSpan={8}>Memuat...</td></tr> : mk.map((m, i) => (
              <tr key={m.id}><td>{i + 1}</td><td>{m.kode_mk}</td><td>{m.nama_mk}</td><td>{m.sks}</td><td>{m.semester}</td>
                <td className="dk-tengah">{rpl(m) ? 'v' : ''}</td><td className="dk-tengah">{rpl(m) ? '' : 'v'}</td><td>{rpl(m) ? (m.nomor_fed || '') : ''}</td></tr>
            ))}
          </tbody>
        </table>

        <h2>II. Tahapan pendaftaran dan asesmen RPL</h2>
        <ol className="dk-ol">
          <li><b>Pendaftaran dan konsultasi.</b> Calon mahasiswa mendaftar melalui SIRPL dan berkonsultasi dengan Tim RPL untuk mengidentifikasi program studi yang sesuai, bukti yang perlu disiapkan, dan proses RPL mulai dari pendaftaran, asesmen, hingga pengakuan perolehan SKS.</li>
          <li><b>Pengajuan rekognisi.</b> Pemohon mengisi Formulir Aplikasi (F02), Daftar Riwayat Hidup (F07), dan Formulir Evaluasi Diri (F03), lalu mengunggah bukti pendukung berupa portofolio dan/atau transkrip nilai yang diberi nomor dan nama dokumen secara jelas.</li>
          <li><b>Asesmen.</b> Asesmen dilakukan oleh Tim Penilai RPL, utamanya dengan metode portofolio. Untuk perolehan kredit, asesmen dilanjutkan dengan wawancara dan dapat ditambah asesmen tulis, observasi, presentasi, praktik, atau pemberian tugas.</li>
          <li><b>Penetapan dan pengumuman hasil.</b> Hasil asesmen dibahas dalam rapat pleno dan disampaikan kepada pemohon. Pemohon yang keberatan dapat mengajukan sanggahan dengan bukti tambahan. Setelah disetujui Komite RPL, Ketua STIKOM Yos Sudarso menerbitkan Surat Keputusan tentang hasil rekognisi yang memuat daftar mata kuliah, nilai, dan jumlah SKS yang diakui.</li>
          <li><b>Orientasi dan perkuliahan.</b> Peserta yang ditetapkan sebagai mahasiswa mengikuti pengenalan lingkungan kampus khusus jalur RPL, lalu mengikuti perkuliahan untuk menempuh sisa mata kuliah hingga lulus.</li>
        </ol>

        <h2>III. Pengakuan hasil asesmen</h2>
        <p className="cetak-pernyataan">Pengakuan hasil asesmen berupa perolehan SKS dari mata kuliah sesuai hasil asesmen (perolehan kredit) dan/atau transfer SKS dari pendidikan tinggi sebelumnya (transfer kredit). Jumlah SKS yang diakui merupakan gabungan keduanya, paling banyak <b>{maks} SKS</b> (70% dari beban belajar minimal {beban} SKS), sehingga paling sedikit <b>{beban - maks} SKS</b> tetap ditempuh. Mata kuliah diakui dengan nilai paling rendah C sesuai Peraturan Akademik STIKOM Yos Sudarso. Tugas akhir beserta rangkaiannya tetap wajib ditempuh.</p>

        <h2>IV. Persyaratan calon mahasiswa</h2>
        <p className="dk-kecil"><b>RPL transfer kredit</b></p>
        <ol className="dk-ol">
          <li>pernah menempuh pendidikan pada program studi di perguruan tinggi sebelumnya, dibuktikan dengan ijazah, transkrip nilai, dan/atau surat keterangan lulus mata kuliah;</li>
          <li>data akademik tercatat di PDDikti dan memenuhi ketentuan status keluar mahasiswa; dan</li>
          <li>melampirkan silabus atau Rencana Pembelajaran Semester (RPS) mata kuliah yang diajukan, bila tersedia.</li>
        </ol>
        <p className="dk-kecil"><b>RPL perolehan kredit</b></p>
        <ol className="dk-ol">
          <li>lulus SMA atau yang sederajat, dengan tahun kelulusan paling sedikit 2 (dua) tahun sebelum tahun mendaftar, kecuali lulusan Paket C;</li>
          <li>memiliki pengalaman kerja paling sedikit 2 (dua) tahun pada bidang yang relevan dengan program studi yang dituju, dibuktikan dengan surat keterangan kerja; dan</li>
          <li>memiliki CP dari pendidikan nonformal, informal, dan/atau pengalaman kerja yang relevan dengan program studi yang dituju.</li>
        </ol>
        <p className="dk-kecil">Bagi pegawai, melampirkan izin dari Pejabat Pembina Kepegawaian (ASN) atau atasan langsung (non-ASN).</p>

        <h2>V. Pendaftaran kuliah dan biaya kuliah</h2>
        <p className="cetak-pernyataan">Setelah mengikuti asesmen dan menyetujui hasilnya, calon mahasiswa mendaftarkan diri untuk mengikuti kuliah sesuai ketentuan STIKOM Yos Sudarso. Biaya{d?.periode ? ` periode ${d.periode.nama}` : ''}:</p>
        <table className="cetak-tabel">
          <thead><tr><th style={{ width: 28 }}>No</th><th>Komponen biaya</th><th style={{ width: 120 }}>Besaran</th><th>Keterangan</th></tr></thead>
          <tbody>
            {tarifProdi.length ? tarifProdi.map((t, i) => (
              <tr key={t.id}><td>{i + 1}</td><td>{KOMPONEN[t.komponen]?.[0] || t.komponen}</td><td>{rp(t.besaran)}</td><td>{t.keterangan || KOMPONEN[t.komponen]?.[1] || ''}</td></tr>
            )) : <tr><td colSpan={4}>Besaran biaya diumumkan Sekretariat RPL.</td></tr>}
          </tbody>
        </table>
        <p className="dk-kecil">Biaya pendaftaran dan biaya asesmen yang telah dibayarkan tidak dapat ditarik kembali, termasuk apabila hasil rekognisi tidak sesuai harapan pemohon. Biaya kuliah dibayarkan sesuai jadwal dan tata cara yang berlaku bagi mahasiswa reguler.</p>

        <h2>VI. Tahapan proses RPL dan kuliah</h2>
        <p className="cetak-pernyataan">Daftar di SIRPL → isi F02, F07, F03 dan unggah bukti → verifikasi Sekretariat RPL → asesmen portofolio/transkrip → pleno awal → wawancara (perolehan kredit) → pleno hasil → persetujuan atau sanggahan pemohon → persetujuan Komite RPL → SK Ketua STIKOM Yos Sudarso → penetapan NIM oleh BAAK → orientasi dan perkuliahan sisa SKS hingga lulus.</p>
      </article>
    </div>
  )
}

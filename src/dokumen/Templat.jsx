// Templat cetak A4 per jenis dokumen, dirender dari isi_snapshot.
import { jalurQR } from './qr'

const MEK_PENDEK = { 'Transfer kredit': 'Transfer', 'Perolehan kredit': 'Perolehan' }
const PROF = { sangat_baik: 'Sangat baik', baik: 'Baik', tidak_pernah: 'Tidak pernah' }
const KEP = { diakui: 'Diakui', tidak_diakui: 'Tidak diakui', perlu_asesmen_lanjutan: 'Asesmen lanjutan', belum_dinilai: 'Belum dinilai', diterima: 'Diterima', diterima_sebagian: 'Diterima sebagian', ditolak: 'Ditolak' }
const JENIS_JADWAL = { wawancara: 'Wawancara', unjuk_kerja: 'Unjuk kerja / praktik', uji_tulis: 'Uji tulis', observasi: 'Observasi', presentasi: 'Presentasi portofolio' }
const tgl = (d, jam) => (d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', ...(jam ? { hour: '2-digit', minute: '2-digit' } : {}) }) : '-')

export const urlVerifikasi = (kode) => `${window.location.origin}/verifikasi/${kode}`

export function KodeQR({ teks, ukuran = 84 }) {
  const { ukuran: n, d } = jalurQR(teks)
  return (
    <svg width={ukuran} height={ukuran} viewBox={`0 0 ${n} ${n}`} shapeRendering="crispEdges" role="img" aria-label="Kode QR verifikasi">
      <rect width={n} height={n} fill="#fff" /><path d={d} fill="#000" />
    </svg>
  )
}

function Kop({ dok, judul, sub }) {
  return (
    <>
      <header className="cetak-kop">
        <img src="/logo-sys.png" alt="" />
        <div>
          <div className="cetak-kop-nama">SEKOLAH TINGGI ILMU KOMPUTER YOS SUDARSO</div>
          <div>Tim Pengelola Rekognisi Pembelajaran Lampau (RPL) Tipe A</div>
        </div>
        {dok.jenis_kode !== 'SURAT_HASIL' ? <div className="cetak-kode">{dok.jenis_kode}</div> : null}
      </header>
      <h1 className="cetak-judul">{judul}</h1>
      {sub || dok.nomor ? <p className="cetak-kecil">{dok.nomor ? `Nomor: ${dok.nomor}` : ''}{sub ? `${dok.nomor ? ' · ' : ''}${sub}` : ''}</p> : null}
    </>
  )
}

function Identitas({ baris }) {
  return (
    <table className="cetak-identitas"><tbody>
      {baris.filter(Boolean).map(([k, v]) => <tr key={k}><td>{k}</td><td>:</td><td>{v || ''}</td></tr>)}
    </tbody></table>
  )
}
const identitasPemohon = (i) => [['Nama pemohon', i.pemohon?.nama], ['Nomor pendaftaran', i.nomor_pendaftaran], ['Program studi tujuan', i.prodi], ['Jenis RPL', i.jenis_rpl], i.periode ? ['Periode', i.periode] : null]

// Blok tanda tangan: QR muncul setelah ditandatangani.
export function BlokTtd({ dok, kota = 'Purwokerto', tanggalTtd = true }) {
  const ttd = dok.ttd || []
  return (
    <div className={`dk-ttd${ttd.length > 2 ? ' dk-ttd-banyak' : ''}`}>
      {ttd.map((t) => (
        <div key={t.id} className="dk-ttd-blok">
          {tanggalTtd && ttd.length <= 2 ? <div>{kota}, {tgl(t.ditandatangani_at || dok.tanggal_dokumen)}</div> : null}
          <div>{t.jabatan_snapshot}</div>
          <div className="dk-ttd-ruang">
            {t.status === 'ditandatangani' ? <KodeQR teks={urlVerifikasi(t.kode_verifikasi)} ukuran={ttd.length > 2 ? 72 : 92} />
              : <span className="dk-ttd-tunggu">{t.status === 'ditolak' ? 'Ditolak' : 'Menunggu tanda tangan'}</span>}
          </div>
          <div className="dk-ttd-nama">{t.nama_snapshot}</div>
          {t.status === 'ditandatangani' ? <div className="dk-ttd-kode">Kode {t.kode_verifikasi}</div> : null}
        </div>
      ))}
    </div>
  )
}

function TabelMk({ mk, nilai, mekanisme = true }) {
  return (
    <table className="cetak-tabel">
      <thead><tr><th style={{ width: 28 }}>No</th><th style={{ width: 90 }}>Kode</th><th>Mata kuliah</th><th style={{ width: 40 }}>SKS</th>{mekanisme ? <th style={{ width: 80 }}>Mekanisme</th> : null}{nilai ? <th style={{ width: 46 }}>Nilai</th> : null}</tr></thead>
      <tbody>
        {mk.map((m, i) => (
          <tr key={i}><td>{i + 1}</td><td>{m.kode}</td><td>{m.nama}</td><td>{m.sks}</td>{mekanisme ? <td>{MEK_PENDEK[m.mekanisme] || m.mekanisme}</td> : null}{nilai ? <td>{m.nilai}</td> : null}</tr>
        ))}
        {!mk.length ? <tr><td colSpan={6}>-</td></tr> : null}
      </tbody>
      {nilai && mk.length ? <tfoot><tr><th colSpan={3}>Jumlah SKS</th><th>{mk.reduce((n, m) => n + Number(m.sks || 0), 0)}</th><th colSpan={mekanisme ? 2 : 1} /></tr></tfoot> : null}
    </table>
  )
}

const Biodata = ({ dok, i }) => (
  <>
    <Kop dok={dok} judul={i.jenis === 'akademisi' ? 'BIODATA ASESOR AKADEMISI' : 'BIODATA ASESOR PRAKTISI/PROFESI'} />
    <table className="cetak-tabel dk-gap">
      <thead><tr><th style={{ width: 32 }}>No</th><th style={{ width: 260 }}>Identitas</th><th>Keterangan</th></tr></thead>
      <tbody>{(i.baris || []).map(([k, v], x) => <tr key={k}><td>{x + 1}</td><td>{k}</td><td>{v || '-'}</td></tr>)}</tbody>
    </table>
    <p className="cetak-pernyataan">Biodata ini saya buat dengan sebenarnya untuk keperluan asesmen Rekognisi Pembelajaran Lampau di STIKOM Yos Sudarso.</p>
    <BlokTtd dok={dok} />
  </>
)

const T = {
  F04: Biodata,
  F05: Biodata,
  F02: ({ dok, i }) => (
    <>
      <Kop dok={dok} judul="FORMULIR APLIKASI RPL TIPE A" sub={`Nomor pendaftaran ${i.nomor_pendaftaran}`} />
      <p>Program studi tujuan: <b>{i.prodi}</b> · Jenis RPL: <b>{i.jenis_rpl}</b></p>
      <h2>Bagian 1: Rincian data calon</h2>
      <h3 className="dk-sub">a. Data pribadi</h3><Identitas baris={i.pribadi} />
      <h3 className="dk-sub">b. Data pekerjaan sekarang</h3><Identitas baris={i.pekerjaan} />
      {i.pt_asal ? <><h3 className="dk-sub">c. Perguruan tinggi asal</h3><Identitas baris={i.pt_asal} /></> : null}
      <h2>Bagian 2: Daftar mata kuliah yang diajukan</h2>
      <TabelMk mk={i.mk} />
      <p className="cetak-pernyataan">Dengan ini saya menyatakan bahwa semua informasi yang saya tuliskan sepenuhnya benar dan saya bertanggung jawab atas seluruh data dalam formulir ini; memberikan izin kepada pengelola RPL untuk memeriksa kebenaran informasi tersebut; dan akan mengikuti proses asesmen sesuai jadwal yang ditetapkan.</p>
      <BlokTtd dok={dok} />
    </>
  ),
  F07: ({ dok, i }) => (
    <>
      <Kop dok={dok} judul="DAFTAR RIWAYAT HIDUP (CURRICULUM VITAE)" sub={`Nomor pendaftaran ${i.nomor_pendaftaran}`} />
      <h2>Identitas diri</h2><Identitas baris={i.identitas} />
      {i.bagian.map((b) => (
        <section key={b.judul}>
          <h2>{b.judul}</h2>
          <table className="cetak-tabel">
            <thead><tr><th style={{ width: 28 }}>No</th>{b.kolom.map((k) => <th key={k}>{k}</th>)}</tr></thead>
            <tbody>{(b.baris.length ? b.baris : [b.kolom.map(() => '-')]).map((r, x) => <tr key={x}><td>{b.baris.length ? x + 1 : ''}</td>{r.map((c, y) => <td key={y}>{c}</td>)}</tr>)}</tbody>
          </table>
        </section>
      ))}
      <p className="cetak-pernyataan">Saya menyatakan bahwa semua keterangan dalam Daftar Riwayat Hidup ini sepenuhnya benar dan saya bertanggung jawab atas seluruh data dalam formulir ini.</p>
      <BlokTtd dok={dok} />
    </>
  ),
  F03: ({ dok, i }) => (
    <>
      <Kop dok={dok} judul="FORMULIR EVALUASI DIRI" />
      <Identitas baris={identitasPemohon(i)} />
      {i.mk.map((m) => (
        <section key={m.kode} className="dk-blok">
          <h2>{m.nomor_fed ? `${m.nomor_fed}: ` : ''}{m.kode} {m.nama} ({m.sks} SKS)</h2>
          {m.deskripsi ? <p className="dk-kecil">{m.deskripsi}</p> : null}
          <table className="cetak-tabel">
            <thead>
              <tr><th rowSpan={2} style={{ width: 28 }}>No</th><th rowSpan={2}>Kemampuan akhir yang diharapkan</th><th rowSpan={2} style={{ width: 74 }}>Profisiensi</th><th rowSpan={2} style={{ width: 54 }}>Bukti</th><th colSpan={4}>Asesor</th></tr>
              <tr>{['V', 'A', 'T', 'M'].map((x) => <th key={x} style={{ width: 20 }}>{x}</th>)}</tr>
            </thead>
            <tbody>
              {m.butir.map((b, x) => (
                <tr key={x}><td>{x + 1}</td><td><b>{b.kode}</b> {b.deskripsi}</td><td>{PROF[b.profisiensi] || '-'}</td><td>{(b.bukti || []).join(', ') || '-'}</td>
                  {['V', 'A', 'T', 'M'].map((k) => <td key={k} className="dk-tengah">{b.vatm?.[k] ? '✓' : ''}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <p className="dk-kecil">Keputusan asesor: <b>{KEP[m.keputusan] || m.keputusan}</b>{m.nilai ? `, nilai ${m.nilai}` : ''}{m.catatan ? `. Catatan: ${m.catatan}` : ''}</p>
        </section>
      ))}
      {i.bukti?.length ? (
        <>
          <h2>Daftar bukti</h2>
          <table className="cetak-tabel"><thead><tr><th style={{ width: 40 }}>No</th><th>Nama dokumen</th><th style={{ width: 200 }}>Jenis</th></tr></thead>
            <tbody>{i.bukti.map((b) => <tr key={b.nomor}><td>{b.nomor}</td><td>{b.nama}</td><td>{b.jenis}</td></tr>)}</tbody></table>
        </>
      ) : null}
      <p className="cetak-pernyataan">Pemohon menyatakan isian evaluasi diri ini benar, mengizinkan pemeriksaan kebenarannya, dan bersedia mengikuti asesmen lanjutan. V-A-T-M: Valid, Autentik, Terkini, Memadai.</p>
      <BlokTtd dok={dok} />
    </>
  ),
  F09: ({ dok, i }) => (
    <>
      <Kop dok={dok} judul="FORMULIR KONVERSI MATA KULIAH (TRANSFER KREDIT)" />
      <Identitas baris={[...identitasPemohon(i), ['Perguruan tinggi asal', i.pt_asal], i.prodi_asal ? ['Program studi asal', i.prodi_asal] : null,
        i.pddikti ? ['Pemeriksaan PDDikti', `Ijazah ${i.pddikti.ijazah ? 'sesuai' : 'tidak sesuai'}, transkrip ${i.pddikti.transkrip ? 'sesuai' : 'tidak sesuai'}${i.pddikti.status ? `, status ${i.pddikti.status}` : ''}`] : null]} />
      <table className="cetak-tabel dk-gap">
        <thead>
          <tr><th rowSpan={2} style={{ width: 24 }}>No</th><th colSpan={4}>Mata kuliah asal</th><th colSpan={3}>Mata kuliah STIKOM Yos Sudarso</th><th rowSpan={2} style={{ width: 66 }}>Keputusan</th><th rowSpan={2} style={{ width: 36 }}>Nilai</th></tr>
          <tr><th style={{ width: 60 }}>Kode</th><th>Nama</th><th style={{ width: 30 }}>SKS</th><th style={{ width: 34 }}>Nilai</th><th style={{ width: 70 }}>Kode</th><th>Nama</th><th style={{ width: 30 }}>SKS</th></tr>
        </thead>
        <tbody>
          {i.baris.map((b, x) => (
            <tr key={x}><td>{x + 1}</td><td>{b.asal.kode}</td><td>{b.asal.nama}</td><td>{b.asal.sks}</td><td>{b.asal.nilai}</td>
              <td>{b.tujuan.kode}</td><td>{b.tujuan.nama}</td><td>{b.tujuan.sks}</td><td>{KEP[b.keputusan]}</td><td>{b.nilai}</td></tr>
          ))}
        </tbody>
        <tfoot><tr><th colSpan={7}>Jumlah SKS diakui</th><th>{i.baris.filter((b) => b.keputusan === 'diakui').reduce((n, b) => n + Number(b.tujuan.sks || 0), 0)}</th><th colSpan={2} /></tr></tfoot>
      </table>
      <BlokTtd dok={dok} />
    </>
  ),
  F10: ({ dok, i }) => (
    <>
      <Kop dok={dok} judul="LEMBAR PENILAIAN LANJUTAN" />
      <Identitas baris={[...identitasPemohon(i), ['Metode', JENIS_JADWAL[i.jadwal.jenis] || i.jadwal.jenis], ['Waktu', `${tgl(i.jadwal.waktu, true)} WIB`], ['Tempat', i.jadwal.tempat]]} />
      {i.mk.map((m) => (
        <section key={m.kode} className="dk-blok">
          <h2>{m.kode} {m.nama} ({m.sks} SKS)</h2>
          <table className="cetak-tabel">
            <thead><tr><th style={{ width: 24 }}>No</th><th style={{ width: 70 }}>Butir</th><th>Pertanyaan / tugas</th><th>Ringkasan jawaban / unjuk kerja</th><th style={{ width: 70 }}>Hasil</th></tr></thead>
            <tbody>
              {(m.butir.length ? m.butir : [{}]).map((b, x) => (
                <tr key={x}><td>{m.butir.length ? x + 1 : ''}</td><td>{b.sub_cpmk || ''}</td><td>{b.pertanyaan || ''}</td><td>{b.ringkasan_jawaban || ''}</td><td>{b.hasil === 'memenuhi' ? 'Memenuhi' : b.hasil ? 'Belum' : ''}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="dk-kecil">Hasil: <b>{m.hasil === 'memenuhi' ? 'Memenuhi' : m.hasil ? 'Belum memenuhi' : '-'}</b>{m.catatan ? `. Catatan: ${m.catatan}` : ''}</p>
        </section>
      ))}
      <BlokTtd dok={dok} />
    </>
  ),
  F11: ({ dok, i }) => (
    <>
      <Kop dok={dok} judul={`BERITA ACARA ${i.jenis === 'awal' ? 'PLENO AWAL' : 'PLENO HASIL REKOGNISI'} RPL TIPE A`} sub={i.prodi} />
      <p className="cetak-pernyataan">Pada hari ini, {tgl(i.tanggal)}, bertempat di {i.tempat || '-'}, telah dilaksanakan {i.jenis === 'awal' ? 'pleno awal hasil penilaian portofolio perolehan kredit' : 'pleno penetapan hasil rekognisi pembelajaran lampau'} Program Studi {i.prodi} yang dihadiri oleh:</p>
      <table className="cetak-tabel"><thead><tr><th style={{ width: 28 }}>No</th><th>Nama</th><th style={{ width: 200 }}>Jabatan dalam pleno</th></tr></thead>
        <tbody>{i.peserta.map((p, x) => <tr key={x}><td>{x + 1}</td><td>{p.nama}</td><td>{p.jabatan}</td></tr>)}</tbody></table>
      <p className="cetak-pernyataan">Pleno membahas dan menetapkan hasil sebagai berikut:</p>
      <table className="cetak-tabel">
        <thead><tr><th style={{ width: 28 }}>No</th><th>Nama pemohon</th><th style={{ width: 110 }}>No. pendaftaran</th><th style={{ width: 80 }}>Jenis RPL</th><th style={{ width: 70 }}>MK diakui</th><th style={{ width: 60 }}>SKS diakui</th><th>Catatan</th></tr></thead>
        <tbody>{i.pengajuan.map((p, x) => (
          <tr key={x}><td>{x + 1}</td><td>{p.nama}</td><td>{p.nomor}</td><td>{p.jenis_rpl}</td><td>{p.mk_diakui} / {p.mk_diajukan}</td><td>{p.sks_diakui}</td>
            <td>{[i.jenis === 'awal' && p.lanjutan ? `${p.lanjutan} MK asesmen lanjutan` : null, p.catatan].filter(Boolean).join('. ')}</td></tr>
        ))}</tbody>
      </table>
      {i.notulen ? <><h2>Catatan pleno</h2><p style={{ whiteSpace: 'pre-line' }}>{i.notulen}</p></> : null}
      <p className="cetak-pernyataan">Demikian berita acara ini dibuat untuk digunakan sebagaimana mestinya.</p>
      <BlokTtd dok={dok} tanggalTtd={false} />
    </>
  ),
  F12: ({ dok, i }) => (
    <>
      <Kop dok={dok} judul="BERKAS SANGGAHAN DAN TANGGAPAN" />
      <Identitas baris={[...identitasPemohon(i), ['Tanggal sanggahan', tgl(i.diajukan)]]} />
      <h2>Mata kuliah yang disanggah</h2>
      <ol className="dk-ol">{i.mk.map((m) => <li key={m}>{m}</li>)}</ol>
      <h2>Alasan sanggahan</h2><p style={{ whiteSpace: 'pre-line' }}>{i.alasan}</p>
      {i.bukti_nomor?.length ? <p>Bukti pendukung nomor: {i.bukti_nomor.join(', ')}</p> : null}
      <h2>Tanggapan Tim Pengelola RPL</h2>
      <p>Keputusan: <b>{KEP[i.keputusan] || '-'}</b></p><p style={{ whiteSpace: 'pre-line' }}>{i.tanggapan || '-'}</p>
      <BlokTtd dok={dok} />
    </>
  ),
  SURAT_HASIL: ({ dok, i }) => (
    <>
      <Kop dok={dok} judul="SURAT HASIL REKOGNISI PEMBELAJARAN LAMPAU" />
      <Identitas baris={identitasPemohon(i)} />
      <p className="cetak-pernyataan">Berdasarkan hasil asesmen oleh Tim Penilai{i.pleno ? ` dan pleno tanggal ${tgl(i.pleno.tanggal)}${i.pleno.nomor_ba ? ` (Berita Acara Nomor ${i.pleno.nomor_ba})` : ''}` : ''}, dengan ini disampaikan bahwa pembelajaran lampau Saudara/i diakui setara dengan mata kuliah berikut:</p>
      <TabelMk mk={i.diakui} nilai />
      {i.tidak_diakui?.length ? <><h2>Mata kuliah yang tidak diakui</h2><TabelMk mk={i.tidak_diakui} /></> : null}
      <p className="cetak-pernyataan">Jumlah SKS yang diakui: <b>{i.sks_diakui} SKS</b>{i.beban ? `. Sisa beban studi yang wajib ditempuh: ${Math.max(0, i.beban - i.sks_diakui)} SKS` : ''}. Hasil ini menjadi final setelah disetujui Komite RPL dan ditetapkan dengan Surat Keputusan Ketua STIKOM Yos Sudarso.</p>
      <BlokTtd dok={dok} />
    </>
  ),
  F08: ({ dok, i }) => (
    <>
      <Kop dok={dok} judul="LAMPIRAN KEPUTUSAN KETUA STIKOM YOS SUDARSO" sub={`tanggal ${tgl(i.sk.tanggal)}`} />
      <p className="cetak-kecil">tentang {i.sk.perihal || 'Hasil Asesmen Rekognisi Pembelajaran Lampau Tipe A'}</p>
      <Identitas baris={identitasPemohon(i)} />
      <p className="cetak-pernyataan">Mata kuliah yang diakui melalui RPL Tipe A beserta nilainya:</p>
      <TabelMk mk={i.diakui} nilai />
      <p className="cetak-pernyataan">Jumlah SKS yang diakui: <b>{i.sks_diakui} SKS</b>{i.beban ? ` dari beban studi ${i.beban} SKS` : ''}.</p>
      <BlokTtd dok={dok} />
    </>
  ),
}

export default function Templat({ dok }) {
  const Komponen = T[dok.jenis_kode]
  if (!Komponen) return <p>Templat untuk {dok.jenis_kode} belum tersedia.</p>
  return <Komponen dok={dok} i={dok.isi_snapshot || {}} />
}

// Ringkasan berkas pemohon untuk asesor (hanya baca).
import { ExternalLink } from 'lucide-react'
import { BERKAS } from '../../../pemohon/kelengkapan'
import { JENIS_BUKTI, KATEGORI_RIWAYAT, STATUS_PDDIKTI, tanggal } from '../../../pemohon/konstanta'
import { BukaBerkas, Kartu, Lencana } from '../../../pemohon/ui'

const LABEL_BUKTI = Object.fromEntries(JENIS_BUKTI.map((j) => [j.v, j.l]))
const STATUS_KERJA = { pegawai_tetap: 'Pegawai tetap', pegawai_honorer: 'Pegawai honorer', pns: 'PNS', tidak_bekerja: 'Tidak bekerja' }

function Baris({ l, v }) {
  return <div className="as-baris"><dt>{l}</dt><dd>{v || '-'}</dd></div>
}

export default function TabBerkas({ p, d }) {
  const b = d.biodata || {}
  const r = d.riwayat || {}
  const transfer = ['transfer', 'gabungan'].includes(p.jenis_rpl)
  return (
    <div className="pm-tumpuk-besar">
      <div className="tm-dua">
        <Kartu judul="Data pemohon">
          <dl className="as-dl">
            <Baris l="Tempat, tanggal lahir" v={[b.tempat_lahir, b.tanggal_lahir ? tanggal(b.tanggal_lahir) : null].filter(Boolean).join(', ')} />
            <Baris l="Pendidikan terakhir" v={[b.pendidikan_terakhir, b.nama_sekolah_pt, b.tahun_lulus].filter(Boolean).join(' · ')} />
            <Baris l="Pekerjaan saat ini" v={[r.jabatan, r.institusi_kerja].filter(Boolean).join(', ')} />
            <Baris l="Status pekerjaan" v={STATUS_KERJA[r.status_pekerjaan] || r.status_pekerjaan_lainnya || r.status_pekerjaan} />
            {transfer ? <Baris l="Perguruan tinggi asal" v={[p.pt_asal, p.prodi_asal, STATUS_PDDIKTI[p.status_pddikti_asal]].filter(Boolean).join(' · ')} /> : null}
          </dl>
        </Kartu>
        <Kartu judul="Berkas pengajuan" padat>
          <ul className="tm-daftar">
            {BERKAS.filter((x) => p[x.kolom]).map((x) => (
              <li key={x.kolom} className="tm-baris"><span className="pm-grow">{x.label}</span><BukaBerkas path={p[x.kolom]} label="Buka" /></li>
            ))}
            {p.file_f07_ttd_url ? <li className="tm-baris"><span className="pm-grow">F07 bertanda tangan atasan</span><BukaBerkas path={p.file_f07_ttd_url} label="Buka" /></li> : null}
          </ul>
        </Kartu>
      </div>

      <Kartu judul="Bukti portofolio" sub="Nomor bukti dirujuk pemohon pada Formulir Evaluasi Diri (F03)" padat>
        {d.bukti.length ? (
          <div className="table-wrap">
            <table className="pm-tabel pm-tabel-responsif">
              <thead><tr><th style={{ width: 56 }}>No.</th><th>Dokumen</th><th style={{ width: 240 }}>Jenis</th><th style={{ width: 140 }}>Keterangan</th><th style={{ width: 110 }}><span className="pm-sr">Buka</span></th></tr></thead>
              <tbody>
                {d.bukti.map((x) => (
                  <tr key={x.id}>
                    <td className="pm-tebal" data-label="No.">{x.nomor}</td>
                    <td data-label="Dokumen"><div className="pm-tebal">{x.nama_dokumen}</div>{x.deskripsi ? <div className="pm-kecil">{x.deskripsi}</div> : null}</td>
                    <td className="pm-kecil" data-label="Jenis">{LABEL_BUKTI[x.jenis] || x.jenis}</td>
                    <td data-label="Keterangan"><div className="pm-tumpuk">
                      {x.disahkan_atasan ? <span className="pm-kecil">Disahkan atasan</span> : null}
                      {x.is_bukti_tambahan ? <Lencana warna="indigo">Bukti tambahan</Lencana> : null}
                    </div></td>
                    <td data-label="">
                      {x.file_url ? <BukaBerkas path={x.file_url} label="Buka" /> : null}
                      {x.tautan ? <a className="btn btn-ghost btn-sm" href={x.tautan} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Tautan</a> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="pm-kosong">Pemohon belum mengunggah bukti.</p>}
      </Kartu>

      <Kartu judul="Daftar Riwayat Hidup (F07)">
        <div className="as-riwayat">
          {KATEGORI_RIWAYAT.map((k) => {
            const isi = d.butirRiwayat.filter((x) => x.kategori === k.v)
            if (!isi.length) return null
            return (
              <div key={k.v}>
                <div className="pm-tebal">{k.l}</div>
                <ul className="as-ul">
                  {isi.map((x) => <li key={x.id}>{[x.tahun, x.nama, x.jurusan || x.penyelenggara, x.jangka_waktu || x.peran].filter(Boolean).join(' · ')}</li>)}
                </ul>
              </div>
            )
          })}
          {!d.butirRiwayat.length ? <p className="pm-kecil">Riwayat belum diisi.</p> : null}
        </div>
      </Kartu>
    </div>
  )
}

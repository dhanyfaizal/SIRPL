// Persetujuan Komite RPL atas hasil rekognisi yang sudah disetujui pemohon.
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Undo2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { usePimpinan } from '../PimpinanData'
import { BOLEH, ringkasHasil } from '../aturan'
import { JENIS_RPL, tanggal } from '../../pemohon/konstanta'
import { BarTahap, Bidang, Dialog, Halaman, Kartu, Kerangka, Lencana, LencanaStatus, Pemberitahuan, Tombol } from '../../pemohon/ui'

const TAB = [
  { id: 'menunggu', label: 'Menunggu keputusan', status: ['menunggu_komite'] },
  { id: 'dikembalikan', label: 'Dikembalikan', status: ['dikembalikan_komite'] },
  { id: 'disetujui', label: 'Sudah disetujui', status: ['menunggu_sk', 'sk_terbit', 'selesai'] },
]

function Detail({ p }) {
  const { data, peta, role, muat } = usePimpinan()
  const navigate = useNavigate()
  const [dialog, setDialog] = useState(null)
  const [catatan, setCatatan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const r = ringkasHasil(p, data)
  const prodi = peta.prodi[p.prodi_pilihan_id]
  const riwayat = data.komite.filter((x) => x.pengajuan_id === p.id)
  const sanggahan = data.klarifikasi.filter((x) => x.pengajuan_id === p.id)
  const bolehPutus = BOLEH.putuskanKomite(role) && p.status === 'menunggu_komite'
  const u = peta.orang[p.user_id]

  const putuskan = async () => {
    if (dialog === 'dikembalikan' && !catatan.trim()) { toast.error('Tuliskan alasan pengembalian'); return }
    setSibuk(true)
    try {
      const { error } = await supabase.rpc('putuskan_komite', { p_pengajuan: p.id, p_keputusan: dialog, p_catatan: catatan.trim() || null })
      if (error) throw new Error(error.message)
      toast.success(dialog === 'disetujui' ? 'Hasil rekognisi disetujui. Diteruskan untuk penerbitan SK.' : 'Dikembalikan ke Tim Pengelola RPL')
      setDialog(null)
      await muat()
      navigate('/pimpinan/komite')
    } catch (e) { toast.error(e.message) } finally { setSibuk(false) }
  }

  return (
    <Halaman judul={u?.nama_lengkap || u?.email || 'Pemohon'}
      sub={<>{p.nomor_pendaftaran} · {prodi?.nama} · {JENIS_RPL[p.jenis_rpl]?.label}{p.disetujui_pemohon_at ? ` · disetujui pemohon ${tanggal(p.disetujui_pemohon_at)}` : ''}</>}
      aksi={<Link to="/pimpinan/komite" className="btn btn-secondary"><ArrowLeft size={14} /> Persetujuan Komite</Link>}>
      <div className="tm-kepala-info"><LencanaStatus status={p.status} />{sanggahan.length ? <Lencana warna="amber">{sanggahan.length} sanggahan pernah diajukan</Lencana> : null}</div>
      {p.status === 'dikembalikan_komite' && p.catatan_revisi ? <Pemberitahuan jenis="amber" judul="Alasan pengembalian">{p.catatan_revisi}</Pemberitahuan> : null}
      <div className="tm-stat">
        <div className="stat-card"><div className="stat-card-label">SKS diakui</div><div className="stat-card-value">{r.sksDiakui}</div><div className="stat-card-sub">{r.diakui.length} dari {r.baris.length} mata kuliah</div></div>
        <div className="stat-card"><div className="stat-card-label">Transfer kredit</div><div className="stat-card-value">{r.sksTransfer}</div><div className="stat-card-sub">SKS</div></div>
        <div className="stat-card"><div className="stat-card-label">Perolehan kredit</div><div className="stat-card-value">{r.sksPerolehan}</div><div className="stat-card-sub">SKS</div></div>
        <div className="stat-card"><div className="stat-card-label">Sisa beban studi</div><div className="stat-card-value">{prodi?.beban_sks_minimal ? Math.max(0, prodi.beban_sks_minimal - r.sksDiakui) : '-'}</div><div className="stat-card-sub">batas RPL {prodi?.maks_sks_rpl || 100} SKS</div></div>
      </div>
      <Kartu judul="Hasil penilaian per mata kuliah" padat>
        <div className="table-wrap">
          <table className="pm-tabel pm-tabel-responsif">
            <thead><tr><th style={{ width: 110 }}>Kode</th><th>Mata kuliah</th><th style={{ width: 56 }}>SKS</th><th style={{ width: 110 }}>Mekanisme</th><th style={{ width: 130 }}>Keputusan</th><th style={{ width: 64 }}>Nilai</th><th>Catatan asesor</th></tr></thead>
            <tbody>
              {r.baris.map((b) => (
                <tr key={b.mk_id}>
                  <td className="pm-kecil" data-label="Kode">{b.mk.kode_mk}</td>
                  <td data-label="Mata kuliah">{b.mk.nama_mk}</td>
                  <td data-label="SKS">{b.mk.sks}</td>
                  <td data-label="Mekanisme">{b.mekanisme === 'transfer' ? 'Transfer' : 'Perolehan'}</td>
                  <td data-label="Keputusan">{b.keputusan === 'diakui' ? <Lencana warna="green">Diakui</Lencana> : <Lencana warna="red">Tidak diakui</Lencana>}</td>
                  <td className="pm-tebal" data-label="Nilai">{b.pn?.nilai_huruf || '-'}</td>
                  <td className="pm-kecil" data-label="Catatan">{b.pn?.catatan || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kartu>
      {riwayat.length ? (
        <Kartu judul="Riwayat keputusan Komite" padat>
          <ul className="tm-daftar">
            {riwayat.map((x) => (
              <li key={x.id} className="tm-baris">
                <Lencana warna={x.keputusan === 'disetujui' ? 'green' : 'amber'}>{x.keputusan === 'disetujui' ? 'Disetujui' : 'Dikembalikan'}</Lencana>
                <span className="pm-grow pm-kecil">{x.catatan || '-'}</span>
                <span className="pm-kecil">{tanggal(x.created_at, true)}</span>
              </li>
            ))}
          </ul>
        </Kartu>
      ) : null}
      {bolehPutus ? (
        <BarTahap info="Periksa kesesuaian hasil dengan ketentuan Juknis dan Pedoman RPL.">
          <Tombol ikon={Undo2} onClick={() => { setCatatan(''); setDialog('dikembalikan') }}>Kembalikan</Tombol>
          <Tombol jenis="primary" ikon={Check} onClick={() => { setCatatan(''); setDialog('disetujui') }}>Setujui</Tombol>
        </BarTahap>
      ) : null}
      <Dialog buka={!!dialog} judul={dialog === 'disetujui' ? 'Setujui hasil rekognisi' : 'Kembalikan ke Tim Pengelola RPL'} onTutup={() => setDialog(null)}
        kaki={<><Tombol onClick={() => setDialog(null)}>Batal</Tombol><Tombol jenis="primary" sibuk={sibuk} onClick={putuskan}>{dialog === 'disetujui' ? 'Setujui' : 'Kembalikan'}</Tombol></>}>
        {dialog === 'disetujui'
          ? <p>Pengakuan {r.sksDiakui} SKS dari {r.diakui.length} mata kuliah disetujui dan diteruskan untuk ditetapkan dengan SK Ketua STIKOM Yos Sudarso.</p>
          : <p>Tim Pengelola RPL akan meninjau ulang, lalu mengirim kembali ke Komite atau meminta asesor menilai ulang.</p>}
        <Bidang label={dialog === 'disetujui' ? 'Catatan (opsional)' : 'Alasan pengembalian'} wajib={dialog !== 'disetujui'}>
          <textarea className="input" rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        </Bidang>
      </Dialog>
    </Halaman>
  )
}

export default function Komite() {
  const { id } = useParams()
  const [param, setParam] = useSearchParams()
  const { siap, data, peta, galat } = usePimpinan()
  const navigate = useNavigate()
  if (galat && !siap) return <Halaman judul="Persetujuan Komite"><Pemberitahuan jenis="red" judul="Data tidak dapat dimuat">{galat}</Pemberitahuan></Halaman>
  if (!siap) return <Kerangka />
  if (id) {
    const p = data.pengajuan.find((x) => x.id === id)
    return p ? <Detail p={p} /> : <Halaman judul="Pengajuan tidak ditemukan"><Pemberitahuan jenis="amber"><Link to="/pimpinan/komite">Kembali</Link></Pemberitahuan></Halaman>
  }
  const tab = TAB.find((t) => t.id === param.get('tab')) || TAB[0]
  const baris = data.pengajuan.filter((p) => tab.status.includes(p.status))
  return (
    <Halaman judul="Persetujuan Komite RPL" sub="Hasil rekognisi yang sudah disetujui pemohon. Komite memeriksa lalu menyetujui atau mengembalikan ke Tim Pengelola RPL.">
      <section className="card">
        <div className="pm-tabs" role="tablist">
          {TAB.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={t.id === tab.id} className={t.id === tab.id ? 'is-on' : ''} onClick={() => setParam(t.id === 'menunggu' ? {} : { tab: t.id })}>
              {t.label}<span className="pm-hit">{data.pengajuan.filter((p) => t.status.includes(p.status)).length}</span>
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table className="pm-tabel tm-tabel">
            <thead><tr><th>Pemohon</th><th style={{ width: 200 }}>Program studi</th><th style={{ width: 140 }}>Jenis RPL</th><th style={{ width: 130 }}>SKS diakui</th><th style={{ width: 190 }}>Status</th></tr></thead>
            <tbody>
              {baris.map((p) => {
                const r = ringkasHasil(p, data)
                const u = peta.orang[p.user_id]
                return (
                  <tr key={p.id} className="tm-klik" tabIndex={0} onClick={() => navigate(`/pimpinan/komite/${p.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/pimpinan/komite/${p.id}`) }}>
                    <td className="tm-c-nama"><Link to={`/pimpinan/komite/${p.id}`} className="pm-tebal tm-nama" onClick={(e) => e.stopPropagation()}>{u?.nama_lengkap || u?.email || 'Pemohon'}</Link><div className="pm-kecil">{p.nomor_pendaftaran}</div></td>
                    <td className="tm-c-prodi">{peta.prodi[p.prodi_pilihan_id]?.nama || '-'}</td>
                    <td className="tm-c-jenis">{JENIS_RPL[p.jenis_rpl]?.label || '-'}</td>
                    <td className="tm-c-mk"><span className="pm-tebal">{r.sksDiakui} SKS</span><div className="pm-kecil">{r.diakui.length} dari {r.baris.length} MK</div></td>
                    <td className="tm-c-status"><LencanaStatus status={p.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!baris.length ? <p className="pm-kosong">Tidak ada pengajuan di kelompok ini.</p> : null}
        </div>
      </section>
    </Halaman>
  )
}

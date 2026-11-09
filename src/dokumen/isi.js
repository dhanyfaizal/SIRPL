// Penyusun isi dokumen (snapshot JSON). Isi dibekukan saat diterbitkan:
// perubahan data sesudahnya tidak mengubah dokumen yang sudah ditandatangani.
import { supabase } from '../lib/supabase'
import { JENIS_BUKTI, JENIS_RPL, KATEGORI_RIWAYAT, STATUS_KAWIN, STATUS_KERJA, STATUS_PDDIKTI, tanggalPanjang } from '../pemohon/konstanta'

function cek({ data, error }) {
  if (error) throw new Error(error.message || 'Terjadi kesalahan pada server')
  return data
}
const LABEL_BUKTI = Object.fromEntries(JENIS_BUKTI.map((j) => [j.v, j.l]))
const MEK = { transfer: 'Transfer kredit', perolehan: 'Perolehan kredit' }

export const DOKUMEN_PENGAJUAN = [
  { kode: 'F02', label: 'Formulir Aplikasi (F02)', syarat: (p) => p.status !== 'draft' },
  { kode: 'F07', label: 'Daftar Riwayat Hidup (F07)', syarat: (p) => p.status !== 'draft' },
  { kode: 'F03', label: 'Formulir Evaluasi Diri (F03)', syarat: (p, x) => x.perolehan > 0 && x.dinilai > 0 },
  { kode: 'F09', label: 'Formulir Konversi Mata Kuliah (F09)', syarat: (p, x) => x.transfer > 0 && x.dinilai > 0 },
  { kode: 'F10', label: 'Lembar Penilaian Lanjutan (F10)', perJadwal: true, syarat: (p, x) => x.jadwalSelesai > 0 },
  { kode: 'F12', label: 'Berkas Sanggahan dan Tanggapan (F12)', perKlarifikasi: true, syarat: (p, x) => x.klarifikasiDitanggapi > 0 },
  { kode: 'SURAT_HASIL', label: 'Surat Hasil Rekognisi', syarat: (p) => ['hasil_disampaikan', 'klarifikasi', 'menunggu_komite', 'dikembalikan_komite', 'menunggu_sk', 'sk_terbit', 'selesai'].includes(p.status) },
]

async function konteksPengajuan(id) {
  const p = cek(await supabase.from('pengajuan_rpl').select('*').eq('id', id).single())
  const q = (t) => supabase.from(t).select('*').eq('pengajuan_id', id)
  const [u, prodi, periode, biodata, riwayat, butir, mk, mkDiajukan, evaluasi, bukti, penilaian, lanjutan, jadwal, klarifikasi, pddikti, pleno] = await Promise.all([
    supabase.from('profiles').select('id, nama_lengkap, email, no_whatsapp').eq('id', p.user_id).maybeSingle().then(cek),
    supabase.from('program_studi').select('*').eq('id', p.prodi_pilihan_id).maybeSingle().then(cek),
    p.periode_id ? supabase.from('periode_rpl').select('*').eq('id', p.periode_id).maybeSingle().then(cek) : null,
    supabase.from('biodata_pemohon').select('*').eq('user_id', p.user_id).maybeSingle().then(cek),
    supabase.from('riwayat_hidup').select('*').eq('user_id', p.user_id).maybeSingle().then(cek),
    supabase.from('riwayat_hidup_butir').select('*').eq('user_id', p.user_id).order('kategori').order('urutan').then(cek),
    supabase.from('mata_kuliah_kurikulum').select('*').eq('prodi_id', p.prodi_pilihan_id).then(cek),
    q('mk_diajukan').then(cek), q('evaluasi_diri').then(cek), q('bukti_portofolio').order('nomor').then(cek),
    q('penilaian_mk').then(cek), q('penilaian_lanjutan').then(cek), q('jadwal_asesmen').order('waktu').then(cek),
    q('klarifikasi_rpl').order('created_at').then(cek), q('verifikasi_pddikti').maybeSingle().then(cek),
    p.pleno_id ? supabase.from('pleno_rpl').select('*').eq('id', p.pleno_id).maybeSingle().then(cek) : null,
  ])
  const mkId = (id2) => (mk || []).find((m) => m.id === id2)
  const baris = (mkDiajukan || []).map((m) => ({ ...m, mk: mkId(m.mk_id), pn: (penilaian || []).find((x) => x.mk_id === m.mk_id) })).filter((b) => b.mk)
    .sort((a, b) => (a.mk.semester - b.mk.semester) || a.mk.kode_mk.localeCompare(b.mk.kode_mk))
  return { p, u, prodi, periode, biodata, riwayat, butir: butir || [], mk: mk || [], baris, evaluasi: evaluasi || [], bukti: bukti || [],
    lanjutan: lanjutan || [], jadwal: jadwal || [], klarifikasi: klarifikasi || [], pddikti, pleno }
}

// Ringkasan untuk menentukan dokumen apa yang sudah dapat diterbitkan.
export function hitungSyarat(k) {
  return {
    transfer: k.baris.filter((b) => b.mekanisme === 'transfer').length,
    perolehan: k.baris.filter((b) => b.mekanisme === 'perolehan').length,
    dinilai: k.baris.filter((b) => b.pn && b.pn.keputusan !== 'belum_dinilai').length,
    jadwalSelesai: k.jadwal.filter((j) => j.status === 'selesai').length,
    klarifikasiDitanggapi: k.klarifikasi.filter((x) => x.keputusan).length,
  }
}

const kepala = (k) => ({
  pemohon: { nama: k.u?.nama_lengkap || '', email: k.u?.email || '', hp: k.u?.no_whatsapp || '' },
  nomor_pendaftaran: k.p.nomor_pendaftaran, prodi: k.prodi ? `${k.prodi.jenjang || ''} ${k.prodi.nama}`.trim() : '',
  jenis_rpl: JENIS_RPL[k.p.jenis_rpl]?.label || k.p.jenis_rpl, periode: k.periode?.nama || '',
})
const barisMk = (b) => ({ kode: b.mk.kode_mk, nama: b.mk.nama_mk, sks: b.mk.sks, semester: b.mk.semester, mekanisme: MEK[b.mekanisme] })

const SUSUN = {
  F02: (k) => {
    const b = k.biodata || {}; const r = k.riwayat || {}
    return {
      judul: `Formulir Aplikasi RPL - ${k.u?.nama_lengkap || ''}`,
      isi: {
        ...kepala(k), diajukan: k.p.submitted_at,
        pribadi: [
          ['Nama lengkap', k.u?.nama_lengkap], ['Tempat, tanggal lahir', [b.tempat_lahir, tanggalPanjang(b.tanggal_lahir)].filter(Boolean).join(', ')],
          ['Jenis kelamin', b.jenis_kelamin === 'pria' ? 'Pria' : b.jenis_kelamin === 'wanita' ? 'Wanita' : ''],
          ['Status perkawinan', STATUS_KAWIN[b.status_perkawinan] || b.status_perkawinan], ['Kebangsaan', b.kebangsaan || b.kewarganegaraan], ['Agama', b.agama],
          ['Alamat rumah', [b.alamat, b.kota, b.kode_pos].filter(Boolean).join(', ')], ['Telepon / HP', [b.telepon_rumah, k.u?.no_whatsapp].filter(Boolean).join(' / ')],
          ['Email', k.u?.email], ['Pendidikan terakhir', [b.pendidikan_terakhir, b.nama_sekolah_pt, b.tahun_lulus].filter(Boolean).join(', ')],
        ],
        pekerjaan: [['Institusi', r.institusi_kerja], ['Jabatan', r.jabatan], ['Status pekerjaan', STATUS_KERJA[r.status_pekerjaan] || r.status_pekerjaan], ['Alamat kantor', r.alamat_kerja], ['Telepon kantor', r.telepon_kerja]],
        pt_asal: ['transfer', 'gabungan'].includes(k.p.jenis_rpl) ? [['Perguruan tinggi asal', k.p.pt_asal], ['Program studi asal', k.p.prodi_asal], ['Status di PDDikti', STATUS_PDDIKTI[k.p.status_pddikti_asal] || k.p.status_pddikti_asal]] : null,
        mk: k.baris.map(barisMk),
      },
    }
  },
  F07: (k) => {
    const b = k.biodata || {}; const r = k.riwayat || {}
    return {
      judul: `Daftar Riwayat Hidup - ${k.u?.nama_lengkap || ''}`,
      isi: {
        ...kepala(k),
        identitas: [['Nama', k.u?.nama_lengkap], ['Tempat, tanggal lahir', [b.tempat_lahir, tanggalPanjang(b.tanggal_lahir)].filter(Boolean).join(', ')],
          ['Institusi tempat bekerja', r.institusi_kerja], ['Jabatan', r.jabatan], ['Alamat rumah', b.alamat], ['Email', k.u?.email]],
        bagian: KATEGORI_RIWAYAT.map((kat) => ({
          judul: kat.l, kolom: kat.kolom.map((c) => kat.label[c]),
          baris: k.butir.filter((x) => x.kategori === kat.v).map((x) => kat.kolom.map((c) => (x[c] ?? '') + '')),
        })),
      },
    }
  },
  F03: (k) => ({
    judul: `Formulir Evaluasi Diri - ${k.u?.nama_lengkap || ''}`,
    isi: {
      ...kepala(k),
      bukti: k.bukti.map((x) => ({ nomor: x.nomor, nama: x.nama_dokumen, jenis: LABEL_BUKTI[x.jenis] || x.jenis })),
      mk: k.baris.filter((b) => b.mekanisme === 'perolehan').map((b) => {
        const ev = k.evaluasi.find((e) => e.mk_id === b.mk_id)
        const sub = (b.mk.sub_cpmk || []).length ? b.mk.sub_cpmk : [{ kode: 'CPMK', deskripsi: b.mk.cpmk || 'Capaian pembelajaran mata kuliah' }]
        return {
          ...barisMk(b), deskripsi: b.mk.deskripsi || '', nomor_fed: b.mk.nomor_fed || '', tempat: ev?.tempat_pernyataan || '',
          butir: sub.map((s) => {
            const bt = (ev?.butir || []).find((x) => x.sub_cpmk === s.kode) || {}
            const v = (b.pn?.vatm || []).find((x) => x.sub_cpmk === s.kode) || {}
            return { kode: s.kode, deskripsi: s.deskripsi || s.teks || '', profisiensi: bt.profisiensi || '', bukti: bt.bukti || [],
              vatm: { V: !!v.valid, A: !!v.autentik, T: !!v.terkini, M: !!v.memadai } }
          }),
          keputusan: b.pn?.keputusan || 'belum_dinilai', nilai: b.pn?.nilai_huruf || '', catatan: b.pn?.catatan || '',
        }
      }),
    },
  }),
  F09: (k) => ({
    judul: `Formulir Konversi Mata Kuliah - ${k.u?.nama_lengkap || ''}`,
    isi: {
      ...kepala(k), pt_asal: k.p.pt_asal || '', prodi_asal: k.p.prodi_asal || '',
      pddikti: k.pddikti ? { ijazah: k.pddikti.ijazah_sesuai, transkrip: k.pddikti.transkrip_sesuai, status: k.pddikti.status_mahasiswa_pddikti || '' } : null,
      baris: k.baris.filter((b) => b.mekanisme === 'transfer').map((b) => {
        const a = (b.pn?.asal || [])[0] || {}
        return { asal: { kode: a.kode || '', nama: a.nama || '', sks: a.sks ?? '', nilai: a.nilai || '' }, tujuan: barisMk(b),
          keputusan: b.pn?.keputusan || 'belum_dinilai', nilai: b.pn?.nilai_huruf || '', catatan: b.pn?.catatan || '' }
      }),
    },
  }),
  F10: (k, { jadwalId }) => {
    const j = k.jadwal.find((x) => x.id === jadwalId)
    if (!j) throw new Error('Jadwal tidak ditemukan')
    return {
      judul: `Lembar Penilaian Lanjutan - ${k.u?.nama_lengkap || ''}`,
      isi: {
        ...kepala(k), jadwal: { jenis: j.jenis, waktu: j.waktu, mode: j.mode, tempat: j.mode === 'daring' ? 'Daring (Google Meet)' : (j.ruangan || ''), hasil: j.hasil || '' },
        mk: (j.mk_ids || []).map((id) => {
          const m = k.mk.find((x) => x.id === id); const f = k.lanjutan.find((x) => x.jadwal_id === j.id && x.mk_id === id)
          return m ? { kode: m.kode_mk, nama: m.nama_mk, sks: m.sks, butir: f?.butir || [], hasil: f?.hasil || '', catatan: f?.catatan || '' } : null
        }).filter(Boolean),
      },
    }
  },
  F12: (k, { klarifikasiId }) => {
    const x = k.klarifikasi.find((y) => y.id === klarifikasiId)
    if (!x) throw new Error('Sanggahan tidak ditemukan')
    return {
      judul: `Sanggahan dan Tanggapan - ${k.u?.nama_lengkap || ''}`,
      isi: { ...kepala(k), diajukan: x.created_at, mk: (x.mk_ids || []).map((id) => k.mk.find((m) => m.id === id)).filter(Boolean).map((m) => `${m.kode_mk} ${m.nama_mk}`),
        alasan: x.alasan, bukti_nomor: x.bukti_nomor || [], keputusan: x.keputusan || '', tanggapan: x.tanggapan || '' },
    }
  },
  SURAT_HASIL: (k) => {
    const diakui = k.baris.filter((b) => b.pn?.keputusan === 'diakui')
    return {
      judul: `Surat Hasil Rekognisi - ${k.u?.nama_lengkap || ''}`,
      isi: {
        ...kepala(k), pleno: k.pleno ? { tanggal: k.pleno.tanggal, nomor_ba: k.pleno.nomor_berita_acara || '' } : null,
        diakui: diakui.map((b) => ({ ...barisMk(b), nilai: b.pn.nilai_huruf })),
        tidak_diakui: k.baris.filter((b) => b.pn?.keputusan !== 'diakui').map(barisMk),
        sks_diakui: diakui.reduce((n, b) => n + b.mk.sks, 0), beban: k.prodi?.beban_sks_minimal || null,
      },
    }
  },
  F08: (k, { sk }) => {
    const diakui = k.baris.filter((b) => b.pn?.keputusan === 'diakui')
    return {
      judul: `Lampiran SK Hasil RPL - ${k.u?.nama_lengkap || ''}`,
      isi: {
        ...kepala(k), sk: { nomor: sk.nomor_sk, tanggal: sk.tanggal_sk, perihal: sk.perihal || '' },
        diakui: diakui.map((b) => ({ ...barisMk(b), nilai: b.pn.nilai_huruf })),
        sks_diakui: diakui.reduce((n, b) => n + b.mk.sks, 0), beban: k.prodi?.beban_sks_minimal || null,
      },
    }
  },
}

// Menyusun dan menerbitkan satu dokumen untuk satu pengajuan.
export async function susunPengajuan(kode, pengajuanId, opsi = {}) {
  const k = await konteksPengajuan(pengajuanId)
  const { isi, judul } = SUSUN[kode](k, opsi)
  return { isi, judul, k }
}
export { konteksPengajuan }

// Berita Acara Pleno (F11)
export async function susunPleno(plenoId) {
  const pl = cek(await supabase.from('pleno_rpl').select('*').eq('id', plenoId).single())
  const [peserta, pp, prodi] = await Promise.all([
    supabase.from('peserta_pleno').select('*').eq('pleno_id', plenoId).order('urutan').then(cek),
    supabase.from('pleno_pengajuan').select('*').eq('pleno_id', plenoId).then(cek),
    pl.prodi_id ? supabase.from('program_studi').select('nama, jenjang').eq('id', pl.prodi_id).maybeSingle().then(cek) : null,
  ])
  const ids = [...new Set((pp || []).map((x) => x.pengajuan_id))]
  const orangIds = [...new Set((peserta || []).map((x) => x.profile_id))]
  const [pgj, pn, mkd, orangPeserta] = await Promise.all([
    ids.length ? supabase.from('pengajuan_rpl').select('id, user_id, nomor_pendaftaran, jenis_rpl').in('id', ids).then(cek) : [],
    ids.length ? supabase.from('penilaian_mk').select('pengajuan_id, mk_id, keputusan, nilai_huruf').in('pengajuan_id', ids).then(cek) : [],
    ids.length ? supabase.from('mk_diajukan').select('pengajuan_id, mk_id').in('pengajuan_id', ids).then(cek) : [],
    orangIds.length ? supabase.from('profiles').select('id, nama_lengkap').in('id', orangIds).then(cek) : [],
  ])
  const pemohon = pgj.length ? cek(await supabase.from('profiles').select('id, nama_lengkap').in('id', pgj.map((p) => p.user_id))) : []
  const mk = pl.prodi_id ? cek(await supabase.from('mata_kuliah_kurikulum').select('id, sks').eq('prodi_id', pl.prodi_id)) : []
  return {
    judul: `Berita Acara ${pl.jenis === 'awal' ? 'Pleno Awal' : 'Pleno Hasil Rekognisi'}${prodi ? ` ${prodi.nama}` : ''}`,
    isi: {
      jenis: pl.jenis, tanggal: pl.tanggal, tempat: pl.tempat || '', nomor_ba: pl.nomor_berita_acara || '', notulen: pl.notulen || '',
      prodi: prodi ? `${prodi.jenjang || ''} ${prodi.nama}`.trim() : '',
      peserta: (peserta || []).map((x) => ({ nama: orangPeserta.find((o) => o.id === x.profile_id)?.nama_lengkap || '', jabatan: x.jabatan_dalam_pleno || '' })),
      pengajuan: pgj.map((p) => {
        const d = pn.filter((x) => x.pengajuan_id === p.id)
        const diakui = d.filter((x) => x.keputusan === 'diakui')
        return {
          nama: pemohon.find((o) => o.id === p.user_id)?.nama_lengkap || '', nomor: p.nomor_pendaftaran, jenis_rpl: JENIS_RPL[p.jenis_rpl]?.label || p.jenis_rpl,
          mk_diajukan: mkd.filter((x) => x.pengajuan_id === p.id).length, mk_diakui: diakui.length,
          lanjutan: d.filter((x) => x.keputusan === 'perlu_asesmen_lanjutan').length,
          sks_diakui: diakui.reduce((n, x) => n + (mk.find((m) => m.id === x.mk_id)?.sks || 0), 0),
          catatan: (pp || []).find((x) => x.pengajuan_id === p.id && x.keputusan)?.keputusan || '',
        }
      }),
    },
  }
}

# Rencana Rilis Produksi SIRPL (alur Juknis RPL Tipe A)

Dokumen ini menyusun langkah memindahkan cabang `feat/alur-pedoman` (sudah diuji di staging,
lihat `docs/UJI_ALUR_SIRPL.md`) ke produksi. **Dokumen ini tidak menjalankan apa pun**; setiap
langkah dijalankan oleh penanggung jawab yang ditunjuk.

> Tidak ada kata sandi, token, atau kunci di dokumen ini. Simpan rahasia di pengelola sandi tim.

---

## 1. Ringkasan

| Hal | Nilai (per 10 Nov 2026) |
|---|---|
| Cabang yang dirilis | `feat/alur-pedoman` — **42 commit** di depan `main` |
| Migrasi basis data baru | **24 berkas** (`20261105230000` s.d. `20261126000000`), termasuk 1 migrasi **data** |
| Produksi (aplikasi) | `rpl.stikomyos.my.id`, `sirpl.vercel.app` (Vercel, cabang `main`) |
| Produksi (basis data) | Proyek Supabase **DB_SistemRPL** (paket FREE: tidak ada PITR, cadangan harus dibuat sendiri) |
| Staging (acuan uji) | `sirpl-staging-stikomyos.vercel.app` + Supabase **SIRPL-staging** (`cwmzxdcwqolhfnfxrqay`) |
| Data alur lama | 23 pengajuan alur lama (`alur_versi = 1`) di staging; **jumlah di produksi dipastikan lewat skrip pratinjau**. Tetap dapat dilihat lewat dasbor lama |
| Perkiraan waktu henti | 60–90 menit (cadangan, migrasi, deploy, uji asap) |

**Keputusan go/no-go** diambil setelah gladi bersih (bagian 4) lulus dan semua butir bagian 3 tercentang.

---

## 2. Isi rilis (yang berubah bagi pengguna)

- Alur lengkap Juknis: pendaftaran → verifikasi BAAK → asesmen (transfer/perolehan, AISYS) →
  pleno awal/hasil (F11) → Surat Hasil/F09 → sanggahan → Komite → SK + F08 → NIM (wajib lunas) → pelaporan PDDikti.
- Modul baru: PMB/Keuangan (tagihan, diskon, cicilan, verifikasi), Komite/Pimpinan, Repositori + tautan berbagi,
  Laporan dan analitik, Tanda tangan elektronik + verifikasi QR, Konsol Admin.
- Notifikasi WhatsApp **manual** lewat nomor WA Business (menu "WA keluar"); Fonnte disimpan sebagai opsi nonaktif.
- Daftar temuan dan perbaikannya: `docs/UJI_ALUR_SIRPL.md` bagian 3 (#17–#48).

---

## 3. Prasyarat sebelum hari H

Centang semua sebelum menjadwalkan rilis.

### 3.1 Keamanan
- [ ] Rotasi kunci **Sumopod** yang pernah bocor; pasang kunci baru **hanya** sebagai secret Edge Function `AISYS_API_KEY` di DB_SistemRPL.
- [ ] Rotasi token **Fonnte** yang pernah bocor (tetap perlu walau mode manual, agar token lama tidak bisa dipakai).
- [ ] Hapus `VITE_SUMOPOD_API_URL` dan `VITE_SUMOPOD_API_KEY` dari **Environment Variables Vercel (Production dan Preview)**. Kode frontend sudah tidak memakainya; variabel `VITE_*` ikut terbundel ke browser bila dipakai. Perbarui `.env.example` sekalian.
- [ ] Pindahkan `Cloudflare.txt` dan `recovery-codes (1).txt` keluar dari folder proyek (sudah di-*ignore*, tetapi jangan disimpan di repo lokal).
- [ ] Pastikan tidak ada akun `uji.*` yang dibuat di DB_SistemRPL.

### 3.2 Migrasi data
- [ ] **Buat skrip pratinjau** `scripts/pratinjau_migrasi_alur_pedoman.sql` (dirujuk oleh `20261106010000_alur_pedoman_migrasi_data.sql`, tetapi **belum ada di repo**). Isinya kueri `SELECT` saja: jumlah pengajuan per status lama, pemetaan status lama → baru, program studi yang akan diubah, dan baris yang tidak terpetakan.
- [ ] Putuskan kebijakan pengajuan alur lama: tetap dibaca lewat dasbor lama (bawaan), diarsipkan (`is_archived`), atau dimigrasikan manual.
- [ ] Cek apakah `20261105230000_hotfix_keamanan_produksi.sql` **sudah pernah** dijalankan di DB_SistemRPL (lihat bagian 5 langkah 3).

### 3.3 Data rujukan produksi
- [ ] **Kurikulum + sub-CPMK** SI dan TI dari Kaprodi (F10 memakai sub-CPMK).
- [ ] Periode aktif 2026/2027 dan **tarif** (pendaftaran, asesmen per SKS, matrikulasi, dll.).
- [ ] **Penandatangan dokumen** (Ketua Tim, Sekretaris, Ketua STIKOM) dan **nomor awal** F11, Surat Hasil, SK sesuai buku agenda.
- [ ] Akun staf sungguhan: peran, homebase prodi asesor, **nama lengkap** (tercetak di dokumen) dan **nomor WhatsApp** (WA staf tidak masuk antrean bila kosong).
- [ ] Nomor **WA Business institusi** sudah ditautkan di WhatsApp Desktop/Web komputer BAAK dan PMB.

### 3.4 Uji penerimaan
- [ ] Uji oleh pengguna sebenarnya (BAAK, PMB, Sekretaris, Ketua Tim, asesor, Komite) di staging minimal 3 hari kerja; catat temuan di `docs/UJI_ALUR_SIRPL.md`.
- [ ] Sisa uji teknis: #48 (pesan "dikirim ulang" ke BAAK) dan satu pengajuan prodi TI.

---

## 4. Gladi bersih (wajib sebelum hari H)

Tujuan: membuktikan 24 migrasi berjalan pada **salinan data produksi**, bukan data uji.

1. Buat proyek Supabase sementara (mis. `SIRPL-gladi`).
2. Ambil cadangan produksi (lihat 5.2) lalu pulihkan ke `SIRPL-gladi`.
3. Jalankan skrip pratinjau (3.2) dan simpan hasilnya.
4. Jalankan 24 migrasi berurutan (5.3). Catat waktu tiap berkas dan galat bila ada.
5. Jalankan pengecekan pasca-migrasi (5.6) pada `SIRPL-gladi`.
6. Arahkan satu deploy Preview Vercel ke `SIRPL-gladi` dan lakukan uji asap (bagian 6) dengan data salinan.
7. Hapus proyek `SIRPL-gladi` setelah selesai (berisi data pribadi pemohon).

Lanjut ke hari H **hanya** bila semua langkah lulus tanpa perbaikan manual. Bila ada perbaikan,
masukkan ke migrasi baru, lalu ulangi gladi.

---

## 5. Hari H

Jadwalkan di luar jam layanan. Umumkan pemeliharaan ke staf (dan pemohon aktif) sehari sebelumnya.

### 5.1 Pembekuan
- Umumkan "SIRPL dalam pemeliharaan" dan minta staf tidak mengubah data.
- Catat commit `main` saat ini (untuk rollback aplikasi): `git rev-parse origin/main`.

### 5.2 Cadangan basis data produksi
Paket FREE tidak memiliki PITR; cadangan **harus** dibuat manual dan disimpan di luar Supabase.

```bash
supabase db dump --db-url "$DB_SISTEMRPL_URL" -f cadangan_skema_$(date +%Y%m%d_%H%M).sql
```

```bash
supabase db dump --db-url "$DB_SISTEMRPL_URL" --data-only -f cadangan_data_$(date +%Y%m%d_%H%M).sql
```

Unduh juga isi bucket Storage `rpl-documents` bila memungkinkan. Pastikan berkas cadangan bisa dibuka
sebelum lanjut.

### 5.3 Migrasi (SQL Editor DB_SistemRPL, berurutan)

Jalankan satu per satu sesuai urutan nama berkas. Semua berkas memakai `BEGIN/COMMIT` dan aman diulang.

| # | Berkas | Catatan |
|---|---|---|
| 1 | `20261105230000_hotfix_keamanan_produksi.sql` | **Lewati bila sudah pernah dijalankan** di produksi. Fungsinya ditimpa versi alur baru oleh migrasi berikutnya. |
| 2 | `20261106000000_alur_pedoman_skema.sql` | Skema alur baru |
| 3 | `20261106010000_alur_pedoman_migrasi_data.sql` | **Migrasi data.** Jalankan pratinjau dulu; bandingkan dengan hasil gladi |
| 4–24 | `20261108000000_…` s.d. `20261126000000_tagihan_berhenti_wa.sql` | Berurutan, tanpa melompati |

Bila satu berkas gagal: **berhenti**, catat galatnya, lalu putuskan perbaiki-dan-ulang atau rollback (bagian 7).

### 5.4 Edge Function (DB_SistemRPL)

| Fungsi | Perintah | Secret |
|---|---|---|
| `aisys` | `supabase functions deploy aisys` | `AISYS_API_KEY` (baru), `AISYS_API_URL`, `AISYS_MODEL` |
| `repositori` | `supabase functions deploy repositori --no-verify-jwt` | (memakai `SUPABASE_*` bawaan) |
| `notifikasi-wa` | **Tidak dipasang** (mode manual) | — |

### 5.5 Aplikasi
1. Buat PR `feat/alur-pedoman` → `main`, tinjau ringkasan perubahan, lalu merge.
2. Pastikan Environment Variables Vercel **Production**: `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` milik **DB_SistemRPL**, `VITE_CLOUDFLARE_TURNSTILE_SITE_KEY`, tanpa `VITE_SUMOPOD_*`.
3. Tunggu deploy Production selesai; pastikan domain `rpl.stikomyos.my.id` dan `sirpl.vercel.app` mengarah ke deploy terbaru.

### 5.6 Pengaturan dan pengecekan pasca-migrasi (Admin)
- Konsol Admin → Periode dan tarif, Program studi, Kurikulum: sesuai 3.3.
- Pengaturan dokumen: penandatangan dan nomor awal.
- Notifikasi WhatsApp: Status **Aktif**, Cara kirim **Manual**, alamat aplikasi `https://rpl.stikomyos.my.id`.
- Kueri cek (SQL Editor, hanya baca):
  - Jumlah pengajuan per `alur_versi` dan `status` sama dengan hasil pratinjau.
  - `SELECT count(*) FROM pengaturan_notifikasi;` = 1 dan `mode = 'manual'`.
  - Tidak ada pengajuan alur baru dengan `periode_id` kosong.

---

## 6. Uji asap setelah rilis (±20 menit)

Dengan akun staf sungguhan; **jangan** membuat pengajuan uji di produksi kecuali disepakati (bila dibuat, beri tanda jelas dan hapus/arsipkan sesudahnya).

- [ ] Login Google pemohon baru: Beranda pemohon tampil, "Mulai pengajuan" tersedia.
- [ ] Admin: Beranda Konsol (angka masuk akal), daftar pengguna, Notifikasi WhatsApp.
- [ ] BAAK: antrean verifikasi, Penetapan NIM, Pelaporan (tahap 1–4 sesuai data).
- [ ] PMB: Beranda keuangan, daftar tagihan, WA keluar.
- [ ] Ketua Tim/Sekretaris: Pleno, Tanda tangan (dengan sidebar).
- [ ] Pimpinan: Laporan dan analitik; Beranda "Selesai" tidak menghitung alur lama.
- [ ] Verifikasi QR dokumen lama (bila ada) masih sah.
- [ ] Dasbor alur lama masih bisa dibuka untuk pengajuan lama.
- [ ] AISYS: satu pembacaan transkrip pada pengajuan nyata yang sedang asesmen (bila ada), ±1–2 menit.

Bila satu butir gagal dan berdampak ke layanan, putuskan rollback dalam 30 menit.

---

## 7. Rollback

| Lapisan | Cara | Dampak |
|---|---|---|
| Aplikasi | Vercel → Deployments → *Promote to Production* deploy sebelum rilis (atau revert merge di `main`) | Cepat (menit); tidak mengubah data |
| Basis data | Pulihkan cadangan 5.2 ke DB_SistemRPL (skema + data) | Data yang masuk **setelah** rilis hilang; lakukan hanya bila migrasi merusak data |
| Edge Function | Hapus/deploy ulang versi lama | Aman |

Aplikasi lama **tidak cocok** dengan skema baru dan sebaliknya. Bila basis data tidak di-rollback,
jangan rollback aplikasi tanpa perbaikan; pilih perbaiki-maju (*fix forward*).

---

## 8. Risiko dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Migrasi data alur lama memetakan status keliru | Skrip pratinjau + gladi bersih; bandingkan angka sebelum/sesudah |
| Tidak ada PITR (paket FREE) | Cadangan manual 5.2, diuji bisa dibuka; pertimbangkan naik paket Pro selama masa rilis |
| Kunci lama bocor masih aktif | Rotasi di 3.1 sebelum hari H |
| Staf belum isi nomor WA → notifikasi staf tidak terkirim | 3.3; cek di Admin → Notifikasi ("N akun staf belum mengisi nomor") |
| Penandatangan/nomor dokumen keliru di dokumen resmi pertama | 3.3 + periksa dokumen pertama yang terbit sebelum ditandatangani |
| Pengguna bingung dengan alur baru | Petunjuk F01 di menu pemohon; sesi singkat untuk staf sebelum rilis |
| Pembatasan "Setujui hasil menunggu Surat Hasil" (#43) hanya di tampilan | Diterima untuk rilis; tambah pembatasan di basis data pada iterasi berikut |

---

## 9. Setelah rilis

- Pantau 1 minggu: Supabase Logs (galat API/Edge Function), antrean "WA keluar", keluhan pengguna.
- Lanjutkan sisa kecil: 156 galat lint lama, pemecahan bundel 1,4 MB, tes otomatis alur inti.
- Perbarui `docs/UJI_ALUR_SIRPL.md` dengan status produksi dan tutup temuan yang sudah dilepas.

---

## 10. Penanggung jawab (isi sebelum hari H)

| Peran | Nama | Tugas |
|---|---|---|
| Pemimpin rilis | | Go/no-go, koordinasi, keputusan rollback |
| Basis data | | Cadangan, pratinjau, migrasi, pengecekan |
| Aplikasi/Vercel | | PR, env vars, deploy, domain |
| Admin SIRPL | | Pengaturan 5.6, akun staf |
| Uji asap | | Bagian 6 bersama perwakilan BAAK dan PMB |

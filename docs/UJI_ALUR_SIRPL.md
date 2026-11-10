# Catatan Uji Alur SIRPL (staging) — serah terima

Dokumen ini merangkum uji end-to-end SIRPL (alur Juknis RPL Tipe A) yang dijalankan di
lingkungan staging pada 9–10 November 2026: apa yang sudah diuji, temuan beserta
perbaikannya, apa yang masih menunggu, dan cara melanjutkan.

> Tidak ada kata sandi atau kunci rahasia di dokumen ini. Kata sandi akun uji disimpan terpisah.

---

## 1. Lingkungan

| Hal | Nilai |
|---|---|
| Aplikasi | Vite + React + Supabase, repo `dhanyfaizal/SIRPL` |
| Cabang uji | `feat/alur-pedoman` |
| Domain staging | `https://sirpl-staging-stikomyos.vercel.app` (Preview Vercel, terikat ke cabang `feat/alur-pedoman`) |
| Database staging | Proyek Supabase **SIRPL-staging** (`cwmzxdcwqolhfnfxrqay`) |
| Produksi (JANGAN untuk uji) | `rpl.stikomyos.my.id`, `sirpl.vercel.app` |
| Edge Function terpasang di staging | `aisys` (model `gpt-5-mini`), `repositori` (tanpa Verify JWT) |
| Edge Function belum terpasang | `notifikasi-wa` (menunggu token Fonnte baru) |

### Akun uji (pola email `uji.<peran>@stikomyos.ac.id`)
`uji.pemohon`, `uji.pemohon2`, `uji.pmb`, `uji.baak`, `uji.sekretaris`, `uji.ketuatim`,
`uji.asesor`, `uji.komite`, `uji.ketuastikom`. Semua memakai satu kata sandi uji yang sama.

### Data uji
| Pemohon | No. daftar | Jenis | Hasil akhir |
|---|---|---|---|
| Uji Pemohon | RPL-2026-0024 | Gabungan | 14 SKS (7 MK), lewat sanggahan Pancasila; NIM **2026RPL0024**; biaya lunas |
| uji.pemohon2 | RPL-2026-0025 | Perolehan | 6 SKS (2 MK); NIM **2026RPL0025** (ditetapkan sebelum aturan lunas berlaku; angsuran ke-2 masih terbuka) |

Keduanya sudah ber-SK `901/SK/STIKOM-YS/XI/2026` dan berstatus pelaporan **Dilaporkan ke Sistem RPL**.

Berkas tiruan untuk unggahan ada di folder `uji/` (ijazah, transkrip, sertifikat, surat
keterangan kerja, F07 bertanda tangan, bukti bayar PDF/JPG).

---

## 2. Cakupan uji yang sudah lulus

1. Pendaftaran pemohon, persyaratan (termasuk wajib nomor WhatsApp), F07, bukti portofolio, F03, kirim.
2. Periode otomatis terisi dan tagihan terbentuk (migrasi 19).
3. Pembayaran: diskon, cicilan, kirim bukti, verifikasi PMB, penolakan, cegah kirim ganda, RLS (pemohon tidak bisa menyetujui sendiri).
4. Verifikasi berkas BAAK (daftar periksa, signed URL).
5. Penugasan asesor, penilaian transfer (termasuk AISYS dengan transkrip nyata), perolehan, asesmen lanjutan F10 + jadwal wawancara daring/luring.
6. Pleno awal dan pleno hasil (Sekretaris membuat, Ketua Tim menetapkan), F11 bernomor otomatis dan ditandatangani seluruh peserta.
7. Surat Hasil dan F09; perhitungan sisa beban studi.
8. **Sanggahan**: pemohon mengajukan → asesor merevisi → pleno ulang (F11 003) → Surat Hasil & F09 terbit ulang (versi lama otomatis dicabut) → pemohon menyetujui.
9. Komite menyetujui kedua pemohon.
10. SK dicatat Sekretariat; lampiran F08 terbit dan ditandatangani Ketua STIKOM.
11. **NIM hanya setelah lunas** (diuji: diblokir di UI dan langsung di database → bayar → verifikasi PMB → NIM ditetapkan). NIM ganda ditolak.
12. Verifikasi QR `/verifikasi/<kode>`: sah, kode salah, dan dokumen dicabut.
13. Repositori internal (struktur folder pelaporan, buka berkas) dan **tautan berbagi**: sandi salah ditolak, filter mekanisme benar, dokumen dan berkas unggahan terbuka tanpa akun, tautan dicabut tidak berlaku.
14. Pelaporan tahap 1 → 2 (Dilaporkan ke Sistem RPL) dengan dialog konfirmasi.

---

## 3. Temuan dan status

Status: **Selesai** = sudah diperbaiki dan dicek di staging; **Ter-push, belum diuji** = perbaikan
sudah di-commit dan di-push ke `feat/alur-pedoman` tetapi belum dicek di layar; **Terbuka** = belum diperbaiki.

| # | Temuan | Perbaikan / berkas | Status |
|---|---|---|---|
| — | `periode_id` kosong sehingga tagihan tidak terbentuk | migrasi `20261119000000_periode_pengajuan.sql` | Selesai |
| — | F03 bisa disimpan "Baik/Sangat baik" tanpa bukti | migrasi `20261120000000_f03_wajib_bukti.sql`, `EvaluasiDiri.jsx`, `kelengkapan.js` | Selesai |
| — | Tanggal panjang, status kerja/kawin di F02/F07; label "Lunas" di kolom angsuran; subjudul Pembayaran per peran; badge Pelaporan admin; pesan 404 AISYS; teks login; toolbar dokumen | `konstanta.js`, `isi.js`, `TagihanDetail.jsx`, `Pembayaran.jsx`, `AdminLayout.jsx`, `aisys.js`, `Login.jsx`, `dokumen.css` | Selesai |
| 17 | AISYS: baris tanpa padanan tidak bisa dipilih manual | `TabTransfer.jsx` (pilih manual dari `terbaca`) | Kode selesai, **belum diuji di layar** |
| — | Penilaian perolehan hilang saat pindah tab | dialog "Perubahan belum disimpan" di `TabPerolehan.jsx` | Selesai |
| — | Riwayat keuangan muncul di ringkasan asesor; tautan MK salah | `TabRingkasan.jsx`, `Penilaian.jsx` | Selesai |
| — | Kartu pembayaran di Beranda pemohon | `Beranda.jsx` | Selesai |
| 19 | Kode mentah "SURAT_HASIL" di daftar dokumen dan halaman verifikasi | `PanelDokumen.jsx` (`kodeTampil`), `Verifikasi.jsx` | Selesai |
| 19b | Repositori: nama "SURAT_HASIL …" dan dua F11 bernama sama | migrasi `20261123000000_nama_berkas_repositori.sql` (nama + nomor dokumen) | Selesai |
| 20 | Catatan asesor di halaman hasil menampilkan catatan awal, bukan hasil F10 | — | **Terbuka** |
| 21 | AISYS menolak status "klarifikasi" (sanggahan) | migrasi `20261121000000_aisys_klarifikasi.sql` | Selesai |
| 22 | "1 perubahan belum disimpan" tidak hilang setelah simpan per baris (SKS teks vs angka) | `TabTransfer.jsx` | Kode ter-deploy, **belum diuji di layar** (perlu pengajuan baru di tahap asesmen) |
| 23 | Nomor BA F11 tidak masuk Surat Hasil bila kolom nomor pleno kosong | `isi.js` (ambil nomor F11), petunjuk di `PlenoDetail.jsx` | Selesai |
| 24 | Beranda pemohon menilai ulang F03 lama dengan aturan baru (0/1) | `kelengkapan.js` | Selesai |
| 25 | Tombol "Surat hasil" pemohon: "Object not found" (dokumen mesin bukan berkas Storage) | `ui.jsx` (`BukaBerkas` membuka `/dokumen/<id>`) | Selesai |
| 26 | Setelah sanggahan, pemohon masih melihat Surat Hasil/F09 lama tanpa penanda | `PanelDokumen.jsx` ("Perlu diterbitkan ulang", "Versi lama"), `Hasil.jsx`, `Dokumen.jsx` | Selesai |
| 27 | Baris SK tidak menunjukkan bahwa F08 sudah terbit (tombol tetap "Terbitkan lampiran F08") | — | **Terbuka** |
| 28 | Modul Pimpinan tanpa badge dokumen menunggu tanda tangan; halaman Tanda tangan keluar dari tata letak (tanpa sidebar) | — | **Terbuka** |
| 29 | NIM bisa ditetapkan sebelum biaya lunas | migrasi `20261122000000_nim_wajib_lunas.sql` (`sisa_tagihan`, `tetapkan_nim`), kolom Pembayaran di `Nim.jsx` | Selesai |
| 30 | Tab "Sudah ber-NIM" berisi 22 data alur lama dengan NIM kosong yang bisa diedit | `Nim.jsx` | Selesai |
| 31 | Halaman hasil tetap bertuliskan "belum final" setelah SK | `Hasil.jsx` | Selesai |
| 32 | Cabut tautan berbagi tanpa konfirmasi | `Repositori.jsx` (commit `2d9e02b`, `a683a06`); dialog ada di build staging, belum dicoba karena tidak ada tautan aktif | **Ter-push, belum diuji di layar** |
| 33 | "Setiap akses tercatat" tanpa tampilan riwayat | `Repositori.jsx` ("Dibuka N kali · terakhir …") | Selesai (10 Nov: "Dibuka 4 kali · terakhir …" tampil) |
| 34 | Kolom kata sandi tautan tidak tersamar | `Repositori.jsx` | Selesai (10 Nov: kolom bertipe password) |
| 35 | Halaman Pelaporan mencampur 22 data alur lama tanpa NIM/SK (tidak selaras dengan badge) | `Pelaporan.jsx` (syarat `alur_versi !== 1`, sama dengan badge). Perbaikan pertama tidak pernah ter-commit; ditulis ulang 10 Nov 2026 | **Belum deploy** |
| — | Data: kurikulum SI tanpa sub-CPMK; akun asesor tanpa prodi; `uji.pemohon2` dan `uji.ketuastikom` tanpa nama lengkap (dokumen mencetak username) | lengkapi data di staging | **Terbuka** |
| — | Komite "Sudah disetujui" dan Beranda "Selesai" ikut menghitung data alur lama | — | **Terbuka** (kecil) |

---

## 4. Yang harus dilakukan berikutnya

### 4.1 Pastikan deploy terbaru aktif di staging
Perbaikan #32–#34 sudah di-commit (`a683a06`) dan di-push; build staging `index-CLsipUWc.js` sudah memuatnya.
Perbaikan #35 (`Pelaporan.jsx`) ternyata tidak pernah ter-commit dan sudah ditulis ulang; perlu commit dan push.
Yang tersisa:
- Cek bahwa deploy Vercel untuk commit `a683a06` mencantumkan domain
  `sirpl-staging-stikomyos.vercel.app` (pernah sekali domain tidak ikut pindah).
- Cek build aktif memuat teks perbaikan (lihat tips di bagian 7), misalnya "Dibuka".

Untuk perubahan berikutnya: sebelum commit, **tutup semua tab file di Antigravity**
(*Close All Editors* → *Don't Save*). Editor yang menyimpan salinan lama terbukti menimpa file
yang baru diperbarui beberapa detik kemudian (terjadi pada `ui.jsx`, `kelengkapan.js`,
`TabTransfer.jsx`, `Nim.jsx`, `Hasil.jsx`, `Repositori.jsx`). Selalu cek `git diff --stat` sebelum commit.

### 4.2 Uji yang tersisa
1. Repositori (Ketua Tim): tombol Cabut memunculkan dialog; baris tautan menampilkan "Dibuka N kali"; kolom kata sandi tersamar (#32–#34).
2. Pelaporan (BAAK): hanya 2 pemohon uji tampil (#35; tangkapan N10 masih menunjukkan 24 pemohon); lanjutkan tahap 3 "Diverifikasi LLDIKTI" dan 4 "Masuk PDDikti"; coba "Kembalikan"; Unduh CSV.
3. Laporan dan analitik (Pimpinan/Komite).
4. #22 dan #17: buat satu pengajuan uji baru sampai tahap asesmen, lalu cek penanda "belum disimpan" dan pilih padanan AISYS manual.
5. Notifikasi WA (setelah token Fonnte dirotasi):
   - Deploy `notifikasi-wa` dengan `--no-verify-jwt`.
   - Secret: `FONNTE_TOKEN` (baru), `NOTIFIKASI_RAHASIA` (acak panjang).
   - Pastikan migrasi `20261118000000_notifikasi_wa.sql` sudah jalan.
   - Database Webhook: tabel `antrean_notifikasi`, event Insert, ke fungsi `notifikasi-wa`, header `x-sirpl-rahasia` = nilai `NOTIFIKASI_RAHASIA`.
6. Perbaiki temuan terbuka #20, #27, #28.

### 4.3 Bersih-bersih sesudah uji
- Rotasi kunci Sumopod dan Fonnte yang pernah bocor.
- Atur ulang penandatangan dan penomoran dokumen staging bila perlu.
- `Cloudflare.txt` dan `recovery-codes (1).txt` sudah dimasukkan ke `.gitignore` (10 Nov 2026), tetapi
  sebaiknya tetap dipindahkan keluar dari folder proyek.
- `tangkapan_uji_sirpl/` dan `tangkapan_uji_sirpl.zip` di-*ignore*; catatan uji ini disimpan di `docs/`.
- Jangan pernah menjalankan hotfix atau uji di proyek produksi.

---

## 5. Daftar migrasi baru (urutan jalan)

| Berkas | Isi | Staging |
|---|---|---|
| `20261117000000_aisys.sql` | fungsi dan log AISYS | sudah |
| `20261118000000_notifikasi_wa.sql` | antrean notifikasi WA | pastikan |
| `20261119000000_periode_pengajuan.sql` | isi periode otomatis + tagihan | sudah |
| `20261120000000_f03_wajib_bukti.sql` | F03 wajib rujuk bukti | sudah |
| `20261121000000_aisys_klarifikasi.sql` | AISYS boleh saat sanggahan | sudah |
| `20261122000000_nim_wajib_lunas.sql` | `sisa_tagihan`, NIM setelah lunas | sudah |
| `20261123000000_nama_berkas_repositori.sql` | nama berkas repositori + nomor | sudah |

Semua migrasi memakai `BEGIN/COMMIT` sendiri dan aman dijalankan ulang (`CREATE OR REPLACE` / `DROP ... IF EXISTS`).

---

## 6. Alur status pengajuan (alur Juknis)

`draft → diajukan → terverifikasi → asesmen → pleno_awal → penilaian_lanjutan → pleno →
hasil_disampaikan → (setuju) menunggu_komite → menunggu_sk → sk_terbit → (NIM, lunas) selesai`

Cabang sanggahan: `hasil_disampaikan → klarifikasi ("Sanggahan diproses") → pleno → hasil_disampaikan`.

Dokumen: F02, F03, F07, F09 (transfer), F10, F11 (`NNN/BA-RPL/STIKOM-YS/XI/2026`), Surat Hasil
(`NNN/SH-RPL/...`), F08 (lampiran SK). Isi dokumen di-*snapshot* saat terbit; terbit ulang
mencabut versi sebelumnya dan nomornya tetap.

---

## 7. Tips teknis untuk penguji

- **Ganti akun cepat:** di konsol browser hapus kunci `sb-*` dari `localStorage`, lalu buka `/login`.
- **Unggah berkas tanpa dialog OS:** buat `File` dari base64 lalu pasang ke `input[type=file]` lewat `DataTransfer`, kemudian picu event `change`.
- **Tanda tangan dokumen:** klik "Tandatangani" di kepala halaman, tunggu dialog, klik "Tandatangani" di dialog.
- **Cek build yang aktif di staging:** ambil `/` lalu periksa apakah berkas `/assets/index-*.js` memuat teks dari perbaikan terbaru.
- **Rute penting:** `/tim/antrean/semua/<id>?tab=dokumen` (panel dokumen tim), `/pimpinan/komite`, `/pimpinan/sk`, `/pimpinan/nim`, `/tim/pelaporan`, `/repositori`, `/berbagi/<token>`, `/verifikasi/<kode>`, `/tanda-tangan`.
- **AISYS** butuh sekitar 100 detik per panggilan; jangan menunggu dengan satu perintah panjang.

---

## 8. Tangkapan layar

Folder `tangkapan_uji_sirpl/tangkapan/` di root proyek (juga dikemas sebagai `tangkapan_uji_sirpl.zip`;
keduanya di-*ignore* dan tidak ikut repo),
151 berkas JPG, dinomori per seri:

| Seri | Jumlah | Isi |
|---|---|---|
| A01–A06 | 6 | Tagihan muncul, bukti bayar pendaftaran, verifikasi PMB, nyatakan lunas |
| B01–B10 | 10 | Daftar tagihan PMB, diskon dan cicilan, bukti angsuran, penolakan dengan alasan wajib |
| C01–C05 | 5 | BAAK: daftar periksa berkas, buka ijazah, berkas lengkap, pembayaran hanya pantau |
| D01–D09 | 9 | Ketua Tim: tugaskan asesor, tab dokumen, F02/F07 terbit, asesmen dimulai |
| E01–E09 | 9 | Pemohon: tanda tangan F02/F07, alasan tolak tampil, kirim ulang angsuran |
| F01–F19 | 19 | Asesor: transfer, perolehan/F03, AISYS (gagal 404 lalu berhasil), ajukan pleno awal |
| G01–G05 | 5 | Sekretaris: buat pleno awal, peserta pleno |
| H01–H12 | 12 | Ketua Tim tetapkan pleno awal, F11 bernomor dan ditandatangani, jadwal wawancara daring/luring |
| I01–I12 | 12 | Asesor: F10 terkunci/terbuka, wawancara selesai, dialog perubahan belum disimpan, ajukan pleno hasil |
| J01–J11 | 11 | Pleno hasil, F11 002, F09, Surat Hasil |
| K10–K30 | 21 | AISYS ditolak saat klarifikasi, revisi Pancasila, pleno ulang (F11 003), dokumen terbit ulang, persetujuan pemohon |
| L01–L14 | 14 | Komite, SK, F08, NIM (termasuk duplikat ditolak), verifikasi QR, hasil pemohon |
| M01–M06 | 6 | NIM diblokir sebelum lunas → bayar → verifikasi PMB → NIM ditetapkan |
| N01–N12 | 12 | Repositori, tautan berbagi (sandi, filter, cabut), pelaporan tahap 1→2 |

**Celah dokumentasi:**
- Tidak ada tangkapan untuk pendaftaran, persyaratan, unggah F07, portofolio, dan pengisian F03
  oleh pemohon (cakupan uji no. 1).
- Seri K dimulai dari K10: K01–K09 (pengajuan sanggahan oleh pemohon dan awal revisi asesor) tidak ada.
- Beberapa tangkapan diambil **sebelum** perbaikan dan menunjukkan kondisi lama, misalnya
  K12 (#22), K19 (#23), K21 (#24), K23 (#25), L09 (#30), L13 ("belum final", #31), N01 (#19b), N10 (#35).

Dialog "Tautan berbagi siap" (yang memuat kata sandi tautan uji) sengaja tidak disimpan ke folder ini.

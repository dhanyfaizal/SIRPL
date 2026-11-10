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
| Edge Function belum terpasang | `notifikasi-wa` (Fonnte). Disimpan sebagai opsi; notifikasi WA kini **manual** lewat nomor WA Business (lihat 4.4) |

### Akun uji (pola email `uji.<peran>@stikomyos.ac.id`)
`uji.pemohon`, `uji.pemohon2`, `uji.pemohon3` (dibuat 10 Nov 2026 lewat dashboard Supabase), `uji.admin` (Admin Uji SIRPL), `uji.pmb`, `uji.baak`, `uji.sekretaris`, `uji.ketuatim`,
`uji.asesor`, `uji.komite`, `uji.ketuastikom`. Semua memakai satu kata sandi uji yang sama.

### Data uji
| Pemohon | No. daftar | Jenis | Hasil akhir |
|---|---|---|---|
| Uji Pemohon | RPL-2026-0024 | Gabungan | 14 SKS (7 MK), lewat sanggahan Pancasila; NIM **2026RPL0024**; biaya lunas |
| uji.pemohon2 | RPL-2026-0025 | Perolehan | 6 SKS (2 MK); NIM **2026RPL0025** (ditetapkan sebelum aturan lunas berlaku; angsuran ke-2 lunas 10 Nov 2026) |
| uji.pemohon3 | RPL-2026-0026 | Transfer | Dibuat 10 Nov 2026 untuk uji #17/#22. 7 MK diakui (16 SKS). Lewat **pengembalian Komite** lalu dikirim ulang, SK `902/SK/STIKOM-YS/XI/2026`, F08 final, NIM **2026RPL0026**; status **selesai**, pelaporan tahap 1. |
| uji.pemohon4 | RPL-2026-0027 | Transfer | Dibuat 10 Nov 2026 untuk uji cabang: tanpa portofolio, dikembalikan BAAK lalu kirim ulang, dua jadwal dibuat/diubah/dibatalkan, bukti tambahan diminta dua kali, dinilai dengan AISYS (7 MK diakui), pleno hasil, Surat Hasil `003/SH-RPL` final, pemohon setuju, **Komite mengembalikan**, Ketua Tim **meminta asesor menilai ulang**. Status **Sanggahan diproses** (`klarifikasi`); F11 pleno ini belum diterbitkan. |
| uji.pemohon5 | RPL-2026-0028 | Transfer | Dibuat 10 Nov 2026: status PDDikti "Tidak tercatat", dikembalikan BAAK, dikirim ulang, lalu **Tidak memenuhi syarat** (status akhir). Belum ada pembayaran. Nama lengkap belum diisi. |

RPL-2026-0024 dan 0025 sudah ber-SK `901/SK/STIKOM-YS/XI/2026` dan berstatus pelaporan **Masuk PDDikti** (tahap 4, sejak 10 Nov 2026).

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
| 17 | AISYS: baris tanpa padanan tidak bisa dipilih manual | `TabTransfer.jsx` (pilih manual dari `terbaca`) | Selesai (10 Nov, RPL-2026-0026: AISYS membaca 9 MK; 3 baris tanpa padanan menampilkan "Tidak ditemukan padanan; pilih sendiri"; pilihan manual mencentang baris dan mengisi formulir) |
| — | Penilaian perolehan hilang saat pindah tab | dialog "Perubahan belum disimpan" di `TabPerolehan.jsx` | Selesai |
| — | Riwayat keuangan muncul di ringkasan asesor; tautan MK salah | `TabRingkasan.jsx`, `Penilaian.jsx` | Selesai |
| — | Kartu pembayaran di Beranda pemohon | `Beranda.jsx` | Selesai |
| 19 | Kode mentah "SURAT_HASIL" di daftar dokumen dan halaman verifikasi | `PanelDokumen.jsx` (`kodeTampil`), `Verifikasi.jsx` | Selesai |
| 19b | Repositori: nama "SURAT_HASIL …" dan dua F11 bernama sama | migrasi `20261123000000_nama_berkas_repositori.sql` (nama + nomor dokumen) | Selesai |
| 20 | Catatan asesor di halaman hasil menampilkan catatan awal, bukan hasil F10 | `pemohon/api.js` memuat `penilaian_lanjutan`; `Hasil.jsx` menampilkan "Asesmen lanjutan: Memenuhi/Belum memenuhi. <catatan F10>" bila MK melewati F10 | Selesai (10 Nov, commit `f94d3d9`: Matematika Diskrit `uji.pemohon` menampilkan "Asesmen lanjutan: Belum memenuhi. Disarankan menempuh mata kuliah secara reguler.") |
| 21 | AISYS menolak status "klarifikasi" (sanggahan) | migrasi `20261121000000_aisys_klarifikasi.sql` | Selesai |
| 22 | "1 perubahan belum disimpan" tidak hilang setelah simpan per baris (SKS teks vs angka) | `TabTransfer.jsx` | Selesai (10 Nov, RPL-2026-0026: setelah simpan per baris, penanda kembali ke "1 dari 10 … sudah dinilai" dan Simpan semua nonaktif) |
| 23 | Nomor BA F11 tidak masuk Surat Hasil bila kolom nomor pleno kosong | `isi.js` (ambil nomor F11), petunjuk di `PlenoDetail.jsx` | Selesai |
| 24 | Beranda pemohon menilai ulang F03 lama dengan aturan baru (0/1) | `kelengkapan.js` | Selesai |
| 25 | Tombol "Surat hasil" pemohon: "Object not found" (dokumen mesin bukan berkas Storage) | `ui.jsx` (`BukaBerkas` membuka `/dokumen/<id>`) | Selesai |
| 26 | Setelah sanggahan, pemohon masih melihat Surat Hasil/F09 lama tanpa penanda | `PanelDokumen.jsx` ("Perlu diterbitkan ulang", "Versi lama"), `Hasil.jsx`, `Dokumen.jsx` | Selesai |
| 27 | Baris SK tidak menunjukkan bahwa F08 sudah terbit (tombol tetap "Terbitkan lampiran F08") | `Sk.jsx`: memuat F08 per SK; tampil lencana "F08 final n/n" atau "F08 terbit · ttd n/n" dan tombol "Terbitkan ulang"; bila sebagian, "Terbitkan F08 (n belum)" | Selesai (10 Nov: SK 901 menampilkan "F08 final 2/2" dan tombol "Terbitkan ulang") |
| 28 | Modul Pimpinan tanpa badge dokumen menunggu tanda tangan; halaman Tanda tangan keluar dari tata letak (tanpa sidebar) | Rute baru `/pimpinan`, `/tim`, `/asesor`, `/admin` + `/tanda-tangan` di dalam tata letak (`TandaTanganModul`); menu tiap modul diarahkan ke situ; `/tanda-tangan` mandiri tetap untuk tautan lama. Badge Pimpinan dari `jumlahTtdMenunggu` (`dokumen/api.js`) | Selesai (10 Nov: sidebar di `/pimpinan`, `/tim`, `/asesor`, `/admin` + `/tanda-tangan`; badge **1** di menu Pimpinan `uji.ketuatim` saat F11 004 menunggu tanda tangan; 0 menunggu → badge tidak tampil) |
| 29 | NIM bisa ditetapkan sebelum biaya lunas | migrasi `20261122000000_nim_wajib_lunas.sql` (`sisa_tagihan`, `tetapkan_nim`), kolom Pembayaran di `Nim.jsx` | Selesai |
| 30 | Tab "Sudah ber-NIM" berisi 22 data alur lama dengan NIM kosong yang bisa diedit | `Nim.jsx` | Selesai |
| 31 | Halaman hasil tetap bertuliskan "belum final" setelah SK | `Hasil.jsx` | Selesai |
| 32 | Cabut tautan berbagi tanpa konfirmasi | `Repositori.jsx` (commit `2d9e02b`, `a683a06`) | Selesai (10 Nov: dialog "Cabut tautan berbagi?" muncul; Batal → tetap Aktif; konfirmasi → Dicabut. Tautan uji "Uji #32 dialog cabut" sudah dicabut) |
| 33 | "Setiap akses tercatat" tanpa tampilan riwayat | `Repositori.jsx` ("Dibuka N kali · terakhir …") | Selesai (10 Nov: "Dibuka 4 kali · terakhir …" tampil) |
| 34 | Kolom kata sandi tautan tidak tersamar | `Repositori.jsx` | Selesai (10 Nov: kolom bertipe password) |
| 35 | Halaman Pelaporan mencampur 22 data alur lama tanpa NIM/SK (tidak selaras dengan badge) | `Pelaporan.jsx` (syarat `alur_versi !== 1`, sama dengan badge). Perbaikan pertama tidak pernah ter-commit; ditulis ulang 10 Nov 2026 | Selesai (10 Nov, commit `598ff33`: tahap 1 berisi 0, tahap 2 berisi 2 pemohon uji) |
| — | Data: kurikulum SI tanpa sub-CPMK; akun asesor tanpa prodi; akun uji tanpa nama lengkap (dokumen mencetak username) | 10 Nov: nama lengkap diisi (Uji Pemohon Dua/Tiga, Uji Ketua STIKOM, Uji Sekretaris, Uji PMB, Uji BAAK); `uji.asesor` homebase Sistem Informasi. **Sub-CPMK belum**: perlu isi kurikulum resmi dari Kaprodi SI (Admin → Kurikulum) | Sebagian (sisa sub-CPMK) |
| — | Komite "Sudah disetujui" dan Beranda "Selesai" ikut menghitung data alur lama | `PimpinanData.jsx` menyaring `alur_versi` 1 di sumber data modul Pimpinan | Selesai (10 Nov, `14a170e`: Beranda Pimpinan "Selesai" 2, bukan 24) |
| 37 | Bukti portofolio wajib juga untuk jalur transfer | `kelengkapan.js`, `Bukti.jsx`, `tim/aturan.js`: wajib untuk perolehan/gabungan (dirujuk F03), opsional untuk transfer; daftar periksa BAAK menandai "(opsional untuk transfer)" | Selesai (10 Nov: daftar periksa BAAK RPL-2026-0026 menampilkan "(opsional untuk transfer)"). Belum dicoba di layar: pemohon transfer baru melanjutkan tanpa bukti |
| 38 | CSV Pelaporan: Tanggal SK `2026-11-10`, kolom tanggal lain `10 Nov 2026` | `Pelaporan.jsx` memakai format yang sama | Ter-deploy (`14a170e`), CSV belum diunduh ulang |
| 39 | Aturan anti-kembar 10 menit di `antre_wa` menelan pesan sah: dua bukti bayar sekaligus (PMB hanya dapat 1 pesan), dua pelunasan (pemohon 1 pesan), **kirim ulang ke Komite** (pesan "perlu_komite" kedua tidak masuk), perubahan jadwal untuk asesor | Migrasi `20261125000000_wa_perbaikan.sql`: `antre_wa` menganggap kembar hanya bila isi pesan sama persis | Selesai (10 Nov, `78f2642`: asesor menerima 3 pesan `jadwal_asesor` berbeda dalam beberapa menit: baru 09:00, ubah 13:00, batal) |
| 40 | Peristiwa tanpa WA: Komite setuju → Sekretariat perlu mencatat SK (`menunggu_sk`); pemohon mengirim bukti tambahan → asesor; jadwal dibatalkan → asesor | Migrasi yang sama: `menunggu_sk` → Sekretaris (`perlu_sk`); `menunggu_bukti_tambahan` → `asesmen` → asesor (`bukti_tambahan_masuk`); jadwal dibatalkan → asesor (`jadwal_asesor`). Jenis baru didaftarkan di `notifikasi/jenis.js` | Selesai (10 Nov: `bukti_tambahan_masuk` ke asesor setelah pemohon kirim bukti; jadwal batal → asesor "DIBATALKAN"). `perlu_sk` ke Sekretaris belum terpicu ulang (belum ada persetujuan Komite baru) |
| 41 | Beranda pemohon saat "Perlu bukti tambahan" hanya lencana; permintaan asesor hanya di Riwayat, tanpa kotak/tombol ke halaman Bukti (berbeda dengan "dikembalikan" yang punya kotak merah) | `pemohon/pages/Beranda.jsx`: kotak kuning berisi permintaan asesor + tombol "Unggah bukti tambahan"; kotak "dikembalikan" diberi tombol "Perbaiki berkas" | Selesai (10 Nov: kotak kuning + tombol "Unggah bukti tambahan" di Beranda RPL-2026-0027) |
| 42 | Saat berkas dikembalikan, halaman Data pemohon tidak menandai bagian yang perlu diperbaiki ("Berkas wajib" tetap "Selesai") | `Persyaratan.jsx`: kotak merah berisi catatan perbaikan BAAK di atas halaman Data | Selesai (10 Nov: RPL-2026-0028 dikembalikan → halaman Data menampilkan kotak merah "Perlu diperbaiki sebelum dikirim ulang" berisi catatan BAAK) |
| 43 | Pemohon bisa menyetujui hasil sebelum Surat Hasil/F09 diterbitkan Ketua Tim (RPL-2026-0026) | Diputuskan 10 Nov 2026: `Hasil.jsx` menonaktifkan "Setujui hasil" sampai Surat Hasil final (versi terbaru) terbit, dengan penjelasan; sanggahan tetap bisa diajukan. Pembatasan di tampilan, belum di basis data | Selesai (10 Nov: RPL-2026-0027 "Setujui hasil" nonaktif + "Surat Hasil sedang disiapkan"; setelah Surat Hasil `003/SH-RPL` final, tombol aktif) |
| 44 | Komite tidak melihat catatan Ketua Tim saat pengajuan dikirim ulang ("Riwayat keputusan Komite" hanya berisi alasan pengembalian) | `pimpinan/pages/Komite.jsx`: riwayat memuat tindak lanjut Ketua Tim dari `log_aktivitas_rpl` ("Tindak lanjut Tim") | Selesai (10 Nov: riwayat Komite RPL-2026-0026 menampilkan "Tindak lanjut Tim: Dikirim ulang ke Komite: …") |
| 45 | Jadwal yang dibatalkan masih menampilkan tautan Meet di halaman jadwal pemohon | `pemohon/pages/Jadwal.jsx`: jadwal dibatalkan menampilkan keterangan dan alasan, tanpa tautan | Selesai (10 Nov: jadwal batal pemohon menampilkan keterangan dan alasan tanpa tautan; titik ganda di akhir alasan diperbaiki, belum deploy) |
| 46 | Pengajuan **Tidak memenuhi syarat** masih menampilkan tagihan "Belum dibayar" (Rp1.300.000) di Beranda/Pembayaran pemohon; halaman Ringkasan memakai kotak hijau "Pengajuan sudah dikirim… pantau perkembangannya" | Usul: tagihan yang belum dibayar ditutup (dilewati) saat TMS; Ringkasan memakai kotak merah | **Terbuka** |
| 47 | "Minta asesor menilai ulang" setelah pengembalian Komite: lencana asesor tetap "Sanggahan diproses", alasan Komite tidak terlihat di halaman penilaian asesor, dan tidak ada WA ke asesor (status `klarifikasi` tanpa pemicu) | Usul: tampilkan catatan Komite/tindak lanjut Tim di halaman penilaian asesor; lencana "Dinilai ulang (Komite)"; pemicu WA `klarifikasi` → asesor | **Terbuka** |
| 48 | Kirim ulang setelah dikembalikan: pesan BAAK "Pengajuan RPL baru perlu diverifikasi" sama persis dengan pesan pertama sehingga tertahan anti-kembar bila < 10 menit; BAAK tidak tahu ada kiriman ulang | Usul: pesan khusus "dikirim ulang setelah perbaikan" saat `dikembalikan_sekretariat` → `diajukan` | **Terbuka** (kecil) |
| 36 | Laporan menyembunyikan pembayaran dari Komite hanya di tampilan (`lihatUang`); lewat API, `uji.komite` tetap mendapat `terbayar`/`potongan` per pengajuan dari RPC `laporan_rpl` dan bisa membaca tabel `pembayaran_rpl` dan `tagihan_rpl` langsung (RLS) | Diputuskan 10 Nov 2026: Komite **boleh** melihat data keuangan; akses API dibiarkan. Penyembunyian di tampilan hanya untuk kerapian, bukan pembatasan akses | **Diterima** (tidak diubah) |

---

## 4. Yang harus dilakukan berikutnya

### 4.1 Pastikan deploy terbaru aktif di staging
Perbaikan #32–#34 sudah di-commit (`a683a06`) dan di-push; build staging `index-CLsipUWc.js` sudah memuatnya.
Perbaikan #35 (`Pelaporan.jsx`) sempat tidak ter-commit; ditulis ulang di `598ff33` dan sudah aktif di staging (`index-Bmwhd9Nk.js`).
Yang tersisa:
- Cek bahwa deploy Vercel untuk commit `a683a06` mencantumkan domain
  `sirpl-staging-stikomyos.vercel.app` (pernah sekali domain tidak ikut pindah).
- Cek build aktif memuat teks perbaikan (lihat tips di bagian 7), misalnya "Dibuka".

Untuk perubahan berikutnya: sebelum commit, **tutup semua tab file di Antigravity**
(*Close All Editors* → *Don't Save*). Editor yang menyimpan salinan lama terbukti menimpa file
yang baru diperbarui beberapa detik kemudian (terjadi pada `ui.jsx`, `kelengkapan.js`,
`TabTransfer.jsx`, `Nim.jsx`, `Hasil.jsx`, `Repositori.jsx`). Selalu cek `git diff --stat` sebelum commit.

### 4.2 Uji yang tersisa
1. ~~Repositori (Ketua Tim): dialog Cabut, "Dibuka N kali", sandi tersamar (#32–#34).~~ Lulus 10 Nov 2026.
2. ~~Pelaporan (BAAK): tahap 2 → 3 → 4, "Kembalikan", Unduh CSV.~~ Lulus 10 Nov 2026. Kedua pemohon uji
   kini berstatus **Masuk PDDikti**. Kembalikan 3→2 dan 4→3 berjalan dengan dialog "koreksi satu langkah".
   CSV `pelaporan-rpl-diinput_pddikti-2026-11-10.csv` berisi 2 baris dengan 17 kolom dan ketiga tanggal pelaporan.
   Catatan kecil:
   - Sekali, setelah simpan tahap 3→4, angka tab dan daftar tidak berubah walau notifikasi sukses muncul;
     data tersimpan (terlihat setelah muat ulang). Tidak terulang pada dua percobaan berikutnya.
   - CSV: kolom Tanggal SK berformat `2026-11-10`, sedangkan kolom tanggal pelaporan `10 Nov 2026` (diperbaiki, #38).
   - CSV: Nama `uji.pemohon2` (akun tanpa nama lengkap) dan Prodi asal `efafae` (isian uji) — data, bukan kode.
3. ~~Laporan dan analitik (Pimpinan/Komite).~~ Lulus 10 Nov 2026. Hanya data alur Juknis (2 pendaftar).
   Angka dicocokkan dengan RPC `laporan_rpl`: rata-rata SKS (14+6)/2 = 10,0; tingkat pengakuan 20/44 = 45%;
   median lama layanan (3 dan 1 hari) = 2 hari; pembayaran 2.100.000 + 313.000 = Rp2.413.000 (diskon Rp75.000);
   pelaporan 2 Masuk PDDikti. Pimpinan (`uji.ketuastikom`) melihat kartu dan kolom pembayaran; Komite tidak
   (hanya tampilan; Komite memang boleh mengakses data keuangan, lihat #36). Unduh CSV laporan belum dicoba.
4. ~~#22 dan #17 (pengajuan uji baru sampai asesmen).~~ Lulus 10 Nov 2026 dengan `uji.pemohon3` (RPL-2026-0026). Catatan:
   - Bukti portofolio minimal satu tetap wajib untuk jalur **transfer** ("Tambahkan minimal satu bukti portofolio"). Diperbaiki: opsional untuk transfer (#37).
   - Isian AISYS untuk 7 MK sengaja tidak disimpan (padanan uji). Pengajuan bisa dipakai lagi untuk uji pleno/sanggahan jalur transfer.
5. Notifikasi WA mode manual: lihat 4.4. (Langkah Fonnte hanya bila suatu saat mode diubah ke otomatis: deploy `notifikasi-wa` dengan `--no-verify-jwt`; secret `FONNTE_TOKEN` dan `NOTIFIKASI_RAHASIA`; Database Webhook tabel `antrean_notifikasi` event Insert dengan header `x-sirpl-rahasia`.)
6. ~~Uji perbaikan #20, #27, #28.~~ Lulus 10 Nov 2026 (lihat tabel).
7. Setelah deploy #37, #38, dan filter alur lama Pimpinan: cek Beranda Pimpinan "Selesai" = 2 (bukan 24); CSV Pelaporan Tanggal SK `10 Nov 2026`; pemohon transfer baru bisa lanjut tanpa bukti portofolio.
9. ~~Uji cabang alur (10 Nov 2026).~~ Lulus: (1) BAAK kembalikan berkas → pemohon lihat catatan di Beranda, ganti transkrip, "Kirim ulang pengajuan"; (3) asesor minta bukti tambahan → kotak kuning di halaman Bukti → "Kirim ke asesor" → status kembali asesmen; (4) Komite kembalikan → tab "Hasil dan sanggahan" Ketua Tim (Minta asesor menilai ulang / Kirim ulang ke Komite) → Komite setuju; (5) jadwal buat/ubah/batal, pemohon melihat "Dibatalkan"; (6) angsuran ke-2 `uji.pemohon2` lunas, sisa tagihan 0; (8) 21 pesan WA dari pemicu nyata, termasuk ke pemohon (penanda "Pemohon" + nomor pendaftaran); (9) `/keuangan/wa` PMB tersaring Pembayaran; (10) pemohon transfer lanjut tanpa portofolio; (11) CSV Tanggal SK `10 Nov 2026`; (12) RPL-2026-0026 tuntas sampai NIM. Temuan baru #39–#45.
   Lanjutan 10 Nov 2026 (`uji.pemohon5`): (2) **Tidak memenuhi syarat** lulus: dialog menjelaskan status akhir, alasan wajib, Beranda kotak merah, tidak ada tombol kirim, WA "tidak_memenuhi" ke pemohon. "Minta asesor menilai ulang" lulus secara alur (status `klarifikasi`, asesor bisa mengubah nilai), dengan temuan #47. Temuan baru #46–#48.
   Belum: (7) prodi TI (ditunda).
   Nomor WA tiruan `0812000000xx` diisi di profil akun uji staf, pemohon2, dan pemohon4 agar pesan masuk antrean.
8. ~~Notifikasi WA manual.~~ Lulus 10 Nov 2026 (`2eeefa2`). Admin: Status Aktif, Cara kirim Manual, alamat aplikasi `https://sirpl-staging-stikomyos.vercel.app`. Pesan uji (nomor tiruan `081200000099` di profil `uji.admin`) muncul di WA keluar Admin dan `/tim/wa` (badge 1); Buka WhatsApp menghasilkan `https://wa.me/6281200000099?text=…` dengan isi lengkap (tab WhatsApp tidak dibuka); Tandai terkirim → tab Terkirim dengan waktu dan "Admin Uji SIRPL"; Batal → kembali ke Belum dikirim; Lewati → tab Dilewati.
   Belum dicoba: pesan dari pemicu nyata ke pemohon (penanda "Pemohon" dan nomor pendaftaran) dan halaman `/keuangan/wa` sebagai PMB. 18 akun staf belum mengisi nomor WhatsApp, sehingga pesan untuk staf belum masuk antrean.

### 4.4 Notifikasi WhatsApp: mode manual (keputusan 10 Nov 2026)
- **Pengirim:** satu nomor **WA Business institusi**, ditautkan di WhatsApp Desktop/Web komputer BAAK/PMB (maks. 4 perangkat tertaut).
- **Penerima:** pemohon **dan** staf (14 + 10 jenis pesan), karena pemberitahuan di web saja tidak cukup.
- **Nomor pemohon:** kolom WhatsApp yang diisi di formulir pengajuan (F02, disimpan di `profiles.no_whatsapp`).
- **Alur:** pemicu basis data menyusun pesan ke `antrean_notifikasi` → staf membuka menu **WA keluar** (Tim: BAAK/Sekretaris/Ketua Tim; PMB; Admin di halaman Notifikasi) → **Buka WhatsApp** membuka `wa.me/<nomor>?text=<pesan>` → tekan Kirim di WhatsApp → **Tandai terkirim** (tercatat waktu dan pengirim) atau **Lewati**. Badge menu menunjukkan jumlah yang belum dikirim.
- **Fonnte disimpan:** Admin bisa memilih Cara kirim **Otomatis (Fonnte)**; pada mode manual `ambil_antrean_wa` tidak mengembalikan apa pun sehingga Edge Function tidak mengirim.
- **Batas:** "terkirim" berarti staf sudah menandai; sistem tidak bisa memastikan pesan sampai/dibaca.
- Berkas: migrasi `20261124000000_wa_manual.sql` (kolom `mode`, `dikirim_oleh`, RPC `daftar_wa_keluar`, `jumlah_wa_menunggu`, `tandai_wa`), `src/notifikasi/` (`jenis.js`, `WaKeluar.jsx`), rute `/tim/wa` dan `/keuangan/wa`, `admin/pages/Notifikasi.jsx`.

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
| `20261124000000_wa_manual.sql` | WA mode manual (WA keluar), Fonnte jadi opsi | sudah (10 Nov) |
| `20261125000000_wa_perbaikan.sql` | WA: anti-kembar per isi pesan, pemicu perlu SK / bukti tambahan masuk / jadwal batal ke asesor | sudah (10 Nov) |

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

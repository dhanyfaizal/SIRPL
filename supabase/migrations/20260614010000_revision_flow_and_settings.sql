-- Skrip Migrasi: Penambahan Kolom Catatan Revisi & Pembaruan Check Constraint Status Pengajuan

-- 1. Tambah kolom 'catatan_revisi' jika belum ada
ALTER TABLE pengajuan_rpl ADD COLUMN IF NOT EXISTS catatan_revisi TEXT;

-- 2. Hapus check constraint lama untuk status jika ada
ALTER TABLE pengajuan_rpl DROP CONSTRAINT IF EXISTS pengajuan_rpl_status_check;

-- 3. Pasang check constraint baru yang mencakup status pengembalian (revisi)
ALTER TABLE pengajuan_rpl ADD CONSTRAINT pengajuan_rpl_status_check CHECK (
    status IN (
        'submitted',          -- Dikirim calon mhs
        'returned_baak',      -- Dikembalikan oleh BAAK ke calon mhs
        'validated_baak',     -- Disetujui BAAK, dikirim ke Ka. Prodi
        'returned_kaprodi',   -- Dikembalikan oleh Ka. Prodi ke BAAK
        'recognized_kaprodi', -- Selesai rekognisi Ka. Prodi, dikirim ke Asessor
        'returned_asessor',   -- Dikembalikan oleh Asessor ke Ka. Prodi
        'assessed_asessor',   -- Selesai asesmen Asessor, dikirim ke Admin
        'returned_admin',     -- Dikembalikan oleh Admin ke Asessor
        'mapped_admin'        -- Selesai finalisasi Admin (Rencana Studi Diterbitkan)
    )
);

/**
 * Helper client-side untuk mengekspor array data pengajuan RPL ke format CSV
 * @param {Array} data - Array data pengajuan RPL
 * @param {string} fileName - Nama file output CSV (default: 'laporan-rpl.csv')
 */
export function exportToCSV(data, fileName = 'laporan-rpl.csv') {
  if (!data || data.length === 0) {
    alert('Tidak ada data yang dapat diekspor!')
    return
  }

  // Definisikan header kolom
  const headers = [
    'Nama Lengkap',
    'Email',
    'No. WA',
    'Prodi Pilihan',
    'SKS Diakui',
    'SKS Sisa',
    'Potongan UKP per Smt (Rp)',
    'Total Biaya Akhir (Rp)',
    'Status RPL'
  ]

  // Konversi data item ke baris CSV
  const csvRows = [
    headers.join(';'), // Menggunakan semicolon (;) untuk kompatibilitas Excel regional Indonesia
    ...data.map(item => {
      const nama = (item.profile?.nama_lengkap || '-').replace(/"/g, '""')
      const email = (item.profile?.email || '-').replace(/"/g, '""')
      const wa = (item.profile?.no_whatsapp || '-').replace(/"/g, '""')
      const prodi = (item.prodi?.nama || '-').replace(/"/g, '""')
      
      const sksDiakui = item.total_sks_diakui || 0
      const sksSisa = item.total_sks_sisa || 0
      
      const potongan = item.potongan_biaya || 0
      const biayaTotal = item.biaya_total || 0
      
      // Label status ramah pengguna
      let statusLabel = item.status || '-'
      switch (item.status) {
        case 'draft': statusLabel = 'Draf'; break;
        case 'submitted': statusLabel = 'Menunggu Validasi BAAK'; break;
        case 'returned_baak': statusLabel = 'Revisi oleh Calon Mahasiswa'; break;
        case 'validated_baak': statusLabel = 'Validasi BAAK (Proses Kaprodi)'; break;
        case 'returned_kaprodi': statusLabel = 'Revisi ke BAAK'; break;
        case 'recognized_kaprodi': statusLabel = 'Rekomendasi Kaprodi (Proses Asessor)'; break;
        case 'returned_asessor': statusLabel = 'Revisi ke Kaprodi'; break;
        case 'assessed_asessor': statusLabel = 'Dinilai Asessor (Proses Admin)'; break;
        case 'returned_admin': statusLabel = 'Revisi ke Asessor'; break;
        case 'mapped_admin': statusLabel = 'Selesai (Rencana Studi Terbit)'; break;
      }
      statusLabel = statusLabel.replace(/"/g, '""')

      return [
        `"${nama}"`,
        `"${email}"`,
        `"${wa}"`,
        `"${prodi}"`,
        sksDiakui,
        sksSisa,
        potongan,
        biayaTotal,
        `"${statusLabel}"`
      ].join(';')
    })
  ]

  // Gunakan Byte Order Mark (BOM) UTF-8 agar Excel membaca karakter khusus / emoji / aksen dengan benar
  const csvContent = '\uFEFF' + csvRows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  // Trigger download di browser
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', fileName)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

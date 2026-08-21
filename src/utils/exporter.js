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

/**
 * Helper client-side untuk mengekspor rekap dan laporan data pengajuan RPL ke PDF (Print-ready document)
 * @param {Array} data - Array data pengajuan RPL
 * @param {string} title - Judul laporan (default: 'Laporan & Rekapitulasi Pengajuan RPL')
 */
export function exportToPDF(data, title = 'Laporan & Rekapitulasi Pengajuan RPL') {
  if (!data || data.length === 0) {
    alert('Tidak ada data yang dapat diekspor!')
    return
  }

  // Calculate summary stats
  const totalPengajuan = data.length
  const totalDiakui = data.reduce((acc, curr) => acc + (parseInt(curr.total_sks_diakui) || 0), 0)
  const totalSisa = data.reduce((acc, curr) => acc + (parseInt(curr.total_sks_sisa) || 0), 0)
  const totalBiaya = data.reduce((acc, curr) => acc + (parseFloat(curr.biaya_total) || 0), 0)

  // Group by prodi
  const prodiStats = {}
  data.forEach(item => {
    const pName = item.prodi?.nama || 'Lainnya'
    prodiStats[pName] = (prodiStats[pName] || 0) + 1
  })

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Gagal membuka jendela cetak. Mohon izinkan popup di browser Anda.')
    return
  }

  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })

  const rowsHtml = data.map((item, idx) => {
    const nama = item.profile?.nama_lengkap || '-'
    const email = item.profile?.email || '-'
    const wa = item.profile?.no_whatsapp || '-'
    const prodi = item.prodi?.nama || '-'
    const sksDiakui = item.total_sks_diakui || 0
    const sksSisa = item.total_sks_sisa || 0
    const biayaTotal = parseFloat(item.biaya_total) || 0

    let statusLabel = item.status || '-'
    switch (item.status) {
      case 'draft': statusLabel = 'Draf'; break;
      case 'submitted': statusLabel = 'Menunggu BAAK'; break;
      case 'returned_baak': statusLabel = 'Revisi Mahasiswa'; break;
      case 'validated_baak': statusLabel = 'Proses Kaprodi'; break;
      case 'returned_kaprodi': statusLabel = 'Revisi ke BAAK'; break;
      case 'recognized_kaprodi': statusLabel = 'Proses Asessor'; break;
      case 'returned_asessor': statusLabel = 'Revisi ke Kaprodi'; break;
      case 'assessed_asessor': statusLabel = 'Proses Admin'; break;
      case 'returned_admin': statusLabel = 'Revisi ke Asessor'; break;
      case 'mapped_admin': statusLabel = 'Rencana Studi Terbit'; break;
    }

    return `
      <tr>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px;">${idx + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">
          <strong style="color: #0f172a;">${nama}</strong>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${email} ${wa !== '-' ? '· WA: ' + wa : ''}</div>
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 6px;">${prodi}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-weight: 600; color: #166534;">${sksDiakui} SKS</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-weight: 600; color: #1e40af;">${sksSisa} SKS</td>
        <td style="text-align: right; border: 1px solid #cbd5e1; padding: 6px; font-weight: 700; color: #0f172a;">Rp${biayaTotal.toLocaleString('id-ID')}</td>
        <td style="text-align: center; border: 1px solid #cbd5e1; padding: 6px; font-size: 10px; font-weight: 600;">${statusLabel}</td>
      </tr>
    `
  }).join('')

  const prodiSummaryHtml = Object.entries(prodiStats).map(([pName, count]) => `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 12px; border-radius: 6px; font-size: 11px;">
      <span style="color: #64748b; font-weight: 500;">${pName}:</span> <strong style="color: #4f46e5;">${count} Mahasiswa</strong>
    </div>
  `).join('')

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: 'Inter', system-ui, -apple-system, sans-serif; margin: 0; padding: 12px; color: #1e293b; font-size: 11.5px; background: #fff; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px double #1e293b; padding-bottom: 12px; margin-bottom: 16px; }
          .logo-text { text-align: center; flex: 1; }
          .logo-text h1 { font-size: 18px; font-weight: 800; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px; color: #0f172a; }
          .logo-text p { margin: 0; font-size: 10.5px; color: #64748b; }
          .report-title { text-align: center; margin: 14px 0; }
          .report-title h2 { font-size: 15px; font-weight: 800; margin: 0; text-transform: uppercase; color: #3730a3; letter-spacing: 0.5px; }
          .report-title p { font-size: 11px; color: #64748b; margin: 4px 0 0 0; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
          .stat-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; text-align: center; }
          .stat-card .val { font-size: 16px; font-weight: 800; color: #4f46e5; }
          .stat-card .lbl { font-size: 9.5px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-top: 2px; }
          .prodi-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
          th { background: #4f46e5; color: #ffffff; padding: 8px 6px; text-align: left; font-weight: 700; font-size: 10px; text-transform: uppercase; border: 1px solid #4338ca; }
          tr:nth-child(even) { background: #f8fafc; }
          .footer-sign { display: flex; justify-content: space-between; margin-top: 24px; page-break-inside: avoid; }
          .sign-box { text-align: center; width: 220px; font-size: 11px; }
          .sign-space { height: 50px; }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 16px; background: #e0e7ff; padding: 10px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 600; color: #3730a3;">📄 Dokumen Laporan & Rekapitulasi RPL (Siap Cetak / Simpan PDF)</span>
          <button onclick="window.print()" style="background: #4f46e5; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            🖨️ Cetak / Simpan sebagai PDF
          </button>
        </div>

        <div class="header">
          <div class="logo-text">
            <h1>STIKOM Yos Sudarso Purwokerto</h1>
            <p>Jl. SMP5 No. 1, Windusara, Karangklesem, Purwokerto Selatan, Banyumas</p>
            <p>Telp: (0281) 6840952 · Email: info@stikomyos.ac.id · Website: www.stikomyos.ac.id</p>
          </div>
        </div>

        <div class="report-title">
          <h2>${title}</h2>
          <p>Dicetak pada tanggal: ${dateStr} · Sistem Informasi Rekognisi Pembelajaran Lampau (SI-RPL)</p>
        </div>

        <!-- Ringkasan Statistik -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="val">${totalPengajuan}</div>
            <div class="lbl">Total Pengajuan</div>
          </div>
          <div class="stat-card">
            <div class="val">${totalDiakui} SKS</div>
            <div class="lbl">Total SKS Diakui</div>
          </div>
          <div class="stat-card">
            <div class="val">${totalSisa} SKS</div>
            <div class="lbl">Total SKS Sisa</div>
          </div>
          <div class="stat-card">
            <div class="val">Rp${totalBiaya.toLocaleString('id-ID')}</div>
            <div class="lbl">Total Estimasi Biaya</div>
          </div>
        </div>

        <!-- Ringkasan Per Prodi -->
        <div style="font-weight: 700; font-size: 11px; margin-bottom: 6px; color: #334155;">Sebaran Pengajuan Per Program Studi:</div>
        <div class="prodi-grid">
          ${prodiSummaryHtml}
        </div>

        <!-- Tabel Rekapitulasi -->
        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">No</th>
              <th>Nama Mahasiswa / Kontak</th>
              <th>Program Studi</th>
              <th style="width: 80px; text-align: center;">SKS Diakui</th>
              <th style="width: 70px; text-align: center;">SKS Sisa</th>
              <th style="width: 130px; text-align: right;">Total Biaya Akhir</th>
              <th style="width: 120px; text-align: center;">Status Pengajuan</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <!-- Pengesahan -->
        <div class="footer-sign">
          <div class="sign-box">
            <p style="margin: 0;">Mengetahui,<br><strong>Ketua Tim Pengelola RPL</strong></p>
            <div class="sign-space"></div>
            <p style="margin: 0; font-weight: 700; text-decoration: underline;">( ________________________ )</p>
            <p style="margin: 2px 0 0 0; color: #64748b; font-size: 10px;">NIDN. .....................................</p>
          </div>
          <div class="sign-box">
            <p style="margin: 0;">Purwokerto, ${dateStr}<br><strong>Admin Akademik / BAAK</strong></p>
            <div class="sign-space"></div>
            <p style="margin: 0; font-weight: 700; text-decoration: underline;">( ________________________ )</p>
            <p style="margin: 2px 0 0 0; color: #64748b; font-size: 10px;">Petugas Administrator SI-RPL</p>
          </div>
        </div>
      </body>
    </html>
  `)
  printWindow.document.close()
}

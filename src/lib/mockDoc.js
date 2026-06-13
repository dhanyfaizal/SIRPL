export function generateMockDocSrcDoc(type, fileName, userName, prodiName) {
  const isIjazah = type === 'ijazah';
  
  if (isIjazah) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Georgia', serif;
            background-color: #fcfbf7;
            color: #1a1a1a;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 90vh;
            margin: 0;
            padding: 10px;
            box-sizing: border-box;
          }
          .certificate {
            border: 8px double #b39257;
            padding: 24px;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            text-align: center;
            position: relative;
            background: #fff;
            box-shadow: inset 0 0 50px rgba(181, 146, 87, 0.05);
          }
          .header {
            font-size: 20px;
            font-weight: bold;
            color: #8c6b2d;
            margin-top: 5px;
          }
          .logo {
            font-size: 28px;
            margin-bottom: 5px;
          }
          .title {
            font-size: 16px;
            margin-top: 10px;
            font-style: italic;
          }
          .recipient {
            font-size: 22px;
            font-weight: bold;
            color: #111;
            margin: 12px 0;
            border-bottom: 2px solid #b39257;
            display: inline-block;
            padding: 0 24px;
          }
          .text {
            font-size: 12px;
            line-height: 1.5;
            color: #444;
          }
          .footer {
            margin-top: 20px;
            display: flex;
            justify-content: space-between;
            padding: 0 10px;
            font-size: 10px;
          }
          .seal {
            position: absolute;
            bottom: 25px;
            left: 50%;
            transform: translateX(-50%);
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: radial-gradient(circle, #ffd700, #b39257);
            border: 2px dashed #8c6b2d;
            opacity: 0.85;
            display: flex;
            justify-content: center;
            align-items: center;
            color: #fff;
            font-weight: bold;
            font-size: 8px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="logo">🎓</div>
          <div class="header">STIKOM YOS SUDARSO</div>
          <div class="title">VERIFIKASI IJAZAH SAH</div>
          <div class="text">Dokumen Ijazah Asal telah diunggah dan terverifikasi secara resmi atas nama:</div>
          <div class="recipient">${userName}</div>
          <div class="text">
            Telah menyelesaikan seluruh jenjang pendidikan menengah/tinggi sebelumnya<br>
            dan layak mengikuti proses Rekognisi Pembelajaran Lampau (RPL)<br>
            pada program studi tujuan: <strong>${prodiName}</strong>.
          </div>
          <div class="seal">SEAL STIKOM</div>
          <div class="footer">
            <div>
              Tanggal Dokumen:<br>
              <strong>${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
            </div>
            <div>
              Nama File:<br>
              <strong style="font-family: monospace; font-size: 9px;">${fileName}</strong>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  } else {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            background-color: #fafbfc;
            color: #333;
            margin: 0;
            padding: 12px;
            font-size: 11px;
          }
          .transcript {
            background: #fff;
            border: 1px solid #e1e4e8;
            border-radius: 6px;
            padding: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.01);
            width: 100%;
            box-sizing: border-box;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
          }
          .title {
            font-size: 14px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 12px;
            color: #24292e;
            border-bottom: 2px solid #e1e4e8;
            padding-bottom: 6px;
          }
          .courses-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          .courses-table th {
            background-color: #f6f8fa;
            border: 1px solid #e1e4e8;
            padding: 6px;
            text-align: left;
            font-weight: 600;
            font-size: 10.5px;
          }
          .courses-table td {
            border: 1px solid #e1e4e8;
            padding: 6px;
            font-size: 10.5px;
          }
          .gpa-box {
            margin-top: 12px;
            text-align: right;
            font-weight: bold;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="transcript">
          <div class="title">TRANSKRIP NILAI AKADEMIK ASAL</div>
          <table class="header-table">
            <tr>
              <td style="width: 100px; color: #586069;">Nama Pendaftar</td>
              <td>: <strong>${userName}</strong></td>
              <td style="width: 100px; color: #586069;">Prodi RPL Pilihan</td>
              <td>: <strong>${prodiName}</strong></td>
            </tr>
            <tr>
              <td style="color: #586069;">Nama Dokumen</td>
              <td style="font-family: monospace; font-size: 10px;">: ${fileName}</td>
              <td style="color: #586069;">Status Akreditasi</td>
              <td>: A (Sangat Baik)</td>
            </tr>
          </table>
          
          <table class="courses-table">
            <thead>
              <tr>
                <th style="width: 80px;">Kode Asal</th>
                <th>Nama Mata Kuliah Asal</th>
                <th style="width: 40px; text-align: center;">SKS</th>
                <th style="width: 40px; text-align: center;">Nilai</th>
              </tr>
            </thead>
            <tbody>
              ${getTranscriptRowsHtml(prodiName)}
            </tbody>
          </table>
          <div class="gpa-box">IPK Komulatif: 3.82 / 4.00</div>
        </div>
      </body>
      </html>
    `;
  }
}

function getTranscriptRowsHtml(prodiName) {
  let list = [];
  if (prodiName.includes('Informatika') || prodiName.includes('TI')) {
    list = [
      { kode: 'TI-101', nama: 'Algoritma & Pemrograman I', sks: 3, nilai: 'A' },
      { kode: 'TI-102', nama: 'Struktur Data & Algoritma', sks: 3, nilai: 'B' },
      { kode: 'TI-103', nama: 'Sistem Manajemen Basis Data', sks: 3, nilai: 'A' },
      { kode: 'TI-104', nama: 'Pendidikan Pancasila', sks: 2, nilai: 'A' }
    ];
  } else if (prodiName.includes('Informasi') || prodiName.includes('SI')) {
    list = [
      { kode: 'SI-101', nama: 'Pengantar Sistem Informasi', sks: 3, nilai: 'A' },
      { kode: 'SI-102', nama: 'Analisis & Perancangan Sistem', sks: 3, nilai: 'B' },
      { kode: 'SI-103', nama: 'Pengantar E-Business', sks: 3, nilai: 'A' },
      { kode: 'SI-104', nama: 'Pendidikan Pancasila', sks: 2, nilai: 'A' }
    ];
  } else if (prodiName.includes('Visual') || prodiName.includes('DKV')) {
    list = [
      { kode: 'DKV-101', nama: 'Dasar Seni Rupa', sks: 3, nilai: 'A' },
      { kode: 'DKV-102', nama: 'Pengantar Tipografi', sks: 3, nilai: 'A' },
      { kode: 'DKV-103', nama: 'Desain Grafis Digital', sks: 4, nilai: 'B' },
      { kode: 'DKV-104', nama: 'Pendidikan Pancasila', sks: 2, nilai: 'A' }
    ];
  } else if (prodiName.includes('Akuntansi') || prodiName.includes('KA')) {
    list = [
      { kode: 'KA-101', nama: 'Pengantar Akuntansi & Keuangan', sks: 3, nilai: 'A' },
      { kode: 'KA-102', nama: 'Sistem Informasi Keuangan', sks: 3, nilai: 'B' },
      { kode: 'KA-103', nama: 'Dasar-Dasar Perpajakan', sks: 3, nilai: 'A' },
      { kode: 'KA-104', nama: 'Pendidikan Pancasila', sks: 2, nilai: 'A' }
    ];
  } else {
    list = [
      { kode: 'MKU-101', nama: 'Mata Kuliah Dasar', sks: 3, nilai: 'B' }
    ];
  }

  return list.map(item => `
    <tr>
      <td style="font-family: monospace;">${item.kode}</td>
      <td><strong>${item.nama}</strong></td>
      <td style="text-align: center;">${item.sks}</td>
      <td style="text-align: center; font-weight: bold; color: ${item.nilai === 'A' ? '#2e7d32' : '#f57c00'};">${item.nilai}</td>
    </tr>
  `).join('');
}

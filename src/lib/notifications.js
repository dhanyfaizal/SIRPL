// Helper untuk mengirim notifikasi WhatsApp menggunakan gateway Fonnte
// Jika VITE_FONNTE_TOKEN tidak terkonfigurasi di env, maka akan menggunakan mock logger.

import { dbProfiles } from './db'

function formatWaNumber(num) {
  if (!num) return ''
  let cleaned = num.replace(/\D/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1)
  }
  return cleaned
}

/**
 * Mengirim notifikasi WhatsApp ke satu atau beberapa nomor tujuan.
 * @param {string|string[]} to - Nomor telepon tujuan (atau array nomor telepon)
 * @param {string} message - Isi pesan teks
 */
async function postToFonnte(to, message) {
  const token = import.meta.env.VITE_FONNTE_TOKEN

  // Normalisasi target (jika array, gabungkan dengan koma)
  const target = Array.isArray(to) 
    ? to.map(formatWaNumber).filter(Boolean).join(',') 
    : formatWaNumber(to)

  if (!target) {
    console.warn('[Fonnte Notification] Tidak ada nomor telepon tujuan yang valid.')
    return false
  }

  if (!token || token.includes('placeholder') || token === '') {
    console.log(`%c[MOCK WA NOTIFICATION] (Fonnte Token Belum Dikonfigurasi)
Target: ${target}
Pesan: ${message}`, 'background: #075e54; color: #fff; padding: 6px; border-radius: 4px;')
    return true
  }

  try {
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target: target,
        message: message
      })
    })

    const data = await response.json()
    if (response.ok && data.status) {
      console.log(`[Fonnte Notification] Berhasil terkirim ke ${target}`)
      return true
    } else {
      console.error('[Fonnte Notification] Gagal mengirim:', data.reason || data)
      return false
    }
  } catch (err) {
    console.error('[Fonnte Notification] Kesalahan koneksi:', err)
    return false
  }
}

/**
 * Memicu notifikasi berdasarkan tipe alur status RPL.
 * @param {string} type - Tipe kejadian / status baru ('submitted', 'returned_baak', 'recognized_kaprodi', 'assessed_asessor', 'mapped_admin', 'sanggah')
 * @param {object} payload - Data tambahan yang dibutuhkan (profile, prodi, catatanRevisi, dll.)
 */
export async function sendNotification(type, payload = {}) {
  const { profile, prodi, catatanRevisi } = payload
  const namaPendaftar = profile?.nama_lengkap || 'Calon Mahasiswa'
  const waPendaftar = profile?.no_whatsapp
  const namaProdi = prodi?.nama || '-'

  let message = ''
  let recipients = []

  switch (type) {
    case 'submitted':
      // Notifikasi PMB/BAAK: Ada pengajuan RPL baru masuk
      message = `*Notifikasi SI-RPL STIKOM Yos Sudarso*\n\nAda pengajuan RPL baru masuk atas nama *${namaPendaftar}* untuk Program Studi *${namaProdi}*.\nMohon BAAK/PMB segera memeriksa kelayakan berkas pada sistem.`
      
      // Ambil semua profil BAAK & PMB
      try {
        const { data: users } = await dbProfiles.getAll()
        const staff = (users || []).filter(u => ['baak', 'pmb', 'admin'].includes(u.role) && u.no_whatsapp)
        recipients = staff.map(u => u.no_whatsapp)
      } catch (err) {
        console.error('Gagal mengambil daftar staff untuk notifikasi:', err)
      }
      break;

    case 'returned_baak':
      // Notifikasi Calon Mahasiswa: Berkas dikembalikan untuk direvisi
      message = `*Notifikasi SI-RPL STIKOM Yos Sudarso*\n\nHalo *${namaPendaftar}*,\nBerkas pendaftaran RPL Anda dikembalikan oleh petugas BAAK untuk direvisi dengan catatan:\n\n_"${catatanRevisi || 'Silakan lengkapi berkas Anda kembali'}"_\n\nSilakan masuk ke portal pendaftaran Anda untuk melakukan perbaikan.`
      if (waPendaftar) recipients.push(waPendaftar)
      break;

    case 'recognized_kaprodi':
      // Notifikasi Asessor: Berkas RPL disetujui Kaprodi dan siap dilakukan asesmen akademik
      message = `*Notifikasi SI-RPL STIKOM Yos Sudarso*\n\nBerkas RPL calon mahasiswa *${namaPendaftar}* (Prodi: *${namaProdi}*) telah disetujui Kaprodi dan siap dilakukan asesmen akademik.\nMohon Asessor segera melakukan pemetaan rekognisi matkul di portal.`
      
      // Ambil semua profil Asessor
      try {
        const { data: users } = await dbProfiles.getAll()
        const assessors = (users || []).filter(u => u.role === 'asessor' && u.no_whatsapp)
        recipients = assessors.map(u => u.no_whatsapp)
      } catch (err) {
        console.error('Gagal mengambil daftar asessor untuk notifikasi:', err)
      }
      break;

    case 'assessed_asessor':
      // Jika ada catatanRevisi pada status assessed_asessor, berarti ini adalah SANGGAHAN dari Calon Mahasiswa
      if (catatanRevisi) {
        message = `*Notifikasi SI-RPL STIKOM Yos Sudarso*\n\nCalon Mahasiswa atas nama *${namaPendaftar}* mengajukan sanggahan rencana studi dengan alasan:\n\n_"${catatanRevisi}"_\n\nMohon Admin Akademik segera meninjau kembali berkas pengajuan tersebut.`
      } else {
        // Notifikasi Admin: Asesmen akademik selesai, menunggu finalisasi pemetaan
        message = `*Notifikasi SI-RPL STIKOM Yos Sudarso*\n\nAsesmen akademik untuk *${namaPendaftar}* telah diselesaikan oleh Asessor.\nStatus saat ini menunggu finalisasi jalur pembelajaran & penetapan diskon biaya dari Admin Akademik.`
      }

      // Ambil semua profil Admin
      try {
        const { data: users } = await dbProfiles.getAll()
        const admins = (users || []).filter(u => u.role === 'admin' && u.no_whatsapp)
        recipients = admins.map(u => u.no_whatsapp)
      } catch (err) {
        console.error('Gagal mengambil daftar admin untuk notifikasi:', err)
      }
      break;

    case 'mapped_admin':
      // Notifikasi Calon Mahasiswa: Rencana Studi dan Biaya Semesteran RPL resmi diterbitkan
      message = `*Notifikasi SI-RPL STIKOM Yos Sudarso*\n\nHalo *${namaPendaftar}*,\nSelamat! Rencana Studi & Biaya Semesteran RPL Anda resmi diterbitkan oleh Admin Akademik.\n\nSilakan cek portal pendaftaran Anda untuk mengunduh laporan rencana studi (PDF) dan melakukan konfirmasi/sanggah.`
      if (waPendaftar) recipients.push(waPendaftar)
      break;

    case 'sanggah':
      // Notifikasi Admin: Calon Mahasiswa mengajukan sanggahan (bisa dipanggil eksplisit jika diinginkan)
      message = `*Notifikasi SI-RPL STIKOM Yos Sudarso*\n\nCalon Mahasiswa atas nama *${namaPendaftar}* mengajukan sanggahan rencana studi dengan alasan:\n\n_"${catatanRevisi || '-'}"_\n\nMohon Admin Akademik segera meninjau kembali berkas pengajuan tersebut.`
      
      // Ambil semua profil Admin
      try {
        const { data: users } = await dbProfiles.getAll()
        const admins = (users || []).filter(u => u.role === 'admin' && u.no_whatsapp)
        recipients = admins.map(u => u.no_whatsapp)
      } catch (err) {
        console.error('Gagal mengambil daftar admin untuk notifikasi:', err)
      }
      break;

    default:
      console.warn(`[Notification] Tipe notifikasi tidak dikenal: ${type}`)
      return;
  }

  if (recipients.length > 0) {
    await postToFonnte(recipients, message)
  } else {
    // Jika tidak ada nomor whatsapp staf yang ditemukan, kita kirimkan ke console log
    console.log(`%c[MOCK WA NOTIFICATION] (Penerima Kosong / Default Logger)
Pesan: ${message}`, 'background: #1e3a8a; color: #fff; padding: 6px; border-radius: 4px;')
  }
}

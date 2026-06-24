import { supabase, isMock } from './supabase'

// ── Seed Data Awal untuk Mode Mock ─────────────────────────────
const MOCK_PRODI = [
  { id: 'prodi-if', kode: 'IF', nama: 'Teknik Informatika', is_active: true },
  { id: 'prodi-si', kode: 'SI', nama: 'Sistem Informasi', is_active: true },
  { id: 'prodi-dkv', kode: 'DKV', nama: 'Desain Komunikasi Visual', is_active: true },
  { id: 'prodi-ka', kode: 'KA', nama: 'Komputerisasi Akuntansi', is_active: true }
]

const MOCK_MK = [
  // Teknik Informatika - Umum
  { id: 'mk-if-mku101', prodi_id: 'prodi-if', kode_mk: 'MKU101', nama_mk: 'Pancasila', sks: 2, jenis: 'umum' },
  { id: 'mk-if-mku102', prodi_id: 'prodi-if', kode_mk: 'MKU102', nama_mk: 'Kewarganegaraan', sks: 2, jenis: 'umum' },
  { id: 'mk-if-mku103', prodi_id: 'prodi-if', kode_mk: 'MKU103', nama_mk: 'Bahasa Indonesia', sks: 2, jenis: 'umum' },
  { id: 'mk-if-mku104', prodi_id: 'prodi-if', kode_mk: 'MKU104', nama_mk: 'Bahasa Inggris Akademik', sks: 2, jenis: 'umum' },
  { id: 'mk-if-mku105', prodi_id: 'prodi-if', kode_mk: 'MKU105', nama_mk: 'Kewirausahaan', sks: 3, jenis: 'umum' },
  { id: 'mk-if-mku106', prodi_id: 'prodi-if', kode_mk: 'MKU106', nama_mk: 'Etika Profesi IT', sks: 2, jenis: 'umum' },
  // Teknik Informatika - Inti
  { id: 'mk-if-mki201', prodi_id: 'prodi-if', kode_mk: 'MKI201', nama_mk: 'Dasar-Dasar Pemrograman', sks: 4, jenis: 'inti' },
  { id: 'mk-if-mki202', prodi_id: 'prodi-if', kode_mk: 'MKI202', nama_mk: 'Struktur Data & Algoritma', sks: 4, jenis: 'inti' },
  { id: 'mk-if-mki203', prodi_id: 'prodi-if', kode_mk: 'MKI203', nama_mk: 'Basis Data Terdistribusi', sks: 3, jenis: 'inti' },
  { id: 'mk-if-mki204', prodi_id: 'prodi-if', kode_mk: 'MKI204', nama_mk: 'Pemrograman Web Enterprise', sks: 4, jenis: 'inti' },
  { id: 'mk-if-mki205', prodi_id: 'prodi-if', kode_mk: 'MKI205', nama_mk: 'Rekayasa Perangkat Lunak', sks: 3, jenis: 'inti' },
  { id: 'mk-if-mki206', prodi_id: 'prodi-if', kode_mk: 'MKI206', nama_mk: 'Kecerdasan Buatan (AI)', sks: 3, jenis: 'inti' },
  { id: 'mk-if-mki207', prodi_id: 'prodi-if', kode_mk: 'MKI207', nama_mk: 'Keamanan Jaringan & Siber', sks: 3, jenis: 'inti' },
  { id: 'mk-if-mki208', prodi_id: 'prodi-if', kode_mk: 'MKI208', nama_mk: 'Sistem Operasi', sks: 3, jenis: 'inti' },

  // Sistem Informasi
  { id: 'mk-si-mku101', prodi_id: 'prodi-si', kode_mk: 'MKU101', nama_mk: 'Pancasila', sks: 2, jenis: 'umum' },
  { id: 'mk-si-mku102', prodi_id: 'prodi-si', kode_mk: 'MKU102', nama_mk: 'Kewarganegaraan', sks: 2, jenis: 'umum' },
  { id: 'mk-si-mki301', prodi_id: 'prodi-si', kode_mk: 'MKI301', nama_mk: 'Pengantar Sistem Informasi', sks: 3, jenis: 'inti' },
  { id: 'mk-si-mki302', prodi_id: 'prodi-si', kode_mk: 'MKI302', nama_mk: 'Analisis & Perancangan Sistem', sks: 3, jenis: 'inti' },
  { id: 'mk-si-mki303', prodi_id: 'prodi-si', kode_mk: 'MKI303', nama_mk: 'E-Business & E-Commerce', sks: 3, jenis: 'inti' },

  // Desain Komunikasi Visual
  { id: 'mk-dkv-mku101', prodi_id: 'prodi-dkv', kode_mk: 'MKU101', nama_mk: 'Pancasila', sks: 2, jenis: 'umum' },
  { id: 'mk-dkv-mki401', prodi_id: 'prodi-dkv', kode_mk: 'MKI401', nama_mk: 'Menggambar Bentuk', sks: 3, jenis: 'inti' },
  { id: 'mk-dkv-mki402', prodi_id: 'prodi-dkv', kode_mk: 'MKI402', nama_mk: 'Tipografi Dasar', sks: 3, jenis: 'inti' },
  { id: 'mk-dkv-mki403', prodi_id: 'prodi-dkv', kode_mk: 'MKI403', nama_mk: 'Desain Grafis Digital', sks: 4, jenis: 'inti' }
]

// Inisialisasi data mock ke local storage jika belum ada
function initMockStorage() {
  const existingProdi = localStorage.getItem('si_rpl_program_studi')
  if (!existingProdi || !existingProdi.includes('prodi-ka')) {
    localStorage.setItem('si_rpl_program_studi', JSON.stringify(MOCK_PRODI))
  }
  if (!localStorage.getItem('si_rpl_mata_kuliah')) {
    localStorage.setItem('si_rpl_mata_kuliah', JSON.stringify(MOCK_MK))
  }
  if (!localStorage.getItem('si_rpl_pengajuan')) {
    localStorage.setItem('si_rpl_pengajuan', JSON.stringify([]))
  }
  if (!localStorage.getItem('si_rpl_rekognisi')) {
    localStorage.setItem('si_rpl_rekognisi', JSON.stringify({}))
  }
  if (!localStorage.getItem('si_rpl_penetapan')) {
    localStorage.setItem('si_rpl_penetapan', JSON.stringify({}))
  }
  if (!localStorage.getItem('si_rpl_profiles')) {
    localStorage.setItem('si_rpl_profiles', JSON.stringify([]))
  }
  if (!localStorage.getItem('si_rpl_notifikasi')) {
    localStorage.setItem('si_rpl_notifikasi', JSON.stringify([]))
  }
}

if (isMock) {
  initMockStorage()
}

// Helper untuk mengambil data local storage
const getLocalData = (key) => JSON.parse(localStorage.getItem(key) || '[]')
const saveLocalData = (key, data) => localStorage.setItem(key, JSON.stringify(data))

// ── 1. Program Studi ──────────────────────────────────────────
export const dbProdi = {
  getAll: async () => {
    if (isMock) {
      return { data: getLocalData('si_rpl_program_studi'), error: null }
    }
    return supabase.from('program_studi').select('*').order('nama')
  },
  getById: async (id) => {
    if (isMock) {
      const data = getLocalData('si_rpl_program_studi').find(p => p.id === id)
      return { data, error: data ? null : new Error('Prodi tidak ditemukan') }
    }
    return supabase.from('program_studi').select('*').eq('id', id).single()
  },
  update: async (id, data) => {
    if (isMock) {
      const list = getLocalData('si_rpl_program_studi')
      const idx = list.findIndex(x => x.id === id)
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...data }
        saveLocalData('si_rpl_program_studi', list)
        return { data: list[idx], error: null }
      }
      return { data: null, error: new Error('Prodi tidak ditemukan') }
    }
    return supabase.from('program_studi').update(data).eq('id', id).select().single()
  }
}

// ── 2. Mata Kuliah Kurikulum ───────────────────────────────────
export const dbMK = {
  getAll: async () => {
    if (isMock) {
      return { data: getLocalData('si_rpl_mata_kuliah'), error: null }
    }
    return supabase.from('mata_kuliah_kurikulum').select('*, prodi:program_studi!prodi_id(id, kode, nama)').order('kode_mk')
  },

  getByProdi: async (prodiId) => {
    if (isMock) {
      const data = getLocalData('si_rpl_mata_kuliah').filter(mk => mk.prodi_id === prodiId)
      return { data, error: null }
    }
    return supabase.from('mata_kuliah_kurikulum').select('*').eq('prodi_id', prodiId).order('kode_mk')
  },

  create: async (payload) => {
    if (isMock) {
      const list = getLocalData('si_rpl_mata_kuliah')
      const newItem = {
        ...payload,
        id: 'mk-' + Math.random().toString(36).slice(2, 10),
        created_at: new Date().toISOString()
      }
      list.push(newItem)
      saveLocalData('si_rpl_mata_kuliah', list)
      return { data: newItem, error: null }
    }
    return supabase.from('mata_kuliah_kurikulum').insert(payload).select().single()
  },

  createBatch: async (items) => {
    if (isMock) {
      const list = getLocalData('si_rpl_mata_kuliah')
      const newItems = items.map(item => ({
        ...item,
        id: 'mk-' + Math.random().toString(36).slice(2, 10),
        created_at: new Date().toISOString()
      }))
      list.push(...newItems)
      saveLocalData('si_rpl_mata_kuliah', list)
      return { data: newItems, error: null }
    }
    return supabase.from('mata_kuliah_kurikulum').insert(items).select()
  },

  delete: async (id) => {
    if (isMock) {
      const list = getLocalData('si_rpl_mata_kuliah')
      const filtered = list.filter(mk => mk.id !== id)
      saveLocalData('si_rpl_mata_kuliah', filtered)
      return { data: { id }, error: null }
    }
    return supabase.from('mata_kuliah_kurikulum').delete().eq('id', id)
  },

  update: async (id, payload) => {
    if (isMock) {
      const list = getLocalData('si_rpl_mata_kuliah')
      const idx = list.findIndex(mk => mk.id === id)
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...payload }
        saveLocalData('si_rpl_mata_kuliah', list)
        return { data: list[idx], error: null }
      }
      return { data: null, error: { message: 'Not found' } }
    }
    return supabase.from('mata_kuliah_kurikulum').update(payload).eq('id', id).select().single()
  }
}

// ── 3. Pengajuan RPL ───────────────────────────────────────────
export const dbPengajuan = {
  getAll: async () => {
    if (isMock) {
      const list = getLocalData('si_rpl_pengajuan')
      const prodis = getLocalData('si_rpl_program_studi')
      const profiles = getLocalData('si_rpl_profiles')

      const data = list.map(item => ({
        ...item,
        profile: profiles.find(p => p.id === item.user_id) || { nama_lengkap: 'Calon Mahasiswa', email: 'calon@example.com' },
        prodi: prodis.find(p => p.id === item.prodi_pilihan_id) || { nama: '-' }
      }))

      return { data, error: null }
    }
    return supabase.from('pengajuan_rpl').select(`
      *,
      profile:profiles!user_id(*),
      prodi:program_studi!prodi_pilihan_id(*)
    `).order('created_at', { ascending: false })
  },

  getByUserId: async (userId) => {
    if (isMock) {
      const list = getLocalData('si_rpl_pengajuan').filter(item => item.user_id === userId)
      const prodis = getLocalData('si_rpl_program_studi')
      const data = list.map(item => ({
        ...item,
        prodi: prodis.find(p => p.id === item.prodi_pilihan_id) || { nama: '-' }
      }))
      return { data, error: null }
    }
    return supabase.from('pengajuan_rpl').select(`
      *,
      prodi:program_studi!prodi_pilihan_id(*)
    `).eq('user_id', userId).order('created_at', { ascending: false })
  },

  getById: async (id) => {
    if (isMock) {
      const item = getLocalData('si_rpl_pengajuan').find(x => x.id === id)
      if (!item) return { data: null, error: new Error('Pengajuan tidak ditemukan') }

      const prodis = getLocalData('si_rpl_program_studi')
      const profiles = getLocalData('si_rpl_profiles')
      const data = {
        ...item,
        profile: profiles.find(p => p.id === item.user_id) || { nama_lengkap: 'Calon Mahasiswa', email: 'calon@example.com' },
        prodi: prodis.find(p => p.id === item.prodi_pilihan_id) || { nama: '-' }
      }
      return { data, error: null }
    }
    return supabase.from('pengajuan_rpl').select(`
      *,
      profile:profiles!user_id(*),
      prodi:program_studi!prodi_pilihan_id(*)
    `).eq('id', id).single()
  },

  create: async (data) => {
    if (isMock) {
      const list = getLocalData('si_rpl_pengajuan')
      const newItem = {
        sertifikat_kompetensi: [],
        pengalaman_kerja: [],
        status: 'draft',
        is_archived: false,
        file_ijazah_sma_url: null,
        file_transkrip_sma_url: null,
        file_ijazah_url: null,
        file_transkrip_url: null,
        submitted_at: null,
        ...data,
        id: 'pengajuan-' + Math.random().toString(36).slice(2, 10),
        created_at: new Date().toISOString()
      }
      if (newItem.status === 'submitted' && !newItem.submitted_at) {
        newItem.submitted_at = new Date().toISOString()
      }
      list.push(newItem)
      saveLocalData('si_rpl_pengajuan', list)
      return { data: newItem, error: null }
    }
    const insertPayload = { status: 'draft', is_archived: false, file_ijazah_sma_url: null, file_transkrip_sma_url: null, file_ijazah_url: null, file_transkrip_url: null, ...data }
    if (insertPayload.status === 'submitted' && !insertPayload.submitted_at) {
      insertPayload.submitted_at = new Date().toISOString()
    }
    const { data: resData, error } = await supabase.from('pengajuan_rpl').insert(insertPayload).select().single()
    if (error) throw new Error(error.message)
    return { data: resData, error: null }
  },

  updateStatus: async (id, status, catatanRevisi = null) => {
    let result;
    if (isMock) {
      const list = getLocalData('si_rpl_pengajuan')
      const idx = list.findIndex(x => x.id === id)
      if (idx !== -1) {
        list[idx].status = status
        list[idx].catatan_revisi = catatanRevisi
        if (status === 'submitted' && !list[idx].submitted_at) {
          list[idx].submitted_at = new Date().toISOString()
        }
        list[idx].updated_at = new Date().toISOString()
        saveLocalData('si_rpl_pengajuan', list)
        result = { data: list[idx], error: null }
      } else {
        return { data: null, error: new Error('Pengajuan tidak ditemukan') }
      }
    } else {
      const updatePayload = { status, updated_at: new Date().toISOString() }
      if (status === 'submitted') {
        updatePayload.submitted_at = new Date().toISOString()
      }
      if (catatanRevisi !== undefined) {
        updatePayload.catatan_revisi = catatanRevisi
      }
      const { data: resData, error } = await supabase.from('pengajuan_rpl').update(updatePayload).eq('id', id).select().single()
      if (error) throw new Error(error.message)
      result = { data: resData, error: null }
    }

    // Trigger notification asynchronously
    try {
      const { data: item } = await dbPengajuan.getById(id)
      if (item) {
        const { sendNotification } = await import('./notifications')
        sendNotification(status, {
          profile: item.profile,
          prodi: item.prodi,
          catatanRevisi: catatanRevisi
        }).catch(err => console.error('Failed to send WA notification:', err))

        // Trigger in-app notification
        triggerInAppNotification(status, item, catatanRevisi).catch(err => 
          console.error('Failed to trigger in-app notification:', err)
        )
      }
    } catch (notificationErr) {
      console.error('Error triggering notification:', notificationErr)
    }

    return result
  },

  update: async (id, data) => {
    if (isMock) {
      const list = getLocalData('si_rpl_pengajuan')
      const idx = list.findIndex(x => x.id === id)
      if (idx !== -1) {
        const original = list[idx]
        let submitted_at = original.submitted_at
        if (data.status === 'submitted' && !original.submitted_at) {
          submitted_at = new Date().toISOString()
        }
        list[idx] = { ...original, ...data, submitted_at, updated_at: new Date().toISOString() }
        saveLocalData('si_rpl_pengajuan', list)
        return { data: list[idx], error: null }
      }
      return { data: null, error: new Error('Pengajuan tidak ditemukan') }
    }
    const payload = { ...data, updated_at: new Date().toISOString() }
    if (data.status === 'submitted' && !data.submitted_at) {
      payload.submitted_at = new Date().toISOString()
    }
    const { data: resData, error } = await supabase.from('pengajuan_rpl').update(payload).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return { data: resData, error: null }
  },

  archive: async (id) => {
    if (isMock) {
      const list = getLocalData('si_rpl_pengajuan')
      const idx = list.findIndex(x => x.id === id)
      if (idx !== -1) {
        list[idx].is_archived = true
        list[idx].updated_at = new Date().toISOString()
        saveLocalData('si_rpl_pengajuan', list)
        return { data: list[idx], error: null }
      }
      return { data: null, error: new Error('Pengajuan tidak ditemukan') }
    }
    const { data: resData, error } = await supabase.from('pengajuan_rpl').update({ is_archived: true, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) throw new Error(error.message)
    return { data: resData, error: null }
  },

  delete: async (id) => {
    if (isMock) {
      const list = getLocalData('si_rpl_pengajuan')
      const filtered = list.filter(x => x.id !== id)
      saveLocalData('si_rpl_pengajuan', filtered)

      // cascade delete mock
      const rekognisi = JSON.parse(localStorage.getItem('si_rpl_rekognisi') || '{}')
      delete rekognisi[id]
      localStorage.setItem('si_rpl_rekognisi', JSON.stringify(rekognisi))

      const penetapan = JSON.parse(localStorage.getItem('si_rpl_penetapan') || '{}')
      delete penetapan[id]
      localStorage.setItem('si_rpl_penetapan', JSON.stringify(penetapan))

      return { data: { id }, error: null }
    }

    try {
      // Dapatkan data pengajuan terlebih dahulu untuk mengambil user_id
      const { data: pengajuan } = await supabase
        .from('pengajuan_rpl')
        .select('user_id')
        .eq('id', id)
        .maybeSingle()

      if (pengajuan?.user_id) {
        const userId = pengajuan.user_id
        // List semua berkas di folder user tersebut
        const { data: files } = await supabase.storage.from('rpl-documents').list(userId)
        if (files && files.length > 0) {
          const filePaths = files.map(f => `${userId}/${f.name}`)
          // Hapus semua berkas secara massal dari storage
          await supabase.storage.from('rpl-documents').remove(filePaths)
        }
      }
    } catch (err) {
      console.error('Error deleting files from storage:', err)
    }

    return supabase.from('pengajuan_rpl').delete().eq('id', id)
  }
}

// ── 4. Tabel Rekognisi ─────────────────────────────────────────
export const dbRekognisi = {
  getByPengajuanId: async (pengajuanId) => {
    if (isMock) {
      const store = JSON.parse(localStorage.getItem('si_rpl_rekognisi') || '{}')
      const data = store[pengajuanId] || null
      return { data, error: null }
    }
    return supabase.from('tabel_rekognisi').select('*').eq('pengajuan_id', pengajuanId).maybeSingle()
  },

  getAll: async () => {
    if (isMock) {
      const store = JSON.parse(localStorage.getItem('si_rpl_rekognisi') || '{}')
      return { data: Object.values(store), error: null }
    }
    return supabase.from('tabel_rekognisi').select('*')
  },

  upsert: async (pengajuanId, data) => {
    if (isMock) {
      const store = JSON.parse(localStorage.getItem('si_rpl_rekognisi') || '{}')
      const current = store[pengajuanId] || { id: 'rekognisi-' + Math.random().toString(36).slice(2, 10), pengajuan_id: pengajuanId }
      const updated = { ...current, ...data }
      store[pengajuanId] = updated
      localStorage.setItem('si_rpl_rekognisi', JSON.stringify(store))
      return { data: updated, error: null }
    }
    const { data: existing } = await supabase.from('tabel_rekognisi').select('id').eq('pengajuan_id', pengajuanId).maybeSingle()
    if (existing) {
      return supabase.from('tabel_rekognisi').update(data).eq('pengajuan_id', pengajuanId).select().single()
    } else {
      return supabase.from('tabel_rekognisi').insert({ pengajuan_id: pengajuanId, ...data }).select().single()
    }
  }
}

// ── 5. Penetapan Akhir ─────────────────────────────────────────
export const dbPenetapan = {
  getByPengajuanId: async (pengajuanId) => {
    if (isMock) {
      const store = JSON.parse(localStorage.getItem('si_rpl_penetapan') || '{}')
      const data = store[pengajuanId] || null
      return { data, error: null }
    }
    return supabase.from('penetapan_akhir').select('*').eq('pengajuan_id', pengajuanId).maybeSingle()
  },

  upsert: async (pengajuanId, data) => {
    if (isMock) {
      const store = JSON.parse(localStorage.getItem('si_rpl_penetapan') || '{}')
      const current = store[pengajuanId] || { id: 'penetapan-' + Math.random().toString(36).slice(2, 10), pengajuan_id: pengajuanId }
      const updated = { ...current, ...data }
      store[pengajuanId] = updated
      localStorage.setItem('si_rpl_penetapan', JSON.stringify(store))
      return { data: updated, error: null }
    }
    const { data: existing } = await supabase.from('penetapan_akhir').select('id').eq('pengajuan_id', pengajuanId).maybeSingle()
    if (existing) {
      return supabase.from('penetapan_akhir').update(data).eq('pengajuan_id', pengajuanId).select().single()
    } else {
      return supabase.from('penetapan_akhir').insert({ pengajuan_id: pengajuanId, ...data }).select().single()
    }
  }
}

// ── 6. Profiles ───────────────────────────────────────────────
export const dbProfiles = {
  getOrCreateProfile: async (id, fallbackEmail, fallbackName, role = 'calon_rpl') => {
    if (isMock) {
      const list = getLocalData('si_rpl_profiles')
      let item = list.find(x => x.id === id)
      if (!item) {
        item = {
          id,
          email: fallbackEmail,
          nama_lengkap: fallbackName,
          role: role,
          is_verified: fallbackEmail === 'danizsheila@gmail.com' ? true : false,
          foto_url: null
        }
        list.push(item)
        saveLocalData('si_rpl_profiles', list)
      }
      return { data: item, error: null }
    }

    const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
    if (!error && data) return { data, error }

    // Buat profil baru
    return supabase.from('profiles').insert({
      id,
      email: fallbackEmail,
      nama_lengkap: fallbackName,
      role,
      is_verified: fallbackEmail === 'danizsheila@gmail.com' ? true : false
    }).select().single()
  },

  getAll: async () => {
    if (isMock) {
      return { data: getLocalData('si_rpl_profiles'), error: null }
    }
    return supabase.from('profiles').select('*').order('created_at', { ascending: false })
  },

  updateUser: async (id, updates) => {
    if (isMock) {
      const list = getLocalData('si_rpl_profiles')
      const idx = list.findIndex(x => x.id === id)
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates }
        saveLocalData('si_rpl_profiles', list)
        return { data: list[idx], error: null }
      }
      return { data: null, error: new Error('User tidak ditemukan') }
    }
    return supabase.from('profiles').update(updates).eq('id', id).select().single()
  },

  updateRole: async (id, role) => {
    return dbProfiles.updateUser(id, { role })
  }
}

// ── 7. Feedback Pelayanan ──────────────────────────────────────
export const dbFeedback = {
  submit: async (pengajuanId, userId, payload) => {
    if (isMock) {
      const store = JSON.parse(localStorage.getItem('si_rpl_feedback') || '{}')
      const data = {
        id: 'fb-' + Math.random().toString(36).slice(2, 10),
        pengajuan_id: pengajuanId,
        user_id: userId,
        created_at: new Date().toISOString(),
        ...payload
      }
      store[pengajuanId] = data
      localStorage.setItem('si_rpl_feedback', JSON.stringify(store))
      return { data, error: null }
    }
    return supabase
      .from('feedback_pelayanan')
      .insert({ pengajuan_id: pengajuanId, user_id: userId, ...payload })
      .select()
      .single()
  },
  getByPengajuanId: async (pengajuanId) => {
    if (isMock) {
      const store = JSON.parse(localStorage.getItem('si_rpl_feedback') || '{}')
      return { data: store[pengajuanId] || null, error: null }
    }
    return supabase
      .from('feedback_pelayanan')
      .select('*')
      .eq('pengajuan_id', pengajuanId)
      .maybeSingle()
  },
  getAll: async () => {
    if (isMock) {
      const store = JSON.parse(localStorage.getItem('si_rpl_feedback') || '{}')
      const submissions = getLocalData('si_rpl_pengajuan')
      const profiles = getLocalData('si_rpl_profiles')
      const prodis = getLocalData('si_rpl_program_studi')
      
      const data = Object.values(store).map(fb => {
        const sub = submissions.find(s => s.id === fb.pengajuan_id) || {}
        return {
          ...fb,
          profile: profiles.find(p => p.id === fb.user_id) || { nama_lengkap: 'Calon Mahasiswa' },
          prodi: prodis.find(p => p.id === sub.prodi_pilihan_id) || { nama: '-' }
        }
      })
      return { data, error: null }
    }
    const { data, error } = await supabase
      .from('feedback_pelayanan')
      .select(`
        *,
        profile:profiles!user_id(*),
        pengajuan:pengajuan_rpl!pengajuan_id(
          prodi:program_studi!prodi_pilihan_id(*)
        )
      `)
      .order('created_at', { ascending: false })
    
    const normalized = (data || []).map(fb => ({
      ...fb,
      prodi: fb.pengajuan?.prodi || { nama: '-' }
    }))
    
    return { data: normalized, error }
  }
}

// ── 8. Tabel Notifikasi (In-App) ───────────────────────────────
export const dbNotifikasi = {
  getByUserId: async (userId) => {
    if (isMock) {
      const all = getLocalData('si_rpl_notifikasi')
      const userNotifs = all.filter(n => n.user_id === userId).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      return { data: userNotifs, error: null }
    }
    return supabase.from('notifikasi').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  },

  create: async (userId, title, message, type, link = '') => {
    const payload = {
      user_id: userId,
      title,
      message,
      type,
      link,
      is_read: false,
      created_at: new Date().toISOString()
    }
    if (isMock) {
      const all = getLocalData('si_rpl_notifikasi')
      const newItem = { ...payload, id: 'notif-' + Math.random().toString(36).slice(2, 10) }
      all.push(newItem)
      saveLocalData('si_rpl_notifikasi', all)
      return { data: newItem, error: null }
    }
    return supabase.from('notifikasi').insert(payload).select().single()
  },

  createForRole: async (targetRole, title, message, type, link = '') => {
    const { data: users } = await dbProfiles.getAll()
    const matchingUsers = (users || []).filter(u => {
      if (targetRole === 'kaprodi') {
        return u.role.startsWith('kaprodi_')
      }
      return u.role === targetRole
    })

    if (isMock) {
      const all = getLocalData('si_rpl_notifikasi')
      const newItems = matchingUsers.map(u => ({
        id: 'notif-' + Math.random().toString(36).slice(2, 10),
        user_id: u.id,
        title,
        message,
        type,
        link,
        is_read: false,
        created_at: new Date().toISOString()
      }))
      all.push(...newItems)
      saveLocalData('si_rpl_notifikasi', all)
      return { data: newItems, error: null }
    }

    const payloads = matchingUsers.map(u => ({
      user_id: u.id,
      title,
      message,
      type,
      link,
      is_read: false
    }))
    if (payloads.length === 0) return { data: [], error: null }
    return supabase.from('notifikasi').insert(payloads).select()
  },

  markAsRead: async (id) => {
    if (isMock) {
      const all = getLocalData('si_rpl_notifikasi')
      const idx = all.findIndex(n => n.id === id)
      if (idx !== -1) {
        all[idx].is_read = true
        saveLocalData('si_rpl_notifikasi', all)
        return { data: all[idx], error: null }
      }
      return { data: null, error: new Error('Notifikasi tidak ditemukan') }
    }
    return supabase.from('notifikasi').update({ is_read: true }).eq('id', id).select().single()
  },

  markAllAsRead: async (userId) => {
    if (isMock) {
      const all = getLocalData('si_rpl_notifikasi')
      const updated = all.map(n => n.user_id === userId ? { ...n, is_read: true } : n)
      saveLocalData('si_rpl_notifikasi', updated)
      return { data: null, error: null }
    }
    return supabase.from('notifikasi').update({ is_read: true }).eq('user_id', userId)
  },

  delete: async (id) => {
    if (isMock) {
      const all = getLocalData('si_rpl_notifikasi')
      const filtered = all.filter(n => n.id !== id)
      saveLocalData('si_rpl_notifikasi', filtered)
      return { data: { id }, error: null }
    }
    return supabase.from('notifikasi').delete().eq('id', id)
  }
}

// ── 9. Trigger In-App Notification ──────────────────────────────
export async function triggerInAppNotification(status, item, catatanRevisi) {
  try {
    const namaPendaftar = item.profile?.nama_lengkap || 'Calon Mahasiswa'
    const namaProdi = item.prodi?.nama || '-'
    const prodiKode = item.prodi?.kode || ''

    const getKaprodiRole = (code) => {
      const c = String(code).toLowerCase()
      if (c === 'if' || c === 'ti') return 'kaprodi_ti'
      if (c === 'si') return 'kaprodi_si'
      if (c === 'dkv') return 'kaprodi_dkv'
      if (c === 'ka') return 'kaprodi_ka'
      return 'kaprodi'
    }

    switch (status) {
      case 'submitted':
        await Promise.all([
          dbNotifikasi.createForRole('baak', 'Pengajuan RPL Baru', `Ada pengajuan RPL baru masuk atas nama ${namaPendaftar} untuk Program Studi ${namaProdi}.`, 'submitted', '/dashboard'),
          dbNotifikasi.createForRole('pmb', 'Pengajuan RPL Baru', `Ada pengajuan RPL baru masuk atas nama ${namaPendaftar} untuk Program Studi ${namaProdi}.`, 'submitted', '/dashboard'),
          dbNotifikasi.createForRole('admin', 'Pengajuan RPL Baru', `Ada pengajuan RPL baru masuk atas nama ${namaPendaftar} untuk Program Studi ${namaProdi}.`, 'submitted', '/dashboard')
        ])
        break

      case 'returned_baak':
        await dbNotifikasi.create(
          item.user_id,
          'Berkas Dikembalikan BAAK',
          `Berkas pengajuan Anda dikembalikan oleh BAAK untuk direvisi dengan catatan: "${catatanRevisi || 'Silakan lengkapi berkas Anda kembali'}"`,
          'returned_baak',
          '/dashboard'
        )
        break

      case 'validated_baak':
        const targetKaprodi = getKaprodiRole(prodiKode)
        await Promise.all([
          dbNotifikasi.createForRole(targetKaprodi, 'Validasi Dokumen Selesai', `Berkas pengajuan ${namaPendaftar} telah divalidasi oleh BAAK. Silakan lakukan persetujuan Kaprodi.`, 'validated_baak', '/dashboard'),
          dbNotifikasi.createForRole('admin', 'Validasi Dokumen Selesai', `Berkas pengajuan ${namaPendaftar} (Prodi: ${namaProdi}) telah divalidasi oleh BAAK.`, 'validated_baak', '/dashboard')
        ])
        break

      case 'returned_kaprodi':
        await Promise.all([
          dbNotifikasi.createForRole('baak', 'Berkas Dikembalikan Kaprodi', `Berkas pengajuan ${namaPendaftar} dikembalikan oleh Kaprodi dengan catatan: "${catatanRevisi || ''}"`, 'returned_kaprodi', '/dashboard'),
          dbNotifikasi.createForRole('pmb', 'Berkas Dikembalikan Kaprodi', `Berkas pengajuan ${namaPendaftar} dikembalikan oleh Kaprodi dengan catatan: "${catatanRevisi || ''}"`, 'returned_kaprodi', '/dashboard'),
          dbNotifikasi.create(
            item.user_id,
            'Berkas Dikembalikan Kaprodi',
            `Berkas pengajuan Anda dikembalikan oleh Kaprodi untuk ditinjau kembali dengan catatan: "${catatanRevisi || ''}"`,
            'returned_kaprodi',
            '/dashboard'
          )
        ])
        break

      case 'recognized_kaprodi':
        await Promise.all([
          dbNotifikasi.createForRole('asessor', 'Berkas Siap Asesmen', `Berkas pengajuan ${namaPendaftar} (Prodi: ${namaProdi}) telah disetujui Kaprodi dan siap dilakukan asesmen akademik.`, 'recognized_kaprodi', '/dashboard'),
          dbNotifikasi.createForRole('admin', 'Berkas Disetujui Kaprodi', `Berkas pengajuan ${namaPendaftar} (Prodi: ${namaProdi}) telah disetujui Kaprodi.`, 'recognized_kaprodi', '/dashboard')
        ])
        break

      case 'returned_asessor':
        const kaprodiRole = getKaprodiRole(prodiKode)
        await Promise.all([
          dbNotifikasi.createForRole(kaprodiRole, 'Asesmen Dikembalikan Asessor', `Asesmen akademik untuk ${namaPendaftar} dikembalikan oleh Asessor dengan catatan: "${catatanRevisi || ''}"`, 'returned_asessor', '/dashboard'),
          dbNotifikasi.createForRole('admin', 'Asesmen Dikembalikan Asessor', `Asesmen akademik untuk ${namaPendaftar} dikembalikan oleh Asessor dengan catatan: "${catatanRevisi || ''}"`, 'returned_asessor', '/dashboard')
        ])
        break

      case 'assessed_asessor':
        if (catatanRevisi) {
          await dbNotifikasi.createForRole(
            'admin',
            'Sanggahan Rencana Studi',
            `${namaPendaftar} mengajukan sanggahan rencana studi dengan alasan: "${catatanRevisi}"`,
            'sanggah',
            '/dashboard'
          )
        } else {
          await dbNotifikasi.createForRole(
            'admin',
            'Asesmen Akademik Selesai',
            `Asessor telah menyelesaikan asesmen akademik untuk ${namaPendaftar}. Menunggu finalisasi & penetapan biaya oleh Admin.`,
            'assessed_asessor',
            '/dashboard'
          )
        }
        break

      case 'mapped_admin':
        await dbNotifikasi.create(
          item.user_id,
          'Rencana Studi & Biaya Diterbitkan',
          `Selamat! Rencana Studi & Biaya Semesteran RPL Anda resmi diterbitkan. Silakan cek portal untuk konfirmasi atau sanggah.`,
          'mapped_admin',
          '/dashboard'
        )
        break

      case 'returned_admin':
        await dbNotifikasi.createForRole(
          'asessor',
          'Pemetaan Dikembalikan Admin',
          `Pemetaan rencana studi untuk ${namaPendaftar} dikembalikan oleh Admin Akademik dengan catatan: "${catatanRevisi || ''}"`,
          'returned_admin',
          '/dashboard'
        )
        break

      default:
        break
    }
  } catch (err) {
    console.error('Gagal memicu in-app notification:', err)
  }
}

// ── 10. Progress Dokumen Helper ────────────────────────────────
export function getDocumentProgress(item) {
  if (!item) return { percent: 0, uploaded: 0, total: 4 }
  let uploaded = 0
  let total = 4 // SMA (Ijazah & Transkrip) + PT (Ijazah & Transkrip)
  if (item.file_ijazah_sma_url) uploaded++
  if (item.file_transkrip_sma_url) uploaded++
  if (item.file_ijazah_url) uploaded++
  if (item.file_transkrip_url) uploaded++

  const percent = Math.round((uploaded / total) * 100)
  return {
    uploaded,
    total,
    percent
  }
}

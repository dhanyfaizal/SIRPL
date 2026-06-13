import { supabase, isMock } from './supabase'

// ── Seed Data Awal untuk Mode Mock ─────────────────────────────
const MOCK_PRODI = [
  { id: 'prodi-if', kode: 'IF', nama: 'Teknik Informatika' },
  { id: 'prodi-si', kode: 'SI', nama: 'Sistem Informasi' },
  { id: 'prodi-dkv', kode: 'DKV', nama: 'Desain Komunikasi Visual' }
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
  if (!localStorage.getItem('si_rpl_program_studi')) {
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
  }
}

// ── 2. Mata Kuliah Kurikulum ───────────────────────────────────
export const dbMK = {
  getByProdi: async (prodiId) => {
    if (isMock) {
      const data = getLocalData('si_rpl_mata_kuliah').filter(mk => mk.prodi_id === prodiId)
      return { data, error: null }
    }
    return supabase.from('mata_kuliah_kurikulum').select('*').eq('prodi_id', prodiId).order('kode_mk')
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
        ...data,
        id: 'pengajuan-' + Math.random().toString(36).slice(2, 10),
        status: 'submitted',
        created_at: new Date().toISOString()
      }
      list.push(newItem)
      saveLocalData('si_rpl_pengajuan', list)
      return { data: newItem, error: null }
    }
    return supabase.from('pengajuan_rpl').insert(data).select().single()
  },

  updateStatus: async (id, status) => {
    if (isMock) {
      const list = getLocalData('si_rpl_pengajuan')
      const idx = list.findIndex(x => x.id === id)
      if (idx !== -1) {
        list[idx].status = status
        list[idx].updated_at = new Date().toISOString()
        saveLocalData('si_rpl_pengajuan', list)
        return { data: list[idx], error: null }
      }
      return { data: null, error: new Error('Pengajuan tidak ditemukan') }
    }
    return supabase.from('pengajuan_rpl').update({ status, updated_at: new Date().toISOString() }).eq('id', id).select().single()
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

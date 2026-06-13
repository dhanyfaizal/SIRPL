import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Mengecek jika env adalah dummy/placeholder
export const isMock = !supabaseUrl || 
                      !supabaseKey || 
                      supabaseUrl.includes('placeholder') || 
                      supabaseKey.includes('placeholder')

if (isMock) {
  console.warn('[SI-RPL] Berjalan dalam Mode Mock (Simulasi LocalStorage). Konfigurasi Supabase asli belum diset.')
}

export const supabase = createClient(
  isMock ? 'https://placeholder.supabase.co' : supabaseUrl,
  isMock ? 'placeholder-key' : supabaseKey
)

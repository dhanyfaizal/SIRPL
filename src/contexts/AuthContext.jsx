import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { supabase, isMock } from '../lib/supabase'
import { dbProfiles } from '../lib/db'
import toast from 'react-hot-toast'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  // Simpan referensi user terbaru untuk menghindari stale closure di useEffect
  const currentUserRef = useRef(null)
  currentUserRef.current = user

  // Inisialisasi Auth
  useEffect(() => {
    // 1. Cek apakah ada sesi mock aktif di LocalStorage
    const mockSession = localStorage.getItem('si_rpl_mock_session')
    if (mockSession) {
      try {
        const sessionObj = JSON.parse(mockSession)
        setUser(sessionObj.user)
        setProfile(sessionObj.profile)
        setRole(sessionObj.profile.role)
        setLoading(false)
        return
      } catch (e) {
        console.error('Failed to parse mock session:', e)
      }
    }

    // Cek apakah ada session cache asli (SWR cache)
    if (!isMock) {
      const realSession = localStorage.getItem('si_rpl_real_session')
      if (realSession) {
        try {
          const sessionObj = JSON.parse(realSession)
          setUser(sessionObj.user)
          setProfile(sessionObj.profile)
          setRole(sessionObj.profile.role)
        } catch (e) {
          console.error('Failed to parse real session cache:', e)
        }
      }
    }

    if (isMock) {
      setLoading(false)
      return
    }

    // 2. Jika bukan mock, gunakan inisialisasi getSession() asinkron
    let active = true
    let subscription = null

    async function initializeAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!active) return

        if (session?.user) {
          setUser(session.user)
          await syncProfile(session.user)
        } else {
          setUser(null)
          setProfile(null)
          setRole(null)
          localStorage.removeItem('si_rpl_real_session')
        }
      } catch (err) {
        console.error('Error during auth initialization:', err)
      } finally {
        if (active) setLoading(false)
      }

      if (active) {
        const { data } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (!active) return
            
            if (event === 'SIGNED_OUT') {
              setUser(null)
              setProfile(null)
              setRole(null)
              localStorage.removeItem('si_rpl_real_session')
            } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              if (session?.user) {
                const isNewLogin = !currentUserRef.current
                if (isNewLogin) {
                  setLoading(true)
                }
                setUser(session.user)
                try {
                  await syncProfile(session.user)
                } catch (err) {
                  console.error('Error syncing profile during auth state change:', err)
                } finally {
                  if (isNewLogin) {
                    setLoading(false)
                  }
                }
              }
            }
          }
        )
        subscription = data.subscription
      }
    }

    initializeAuth()

    return () => {
      active = false
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  // Sinkronisasi profil Supabase dengan tabel profiles
  async function syncProfile(authUser) {
    if (!authUser) return
    const meta = authUser.user_metadata ?? {}
    const nama = meta.full_name || meta.name || authUser.email?.split('@')[0] || 'Pengguna'
    
    const userRole = authUser.email === 'danizsheila@gmail.com' ? 'admin' : 'calon_rpl'

    let { data, error } = await dbProfiles.getOrCreateProfile(
      authUser.id,
      authUser.email,
      nama,
      userRole
    )

    // Paksa update ke role admin jika user login adalah danizsheila@gmail.com namun perannya di database masih calon_rpl atau belum terverifikasi
    if (data && authUser.email === 'danizsheila@gmail.com' && (data.role !== 'admin' || !data.is_verified)) {
      const { data: updated } = await dbProfiles.updateUser(authUser.id, { role: 'admin', is_verified: true })
      if (updated) {
        data = updated
      }
    }

    if (!error && data) {
      setProfile(data)
      setRole(data.role)
      localStorage.setItem('si_rpl_real_session', JSON.stringify({ user: authUser, profile: data }))
    }
  }

  // ── Simulasi Login (Mock Sign-In) ─────────────────────────────
  async function signInMock(selectedRole, fullName) {
    setLoading(true)
    const email = `${selectedRole}@stikomyos.ac.id`
    const mockUser = {
      id: `mock-uid-${selectedRole}`,
      email,
      user_metadata: { full_name: fullName }
    }

    // Buat profil mock di database pembantu
    const { data: mockProfile } = await dbProfiles.getOrCreateProfile(
      mockUser.id,
      mockUser.email,
      fullName,
      selectedRole
    )

    // Pastikan role tersinkronisasi jika user diubah
    if (mockProfile.role !== selectedRole) {
      await dbProfiles.updateRole(mockUser.id, selectedRole)
      mockProfile.role = selectedRole
    }

    setUser(mockUser)
    setProfile(mockProfile)
    setRole(selectedRole)
    
    localStorage.setItem('si_rpl_mock_session', JSON.stringify({ user: mockUser, profile: mockProfile }))
    setLoading(false)
  }

  // ── Email Sign In (Supabase) ───────────────────────────────────
  async function signInWithEmail(email, password) {
    if (isMock) {
      toast.error('Aplikasi sedang berjalan dalam MODE MOCK. Gunakan Simulasi Login Peran.')
      return { error: new Error('Mock mode active') }
    }
    return supabase.auth.signInWithPassword({ email, password })
  }

  // ── Google Sign In (Supabase) ─────────────────────────────────
  async function signInWithGoogle() {
    if (isMock) {
      toast.error('Aplikasi sedang berjalan dalam MODE MOCK. Gunakan Simulasi Login Peran.')
      return
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
  }

  // ── Keluar (Sign Out) ─────────────────────────────────────────
  async function signOut() {
    setLoading(true)
    localStorage.removeItem('si_rpl_mock_session')
    localStorage.removeItem('si_rpl_real_session')
    
    if (!isMock) {
      try {
        await supabase.auth.signOut()
      } catch (err) {
        console.error('Error during supabase.auth.signOut:', err)
      }
    }

    setUser(null)
    setProfile(null)
    setRole(null)
    setLoading(false)
  }

  async function updateProfile(updates) {
    const { data, error } = await dbProfiles.updateUser(user.id, updates)
    if (!error && data) {
      setProfile(data)
      if (isMock) {
        localStorage.setItem('si_rpl_mock_session', JSON.stringify({ user, profile: data }))
      } else {
        localStorage.setItem('si_rpl_real_session', JSON.stringify({ user, profile: data }))
      }
    }
    return { data, error }
  }

  // Mengubah role secara runtime (Context Switcher untuk pengujian)
  async function switchMockRole(newRole) {
    if (!user) return
    setLoading(true)
    const updatedProfile = { ...profile, role: newRole }
    
    if (isMock) {
      const list = JSON.parse(localStorage.getItem('si_rpl_profiles') || '[]')
      const idx = list.findIndex(x => x.id === user.id)
      if (idx !== -1) {
        list[idx].role = newRole
        localStorage.setItem('si_rpl_profiles', JSON.stringify(list))
      }
    } else {
      await dbProfiles.updateRole(user.id, newRole)
    }

    setProfile(updatedProfile)
    setRole(newRole)
    localStorage.setItem('si_rpl_mock_session', JSON.stringify({ user, profile: updatedProfile }))
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      role,
      loading,
      signInMock,
      signInWithGoogle,
      signInWithEmail,
      signOut,
      switchMockRole,
      updateProfile,
      isMock
    }}>
      {children}
    </AuthContext.Provider>
  )
}

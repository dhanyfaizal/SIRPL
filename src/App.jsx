import ThemeProvider from './contexts/ThemeContext'
import AuthProvider from './contexts/AuthContext'
import AppRouter from './router'
import { Toaster } from 'react-hot-toast'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: 'var(--surface)',
              color: 'var(--gray-800)',
              border: '1px solid var(--gray-200)',
              fontSize: '13.5px',
              fontFamily: "'Inter', sans-serif"
            },
            success: {
              iconTheme: {
                primary: 'var(--success)',
                secondary: '#ffffff'
              }
            },
            error: {
              iconTheme: {
                primary: 'var(--danger)',
                secondary: '#ffffff'
              }
            }
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  )
}

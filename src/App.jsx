import { useState, useEffect } from 'react'
import ChatList from './ChatList'
import ChatViewer from './ChatViewer'
import Login from './Login'
import { supabase, supabaseConfigError } from './supabaseClient'
import './App.css' // Asegúrate de importar tu CSS

export default function App() {
  // Enlace directo desde el email de aviso: ?session=<id> abre ese chat ya
  // seleccionado, sin tener que buscarlo a mano en la bandeja.
  const [selectedId, setSelectedId] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('session') || null
  })

  // undefined = comprobando si hay sesión, null = sin sesión (mostrar login)
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    // Si faltan las variables de entorno, saltamos el login: la propia app ya
    // muestra un aviso claro de configuración en vez de una pantalla de login rota.
    if (supabaseConfigError) {
      setSession({ skipAuth: true })
      return
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return <div className="auth-loading">Cargando…</div>
  }

  if (!session) {
    return <Login />
  }

  return (
    <div className="layout">
      <ChatList
        onSelect={(id) => setSelectedId(id)}
        selectedId={selectedId}
        onSignOut={() => supabase.auth.signOut()}
      />

      {/* Pasamos la clase 'mobile-open' como prop en lugar de envolverlo en un div extra.
        Esto mantiene el CSS Grid/Flexbox limpio.
      */}
      <ChatViewer
        sessionId={selectedId}
        onBack={() => setSelectedId(null)}
        className={selectedId ? 'mobile-open' : ''}
      />
    </div>
  )
}

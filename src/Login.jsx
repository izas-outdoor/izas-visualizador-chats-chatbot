import { useState } from 'react'
import { supabase } from './supabaseClient'

// Login "de equipo": una única cuenta de Supabase Auth compartida por todos
// los agentes. Al usuario solo se le pide el PIN; el email va fijo.
const PANEL_EMAIL = 'panel@izas-outdoor.com'

export default function Login() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email: PANEL_EMAIL, password: pin })

    if (error) setError('PIN incorrecto.')
    setLoading(false)
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">Visualizador de chats</h1>
        <p className="login-subtitle">Introduce el PIN del equipo</p>

        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          className="login-input"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoFocus
        />

        {error && <p className="login-error">{error}</p>}

        <button type="submit" className="login-button" disabled={loading || !pin}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}

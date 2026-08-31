import { useEffect, useState, useCallback } from 'react'
import { supabase, supabaseConfigError } from './supabaseClient'

// Supabase/PostgREST limita cada respuesta a 1000 filas, así que traemos la
// tabla completa en páginas en vez de un límite fijo.
const PAGE_SIZE = 1000

// Carga todas las sesiones de chat_sessions y se mantiene al día por realtime.
// Centralizado aquí porque tanto la bandeja (ChatList) como las estadísticas
// (StatsPage) necesitan el mismo dataset completo.
export function useSessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(supabaseConfigError)

  const fetchSessions = useCallback(async () => {
    if (supabaseConfigError) { setLoading(false); return }

    let all = []
    let from = 0

    while (true) {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('session_id, category, updated_at, conversation')
        .order('updated_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)

      if (error) {
        setError('No se pudieron cargar los chats: ' + error.message)
        setLoading(false)
        return
      }

      all = all.concat(data)
      if (data.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }

    setError(null)
    setSessions(all)
    setLoading(false)
  }, [])

  // Aplica el cambio puntual que llega por realtime en vez de recargar toda la
  // tabla (que con miles de chats y sus conversaciones completas es caro).
  const applyRealtimeChange = useCallback((payload) => {
    setSessions(prev => {
      if (payload.eventType === 'DELETE') {
        return prev.filter(s => s.session_id !== payload.old.session_id)
      }

      const row = payload.new
      const idx = prev.findIndex(s => s.session_id === row.session_id)
      const next = idx === -1 ? [...prev, row] : prev.map((s, i) => (i === idx ? row : s))

      return next.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    })
  }, [])

  useEffect(() => {
    fetchSessions()
    if (supabaseConfigError) return

    const subscription = supabase
      .channel('public:chat_sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, applyRealtimeChange)
      .subscribe()

    return () => supabase.removeChannel(subscription)
  }, [fetchSessions, applyRealtimeChange])

  return { sessions, loading, error, refetch: fetchSessions }
}

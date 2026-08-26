import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase, supabaseConfigError } from './supabaseClient'
import { formatSpainTime, getDateLabel, isDifferentDay } from './time'
import { cleanPreview, highlight, AGENT_MARKER, AGENT_CLOSE_MARKER } from './format'
import StatsBar from './StatsBar'
import { isUnread, markSeen } from './unread'

// Color estable por categoría (aparte de la urgente, que siempre es roja).
// Mismo nombre de categoría -> mismo tono siempre, calculado por hash simple.
function categoryColor(cat) {
  let hash = 0
  for (let i = 0; i < cat.length; i++) hash = cat.charCodeAt(i) + ((hash << 5) - hash)
  const hue = Math.abs(hash) % 360
  return {
    background: `hsla(${hue}, 65%, 55%, 0.18)`,
    color: `hsl(${hue}, 70%, 72%)`,
    borderColor: `hsla(${hue}, 65%, 55%, 0.4)`
  }
}

// Tamaño de cada bloque al paginar. Supabase/PostgREST limita cada
// respuesta a 1000 filas, así que traemos la tabla completa en páginas
// en vez de un límite fijo (que dejaba fuera sesiones antiguas sin avisar).
const PAGE_SIZE = 1000

export default function ChatList({ onSelect, selectedId, onSignOut }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(supabaseConfigError)

  // --- FILTROS ---
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)

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

  // Categorías únicas para el selector
  const uniqueCategories = useMemo(() => {
    const cats = sessions.map(s => s.category).filter(Boolean)
    return [...new Set(cats)]
  }, [sessions])

  // --- FILTRADO ---
  const filteredSessions = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return sessions.filter(session => {
      const matchCategory = categoryFilter === 'ALL' || session.category === categoryFilter

      const sessionDate = session.updated_at ? session.updated_at.split('T')[0] : ''
      const matchDate = !dateFilter || sessionDate === dateFilter

      const matchSearch = !searchTerm ||
        session.session_id.toLowerCase().includes(term) ||
        session.conversation?.some(msg => msg.content && msg.content.toLowerCase().includes(term))

      const matchUnread = !unreadOnly || (session.session_id !== selectedId && isUnread(session))

      return matchCategory && matchDate && matchSearch && matchUnread
    })
  }, [sessions, categoryFilter, dateFilter, searchTerm, unreadOnly, selectedId])

  // Helpers visuales
  const getMessageCount = (conversation) => Array.isArray(conversation) ? conversation.length : 0
  const getLastContent = (conversation) =>
    Array.isArray(conversation) && conversation.length > 0
      ? conversation[conversation.length - 1]?.content
      : ''
  const isUrgentCat = (cat) => cat?.toUpperCase().includes('HUMANA')

  // Para una derivación, mira el último marcador (de agente o de cierre) en
  // la conversación para saber si sigue abierta o ya se resolvió. Devuelve
  // null si la sesión no es una derivación.
  const getHandoffState = (session) => {
    if (!isUrgentCat(session.category)) return null
    const conv = session.conversation
    if (!Array.isArray(conv)) return 'abierta'
    for (let i = conv.length - 1; i >= 0; i--) {
      const content = conv[i]?.content
      if (typeof content !== 'string') continue
      if (content.startsWith(AGENT_CLOSE_MARKER)) return 'resuelta'
      if (content.startsWith(AGENT_MARKER)) return 'abierta'
    }
    return 'abierta'
  }

  const getBadgeClass = (session) => {
    const handoff = getHandoffState(session)
    if (handoff === 'resuelta') return 'badge resolved'
    if (handoff === 'abierta') return 'badge urgent'
    return isUrgentCat(session.category) ? 'badge urgent' : 'badge general'
  }

  const getBadgeLabel = (session) => {
    const handoff = getHandoffState(session)
    if (handoff === 'resuelta') return '✅ Resuelta'
    if (handoff === 'abierta') return '🔴 Derivación'
    return session.category || 'Sin etiqueta'
  }

  const getBadgeStyle = (session) => {
    if (getHandoffState(session)) return undefined
    return (session.category && !isUrgentCat(session.category)) ? categoryColor(session.category) : undefined
  }

  const clearFilters = () => { setSearchTerm(''); setDateFilter(''); setCategoryFilter('ALL'); setUnreadOnly(false) }

  // Fecha de hoy en formato YYYY-MM-DD (huso horario local), igual que el <input type="date">
  const todayStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const toggleToday = () => setDateFilter(dateFilter === todayStr ? '' : todayStr)
  const toggleDerivacion = () => setCategoryFilter(categoryFilter === 'DERIVACION_HUMANA' ? 'ALL' : 'DERIVACION_HUMANA')
  const toggleUnread = () => setUnreadOnly(u => !u)

  const hasActiveFilters = searchTerm || dateFilter || categoryFilter !== 'ALL' || unreadOnly

  const openSession = (s) => {
    markSeen(s)
    onSelect(s.session_id)
  }

  return (
    <div className="chat-list">

      {/* --- HEADER CON CONTROLES --- */}
      <div className="sidebar-header">
        <div className="sidebar-title-row">
          <h3 className="sidebar-title">
            Bandeja de entrada
            {hasActiveFilters && !loading && (
              <span className="results-count"> · {filteredSessions.length} de {sessions.length}</span>
            )}
          </h3>
          {onSignOut && (
            <button type="button" className="sign-out-btn" onClick={onSignOut} title="Cerrar sesión">
              ⏻
            </button>
          )}
        </div>

        <StatsBar sessions={sessions} />

        <div className="quick-filters">
          <button
            type="button"
            className={`quick-filter-chip ${dateFilter === todayStr ? 'active' : ''}`}
            onClick={toggleToday}
          >
            Hoy
          </button>
          <button
            type="button"
            className={`quick-filter-chip urgent ${categoryFilter === 'DERIVACION_HUMANA' ? 'active' : ''}`}
            onClick={toggleDerivacion}
          >
            🔴 Derivación
          </button>
          <button
            type="button"
            className={`quick-filter-chip ${unreadOnly ? 'active' : ''}`}
            onClick={toggleUnread}
          >
            🟢 No leídos
          </button>
        </div>

        <div className="sidebar-controls">
          <input
            type="text"
            placeholder="🔍 Buscar en chats..."
            className="sidebar-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <input
            type="date"
            className="sidebar-input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />

          <select
            className="sidebar-input"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">Todas las etiquetas</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'DERIVACION_HUMANA' ? '🔴 Derivación Humana' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* --- ESTADOS: ERROR / CARGA / VACÍO --- */}
      {error && (
        <div className="list-state list-error">
          <p>⚠️ {error}</p>
          {!supabaseConfigError && (
            <button className="link-btn" onClick={fetchSessions}>Reintentar</button>
          )}
        </div>
      )}

      {!error && loading && (
        <div className="list-state">
          <div className="spinner" />
          <p>Cargando chats…</p>
        </div>
      )}

      {/* --- LISTA DE RESULTADOS --- */}
      {!error && !loading && filteredSessions.map((s, i) => {
        const unread = selectedId !== s.session_id && isUnread(s)
        const showDateSeparator = isDifferentDay(s.updated_at, filteredSessions[i - 1]?.updated_at)
        const dateLabel = showDateSeparator ? getDateLabel(s.updated_at) : null

        return (
          <div key={s.session_id}>
            {showDateSeparator && dateLabel && (
              <div className="list-date-separator"><span>{dateLabel}</span></div>
            )}
            <div
              className={`chat-item ${selectedId === s.session_id ? 'active' : ''} ${unread ? 'unread' : ''}`}
              onClick={() => openSession(s)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSession(s) } }}
            >
              {unread && <span className="unread-dot" aria-label="No leído" />}
              <div className="chat-id">{highlight(s.session_id, searchTerm)}</div>
              <div className="chat-preview">{highlight(cleanPreview(getLastContent(s.conversation)), searchTerm)}</div>
              <div className="chat-meta">
                <span className={getBadgeClass(s)} style={getBadgeStyle(s)}>
                  {getBadgeLabel(s)}
                </span>
                <span className="meta-right">
                  <span className="msg-count">{getMessageCount(s.conversation)} msg</span>
                  <span>{formatSpainTime(s.updated_at)}</span>
                </span>
              </div>
            </div>
          </div>
        )
      })}

      {!error && !loading && filteredSessions.length === 0 && (
        <div className="list-state empty-state">
          <p>No se encontraron chats.</p>
          <button className="link-btn" onClick={clearFilters}>Limpiar filtros</button>
        </div>
      )}
    </div>
  )
}

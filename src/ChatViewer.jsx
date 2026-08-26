import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './supabaseClient'
import { splitSystemContext, renderRichText } from './format'
import { getDateLabel, isDifferentDay } from './time'

// A partir de este nº de caracteres, el mensaje se colapsa con un "Ver más".
const COLLAPSE_THRESHOLD = 500

export default function ChatViewer({ sessionId, onBack, className }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(() => new Set())
  const [showJumpToBottom, setShowJumpToBottom] = useState(false)
  const bottomRef = useRef(null)
  const containerRef = useRef(null)

  // silent=true se usa para los refrescos por realtime: no queremos que la
  // conversación parpadee con el spinner cada vez que llega un mensaje nuevo.
  const fetchConversation = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('conversation')
      .eq('session_id', sessionId)
      .single()

    if (error) {
      setError('No se pudo cargar la conversación: ' + error.message)
      if (!silent) setMessages([])
    } else {
      setError(null)
      setMessages(data?.conversation || [])
    }
    if (!silent) setLoading(false)
  }, [sessionId])

  useEffect(() => {
    if (sessionId) fetchConversation()
    setExpanded(new Set())
    setShowJumpToBottom(false)
  }, [sessionId, fetchConversation])

  // Live-update: si llega un mensaje nuevo a la conversación abierta (p.ej. el
  // cliente sigue escribiendo tras una derivación humana), se refresca sola.
  useEffect(() => {
    if (!sessionId) return

    const channel = supabase
      .channel(`chat_session_${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_sessions', filter: `session_id=eq.${sessionId}` },
        () => fetchConversation({ silent: true })
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [sessionId, fetchConversation])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const formatTime = (isoString) => {
    if (!isoString) return null
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const toggleExpanded = (i) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowJumpToBottom(distanceFromBottom > 200)
  }

  const scrollToBottom = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })

  const copySessionId = () => {
    navigator.clipboard.writeText(sessionId)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {
        // Permisos de portapapeles bloqueados o navegador sin soporte: no rompemos la UI.
      })
  }

  if (!sessionId) {
    return (
      <div className={`chat-viewer ${className || ''}`} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="empty">Selecciona un chat para comenzar</div>
      </div>
    )
  }

  return (
    <div className={`chat-viewer ${className || ''}`}>
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={onBack} className="back-button" aria-label="Volver">←</button>
          <h2 style={{ fontFamily: 'monospace', fontSize: '13px', color: '#64748b' }}>
            ID: {sessionId}
          </h2>
          <button onClick={copySessionId} className="copy-id-btn" aria-label="Copiar ID de sesión" title="Copiar ID">
            {copied ? '✓' : '⧉'}
          </button>
        </div>
        {!loading && !error && (
          <span className="header-count">{messages.length} mensajes</span>
        )}
      </div>

      <div className="messages-container" ref={containerRef} onScroll={handleScroll}>
        {loading && (
          <div className="viewer-state">
            <div className="spinner" />
            <p>Cargando conversación…</p>
          </div>
        )}

        {error && (
          <div className="viewer-state viewer-error">
            <p>⚠️ {error}</p>
            <button className="link-btn" onClick={fetchConversation}>Reintentar</button>
          </div>
        )}

        {!loading && !error && messages.map((msg, i) => {
          const showDateSeparator = isDifferentDay(msg.timestamp, messages[i - 1]?.timestamp)
          const dateLabel = showDateSeparator ? getDateLabel(msg.timestamp) : null
          const { text, products } = splitSystemContext(msg.content)
          const isLong = text.length > COLLAPSE_THRESHOLD
          const isExpanded = expanded.has(i)

          return (
            <div key={i} style={{ width: '100%' }}>

              {showDateSeparator && dateLabel && (
                <div className="date-separator">
                  <span>{dateLabel}</span>
                </div>
              )}

              <div className={`message ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                <div className="bubble">
                  <div className={`message-text ${isLong && !isExpanded ? 'clamped' : ''}`}>
                    {renderRichText(msg.content)}
                  </div>

                  {isLong && (
                    <button className="expand-toggle" onClick={() => toggleExpanded(i)}>
                      {isExpanded ? 'Ver menos' : 'Ver más'}
                    </button>
                  )}

                  {/* Productos mostrados por el bot (extraídos del contexto de sistema) */}
                  {products.length > 0 && (
                    <div className="product-chips">
                      {products.map((p, idx) => (
                        <span key={idx} className="product-chip">🏷️ {p}</span>
                      ))}
                    </div>
                  )}

                  {msg.timestamp && (
                    <div className="message-time">
                      {formatTime(msg.timestamp)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {!loading && !error && messages.length === 0 && (
          <div className="viewer-state">
            <p className="empty">Esta conversación no tiene mensajes.</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {showJumpToBottom && (
        <button className="jump-to-bottom" onClick={scrollToBottom} aria-label="Ir al último mensaje">
          ↓
        </button>
      )}
    </div>
  )
}

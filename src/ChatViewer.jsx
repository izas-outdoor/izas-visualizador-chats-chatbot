import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from './supabaseClient'
import { splitSystemContext, renderRichText, AGENT_MARKER, AGENT_CLOSE_MARKER } from './format'
import { getDateLabel, isDifferentDay } from './time'

// A partir de este nº de caracteres, el mensaje se colapsa con un "Ver más".
const COLLAPSE_THRESHOLD = 500

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://izas-chatbot-backend.onrender.com'

export default function ChatViewer({ sessionId, onBack, className }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(() => new Set())
  const [showJumpToBottom, setShowJumpToBottom] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(null)
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
    setReplyText('')
    setSendError(null)
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

  // Compartida por "responder" y "devolver al bot": ambas llaman a un
  // endpoint del backend con el token de la sesión de agente logueada.
  const callAgentEndpoint = async (path, body) => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Sesión caducada, vuelve a entrar.')

    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const responseBody = await res.json().catch(() => ({}))
      throw new Error(responseBody.error || `Error ${res.status}`)
    }
  }

  const sendReply = async (e) => {
    e.preventDefault()
    const content = replyText.trim()
    if (!content || sending) return

    setSending(true)
    setSendError(null)

    try {
      await callAgentEndpoint('/api/chat/agent-reply', { session_id: sessionId, content })
      setReplyText('')
      // El mensaje llega solo vía realtime (suscripción de arriba), pero
      // refrescamos también por si acaso el evento tardase o se perdiera.
      fetchConversation({ silent: true })
    } catch (err) {
      setSendError(err.message || 'No se pudo enviar la respuesta.')
    } finally {
      setSending(false)
    }
  }

  // Detecta, a partir del último mensaje marcado (de agente o de cierre), si
  // esta conversación sigue derivada a un agente ahora mismo.
  const isHandedOff = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const content = messages[i]?.content
      if (typeof content !== 'string') continue
      if (content.startsWith(AGENT_CLOSE_MARKER)) return false
      if (content.startsWith(AGENT_MARKER)) return true
    }
    return false
  }, [messages])

  const closeAgentSession = async () => {
    if (sending) return
    setSending(true)
    setSendError(null)
    try {
      await callAgentEndpoint('/api/chat/agent-close', { session_id: sessionId })
      fetchConversation({ silent: true })
    } catch (err) {
      setSendError(err.message || 'No se pudo devolver la conversación al bot.')
    } finally {
      setSending(false)
    }
  }

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
          const { text, products, isAgent, isAgentClose } = splitSystemContext(msg.content)
          const isLong = text.length > COLLAPSE_THRESHOLD
          const isExpanded = expanded.has(i)

          if (isAgentClose) {
            return (
              <div key={i} style={{ width: '100%' }}>
                {showDateSeparator && dateLabel && (
                  <div className="date-separator">
                    <span>{dateLabel}</span>
                  </div>
                )}
                <div className="handoff-close-note">🔓 {text}</div>
              </div>
            )
          }

          return (
            <div key={i} style={{ width: '100%' }}>

              {showDateSeparator && dateLabel && (
                <div className="date-separator">
                  <span>{dateLabel}</span>
                </div>
              )}

              <div className={`message ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                <div className={`bubble ${isAgent ? 'agent-bubble' : ''}`}>
                  {isAgent && <div className="agent-label">Agente</div>}
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

      <form className="reply-box" onSubmit={sendReply}>
        {sendError && <p className="reply-error">⚠️ {sendError}</p>}
        {isHandedOff && (
          <button
            type="button"
            className="close-handoff-btn"
            onClick={closeAgentSession}
            disabled={sending}
          >
            🔓 Devolver conversación al bot
          </button>
        )}
        <div className="reply-row">
          <textarea
            className="reply-input"
            placeholder="Responder como agente…"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendReply(e)
              }
            }}
            rows={1}
          />
          <button type="submit" className="reply-send-btn" disabled={sending || !replyText.trim()}>
            {sending ? '…' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  )
}

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './supabaseClient'
import { splitSystemContext, renderRichText } from './format'

export default function ChatViewer({ sessionId, onBack, className }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)

  const fetchConversation = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('conversation')
      .eq('session_id', sessionId)
      .single()

    if (error) {
      setError('No se pudo cargar la conversación: ' + error.message)
      setMessages([])
    } else {
      setMessages(data?.conversation || [])
    }
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    if (sessionId) fetchConversation()
  }, [sessionId, fetchConversation])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const formatTime = (isoString) => {
    if (!isoString) return null
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const getDateLabel = (isoString) => {
    if (!isoString) return null
    const date = new Date(isoString)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Hoy'
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer'
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const isDifferentDay = (currentIso, prevIso) => {
    if (!currentIso) return false
    if (!prevIso) return true
    return new Date(currentIso).toDateString() !== new Date(prevIso).toDateString()
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
        </div>
        {!loading && !error && (
          <span className="header-count">{messages.length} mensajes</span>
        )}
      </div>

      <div className="messages-container">
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
          const { products } = splitSystemContext(msg.content)

          return (
            <div key={i} style={{ width: '100%' }}>

              {showDateSeparator && dateLabel && (
                <div className="date-separator">
                  <span>{dateLabel}</span>
                </div>
              )}

              <div className={`message ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                <div className="bubble">
                  <div className="message-text">
                    {renderRichText(msg.content)}
                  </div>

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
    </div>
  )
}

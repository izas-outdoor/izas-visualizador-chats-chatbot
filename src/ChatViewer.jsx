import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './supabaseClient'

export default function ChatViewer({ sessionId, onBack, className }) {
  const [messages, setMessages] = useState([])
  const bottomRef = useRef(null)

  const fetchConversation = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('conversation') 
      .eq('session_id', sessionId)
      .single()

    if (!error && data) {
      setMessages(data.conversation || [])
    }
  }, [sessionId])

  useEffect(() => {
    if (sessionId) fetchConversation()
  }, [sessionId, fetchConversation])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // --- HELPER 1: Formatear Hora (14:30) ---
  const formatTime = (isoString) => {
    if (!isoString) return null;
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // --- HELPER 2: Calcular etiqueta del día (Hoy, Ayer, Fecha) ---
  const getDateLabel = (isoString) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    // Comprobamos si es HOY
    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    }
    // Comprobamos si es AYER
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    }
    // Si no, devolvemos la fecha completa (ej: 10/02/2026)
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  // --- HELPER 3: ¿Son días diferentes? ---
  const isDifferentDay = (currentIso, prevIso) => {
    if (!currentIso) return false; // Si no tiene fecha, no ponemos separador
    if (!prevIso) return true; // Si es el primero y tiene fecha, sí ponemos

    const currentDate = new Date(currentIso).toDateString();
    const prevDate = new Date(prevIso).toDateString();
    return currentDate !== prevDate;
  }

  const renderMessageContent = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{textDecoration: 'underline'}}>{part}</a>;
      }
      return part;
    });
  };

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
          <button onClick={onBack} className="back-button">←</button>
          <h2 style={{ fontFamily: 'monospace', fontSize: '13px', color: '#64748b' }}>
            ID: {sessionId}
          </h2>
        </div>
      </div>

      <div className="messages-container">
        {messages.map((msg, i) => {
          // LÓGICA DEL SEPARADOR DE FECHA
          const showDateSeparator = isDifferentDay(msg.timestamp, messages[i - 1]?.timestamp);
          const dateLabel = showDateSeparator ? getDateLabel(msg.timestamp) : null;

          return (
            <div key={i} style={{ width: '100%' }}>
              
              {/* --- AQUÍ VA EL SEPARADOR DE DÍA --- */}
              {showDateSeparator && dateLabel && (
                <div className="date-separator">
                  <span>{dateLabel}</span>
                </div>
              )}

              <div className={`message ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                <div className="bubble">
                  <div className="message-text">
                    {renderMessageContent(msg.content)}
                  </div>
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
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

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

  // --- FUNCIÓN PARA FORMATEAR LA HORA ---
  const formatTime = (isoString) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    // Esto convierte la hora UTC a la hora local del navegador (España)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Detectar enlaces
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
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`message ${msg.role === 'user' ? 'user' : 'assistant'}`}
          >
            <div className="bubble">
              {/* Contenido del mensaje */}
              <div className="message-text">
                {renderMessageContent(msg.content)}
              </div>
              
              {/* --- HORA DEL MENSAJE (Si existe) --- */}
              {msg.timestamp && (
                <div className="message-time">
                  {formatTime(msg.timestamp)}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './supabaseClient'

// Aceptamos 'className' para controlar la apertura en móvil desde el padre
export default function ChatViewer({ sessionId, onBack, className }) {
  const [messages, setMessages] = useState([])
  const bottomRef = useRef(null)

  const fetchConversation = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('conversation, category, session_id') 
      .eq('session_id', sessionId)
      .single()

    if (!error && data) {
      setMessages(data.conversation || [])
    }
  }, [sessionId])

  useEffect(() => {
    if (sessionId) {
      fetchConversation()
    }
  }, [sessionId, fetchConversation])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Helper para convertir texto plano con URLs en enlaces clicables
  const renderMessageContent = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, i) => {
      if (part.match(urlRegex)) {
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer">{part}</a>;
      }
      return part;
    });
  };

  if (!sessionId) {
    // En móvil, si no hay sesión, este componente está oculto por CSS, 
    // así que no importa mucho lo que renderice, pero en escritorio se ve el mensaje.
    return (
      <div className={`chat-viewer ${className || ''}`} style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="empty">Selecciona un chat para comenzar</div>
      </div>
    )
  }

  return (
    // Aplicamos la clase que viene desde App.jsx (mobile-open)
    <div className={`chat-viewer ${className || ''}`}>
      
      {/* Sticky Header */}
      <div className="chat-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          
          {/* BOTÓN ATRÁS (Solo visible en móvil por CSS) */}
          <button onClick={onBack} className="back-button">
            ←
          </button>

          <h2 style={{ fontFamily: 'monospace', fontSize: '13px', color: '#64748b' }}>
            ID: {sessionId}
          </h2>
        </div>
        
        {/* Aquí podrías poner botones de acción extra si quisieras */}
        <div></div> 
      </div>

      <div className="messages-container">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`message ${msg.role === 'user' ? 'user' : 'assistant'}`}
          >
            <div className="bubble">
              {renderMessageContent(msg.content)}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
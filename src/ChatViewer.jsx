import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from './supabaseClient'

export default function ChatViewer({ sessionId }) {
  const [messages, setMessages] = useState([])
  const [currentSession, setCurrentSession] = useState(null) // Para mostrar datos en el header
  const bottomRef = useRef(null)

  const fetchConversation = useCallback(async () => {
    // Traemos también la categoría para mostrarla en el header
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('conversation, category, session_id') 
      .eq('session_id', sessionId)
      .single()

    if (!error && data) {
      setMessages(data.conversation || [])
      setCurrentSession(data)
    }
  }, [sessionId])

  useEffect(() => {
    if (sessionId) {
      fetchConversation()
    }
  }, [sessionId, fetchConversation])

  // Scroll automático al cambiar los mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!sessionId) {
    return (
      <div className="chat-viewer" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="empty">Selecciona un chat para comenzar</div>
      </div>
    )
  }

  return (
    <div className="chat-viewer">
      {/* NUEVO: Sticky Header */}
      <div className="chat-header">
        <div>
           {/* Usamos monospace aquí también para consistencia */}
          <h2 style={{ fontFamily: 'monospace', fontSize: '13px', color: '#1a4f36' }}>
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
              {msg.content}
            </div>
          </div>
        ))}
        {/* CORRECCIÓN: El ref va en un div vacío AL FINAL de la lista, no en cada mensaje */}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
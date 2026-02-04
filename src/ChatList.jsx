import { useEffect, useState, useMemo } from 'react'
import { supabase } from './supabaseClient'
import { formatSpainTime } from './time'

export default function ChatList({ onSelect, selectedId }) {
  const [sessions, setSessions] = useState([])
  
  // --- NUEVOS ESTADOS PARA LOS FILTROS ---
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  async function fetchSessions() {
    // Traemos todo y filtramos en cliente (React) para que la búsqueda sea rápida
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('session_id, category, updated_at, conversation')
      .order('updated_at', { ascending: false })

    if (!error) setSessions(data)
  }

  useEffect(() => {
    fetchSessions()
    const subscription = supabase
      .channel('public:chat_sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, fetchSessions)
      .subscribe()

    return () => supabase.removeChannel(subscription)
  }, [])

  // Obtener categorías únicas dinámicamente
  const uniqueCategories = useMemo(() => {
    const cats = sessions.map(s => s.category).filter(Boolean);
    return [...new Set(cats)];
  }, [sessions]);

  // --- LÓGICA DE FILTRADO MAESTRA ---
  const filteredSessions = sessions.filter(session => {
    // 1. Filtro por CATEGORÍA
    const matchCategory = categoryFilter === 'ALL' || session.category === categoryFilter;

    // 2. Filtro por FECHA
    // session.updated_at viene como "2026-02-03T15:43..." -> cortamos en la 'T' para tener YYYY-MM-DD
    const sessionDate = session.updated_at ? session.updated_at.split('T')[0] : '';
    const matchDate = !dateFilter || sessionDate === dateFilter;

    // 3. Filtro por TEXTO (Buscador)
    const term = searchTerm.toLowerCase();
    const matchSearch = !searchTerm || 
      session.session_id.includes(term) || // Busca en el ID
      // Busca dentro del contenido de los mensajes
      session.conversation?.some(msg => 
        msg.content && msg.content.toLowerCase().includes(term)
      );

    // DEBEN CUMPLIRSE TODAS LAS CONDICIONES (AND)
    return matchCategory && matchDate && matchSearch;
  });

  // Helpers visuales...
  const getLastMessagePreview = (conversation) => {
    if (!Array.isArray(conversation) || conversation.length === 0) return 'Sin mensajes...';
    const lastMsg = conversation[conversation.length - 1];
    const text = lastMsg?.content || '';
    return String(text).substring(0, 45) + (String(text).length > 45 ? '...' : '');
  }

  const getBadgeClass = (cat) => cat?.toUpperCase().includes('HUMANA') ? 'badge urgent' : 'badge general';
  
  const getBadgeLabel = (cat) => cat === 'DERIVACION_HUMANA' ? '🔴 Derivación' : (cat || 'Sin etiqueta');

  return (
    <div className="chat-list">
      
      {/* --- HEADER CON CONTROLES --- */}
      <div className="sidebar-header">
        <h3 className="sidebar-title">Bandeja de entrada</h3>
        
        <div className="sidebar-controls">
          {/* 1. BUSCADOR */}
          <input 
            type="text" 
            placeholder="🔍 Buscar en chats..." 
            className="sidebar-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {/* 2. FECHA */}
          <input 
            type="date" 
            className="sidebar-input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />

          {/* 3. CATEGORÍA (Select) */}
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

      {/* --- LISTA DE RESULTADOS --- */}
      {filteredSessions.map(s => (
        <div
          key={s.session_id}
          className={`chat-item ${selectedId === s.session_id ? 'active' : ''}`}
          onClick={() => onSelect(s.session_id)}
        >
          <div className="chat-id">{s.session_id}</div>
          <div className="chat-preview">{getLastMessagePreview(s.conversation)}</div>
          <div className="chat-meta">
            <span className={getBadgeClass(s.category)}>{getBadgeLabel(s.category)}</span>
            <span>{formatSpainTime(s.updated_at)}</span>
          </div>
        </div>
      ))}

      {filteredSessions.length === 0 && (
        <div style={{padding: '40px 20px', color: '#8edfae', textAlign: 'center', opacity: 0.7, fontSize: '13px'}}>
          <p>No se encontraron chats.</p>
          <button 
            onClick={() => {setSearchTerm(''); setDateFilter(''); setCategoryFilter('ALL')}}
            style={{background: 'none', border: 'none', color: 'white', textDecoration: 'underline', cursor: 'pointer'}}
          >
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  )
}
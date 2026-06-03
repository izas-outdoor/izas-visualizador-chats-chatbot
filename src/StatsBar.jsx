import { useMemo } from 'react'

/* Pequeño panel de estadísticas para la cabecera de la lista.
   Recibe todas las sesiones (sin filtrar) y calcula totales de un vistazo. */
export default function StatsBar({ sessions }) {
  const stats = useMemo(() => {
    const total = sessions.length
    let derivaciones = 0
    let hoy = 0
    const byCategory = {}

    const todayStr = new Date().toDateString()

    for (const s of sessions) {
      const cat = s.category || 'SIN_ETIQUETA'
      byCategory[cat] = (byCategory[cat] || 0) + 1

      if (typeof cat === 'string' && cat.toUpperCase().includes('HUMANA')) derivaciones++

      if (s.updated_at && new Date(s.updated_at).toDateString() === todayStr) hoy++
    }

    return { total, derivaciones, hoy }
  }, [sessions])

  return (
    <div className="stats-bar">
      <div className="stat">
        <span className="stat-num">{stats.total}</span>
        <span className="stat-label">Chats</span>
      </div>
      <div className="stat">
        <span className="stat-num">{stats.hoy}</span>
        <span className="stat-label">Hoy</span>
      </div>
      <div className={`stat ${stats.derivaciones > 0 ? 'stat-alert' : ''}`}>
        <span className="stat-num">{stats.derivaciones}</span>
        <span className="stat-label">Derivaciones</span>
      </div>
    </div>
  )
}

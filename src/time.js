export function formatSpainTime(timestamp) {
  return new Date(timestamp).toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// "Hoy" / "Ayer" / fecha completa, para separadores de fecha en listas de mensajes o chats.
export function getDateLabel(isoString) {
  if (!isoString) return null
  const date = new Date(isoString)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Hoy'
  if (date.toDateString() === yesterday.toDateString()) return 'Ayer'
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function isDifferentDay(currentIso, prevIso) {
  if (!currentIso) return false
  if (!prevIso) return true
  return new Date(currentIso).toDateString() !== new Date(prevIso).toDateString()
}

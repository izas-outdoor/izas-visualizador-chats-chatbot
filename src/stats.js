// Agregados para la pestaña de Estadísticas. Todo se calcula en cliente a
// partir de las sesiones ya cargadas (mismo dataset que la bandeja).

export const FEEDBACK_YES = 'Sí, gracias'
export const FEEDBACK_NO = 'No, necesito más ayuda'

const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAY_LABELS = { Mon: 'Lunes', Tue: 'Martes', Wed: 'Miércoles', Thu: 'Jueves', Fri: 'Viernes', Sat: 'Sábado', Sun: 'Domingo' }
const WEEKDAY_SHORT = { Mon: 'Lun', Tue: 'Mar', Wed: 'Mié', Thu: 'Jue', Fri: 'Vie', Sat: 'Sáb', Sun: 'Dom' }

const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_LABELS = { Jan: 'Enero', Feb: 'Febrero', Mar: 'Marzo', Apr: 'Abril', May: 'Mayo', Jun: 'Junio', Jul: 'Julio', Aug: 'Agosto', Sep: 'Septiembre', Oct: 'Octubre', Nov: 'Noviembre', Dec: 'Diciembre' }
const MONTH_SHORT = { Jan: 'Ene', Feb: 'Feb', Mar: 'Mar', Apr: 'Abr', May: 'May', Jun: 'Jun', Jul: 'Jul', Aug: 'Ago', Sep: 'Sep', Oct: 'Oct', Nov: 'Nov', Dec: 'Dic' }

// Reutilizamos un único formateador (cachea internamente) en vez de crear uno
// por mensaje al recorrer miles de conversaciones.
const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Madrid',
  weekday: 'short',
  month: 'short',
  hour: '2-digit',
  hour12: false
})

// Devuelve { weekday: 'Mon', month: 'Aug', hour: 0-23 } en hora de Madrid.
// Intl con hour12:false a veces da "24" para la medianoche en vez de "00"
// (comportamiento conocido de la ICU embebida en algunos motores JS).
function madridParts(date) {
  const map = {}
  for (const p of partsFormatter.formatToParts(date)) map[p.type] = p.value
  let hour = parseInt(map.hour, 10)
  if (hour === 24) hour = 0
  return { weekday: map.weekday, month: map.month, hour }
}

// Recorre una vez todas las conversaciones y saca todos los agregados a la
// vez (evita recorrer miles de mensajes por separado para cada gráfica).
export function computeStats(sessions) {
  const byCategory = {}
  let derivaciones = 0
  let feedbackYes = 0
  let feedbackNo = 0
  const byWeekday = Object.fromEntries(WEEKDAY_ORDER.map(k => [k, 0]))
  const byHour = Object.fromEntries(Array.from({ length: 24 }, (_, h) => [h, 0]))
  const byMonth = Object.fromEntries(MONTH_ORDER.map(k => [k, 0]))

  let totalUserMessages = 0
  let totalMessages = 0

  for (const session of sessions) {
    const cat = session.category || 'SIN_ETIQUETA'
    byCategory[cat] = (byCategory[cat] || 0) + 1
    if (cat.toUpperCase().includes('HUMANA')) derivaciones++

    const conversation = Array.isArray(session.conversation) ? session.conversation : []
    for (const msg of conversation) {
      totalMessages++
      if (msg.role !== 'user') continue
      totalUserMessages++

      if (msg.content === FEEDBACK_YES) feedbackYes++
      else if (msg.content === FEEDBACK_NO) feedbackNo++

      if (!msg.timestamp) continue
      const date = new Date(msg.timestamp)
      if (Number.isNaN(date.getTime())) continue

      const { weekday, month, hour } = madridParts(date)
      if (weekday in byWeekday) byWeekday[weekday]++
      if (month in byMonth) byMonth[month]++
      byHour[hour]++
    }
  }

  // --- Etiquetas: ranking descendente, top 8 + resto plegado en "Otras" ---
  const categoryEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  const TOP_N = 8
  const topCategories = categoryEntries.slice(0, TOP_N).map(([name, count]) => ({ name, count }))
  const restCount = categoryEntries.slice(TOP_N).reduce((sum, [, count]) => sum + count, 0)
  if (restCount > 0) topCategories.push({ name: 'Otras', count: restCount })

  return {
    totalSessions: sessions.length,
    totalMessages,
    totalUserMessages,
    derivaciones,
    categories: topCategories,
    feedback: { yes: feedbackYes, no: feedbackNo },
    byWeekday: WEEKDAY_ORDER.map(k => ({ key: k, label: WEEKDAY_LABELS[k], short: WEEKDAY_SHORT[k], count: byWeekday[k] })),
    byHour: Object.entries(byHour).map(([h, count]) => ({ hour: Number(h), label: `${String(h).padStart(2, '0')}:00`, count })),
    byMonth: MONTH_ORDER.map(k => ({ key: k, label: MONTH_LABELS[k], short: MONTH_SHORT[k], count: byMonth[k] }))
  }
}

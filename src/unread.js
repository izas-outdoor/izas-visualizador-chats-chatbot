// Marca chats como "no leídos" comparando la última actualización de la
// sesión con la última vez que el propio navegador la abrió (guardado en
// localStorage). Es solo del lado del cliente: cada agente ve su propio
// estado de lectura, no se sincroniza entre dispositivos ni con Supabase.

const SEEN_KEY = 'izas_chat_seen_v1'
const FIRST_RUN_KEY = 'izas_chat_first_run_v1'

function readSeenMap() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY)) || {}
  } catch {
    return {}
  }
}

// La primera vez que se usa esta función en el navegador, fijamos un punto
// de partida. Así, al estrenar la función, no se marcan como "no leídos"
// de golpe los cientos de chats ya existentes: solo cuenta lo que llegue
// a partir de ahora (o lo que llegue a un chat concreto tras abrirlo).
function getBaseline() {
  let ts = localStorage.getItem(FIRST_RUN_KEY)
  if (!ts) {
    ts = new Date().toISOString()
    try { localStorage.setItem(FIRST_RUN_KEY, ts) } catch { /* localStorage no disponible */ }
  }
  return ts
}

export function isUnread(session) {
  if (!session.updated_at) return false
  const seenAt = readSeenMap()[session.session_id]
  const baseline = seenAt || getBaseline()
  return new Date(session.updated_at) > new Date(baseline)
}

export function markSeen(session) {
  if (!session.updated_at) return
  const seenMap = readSeenMap()
  seenMap[session.session_id] = session.updated_at
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seenMap))
  } catch { /* localStorage no disponible */ }
}

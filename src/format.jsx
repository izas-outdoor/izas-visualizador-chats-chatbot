/* ==========================================================================
   Utilidades de formateo de mensajes para el visualizador.
   - Separa el "ruido" que el backend añade a los mensajes del asistente:
       · "\n[CONTEXTO SISTEMA: Productos mostrados: ...]"  -> lista de productos
       · "[Botones Mostrados]" y similares                 -> marcas internas
       · "[AGENTE_HUMANO] "                                -> respuesta de agente
   - Renderiza el texto limpio con negritas (**), enlaces markdown [t](url)
     y URLs sueltas, de forma segura (React escapa el texto por defecto).
   ========================================================================== */

// Debe coincidir exactamente con AGENT_MARKER en chatbotWeb/backend/server.js
export const AGENT_MARKER = '[AGENTE_HUMANO] '

// Extrae los productos mostrados (si los hay) y devuelve el texto sin esa cola.
// También detecta si el mensaje lo escribió un agente humano en vez del bot.
export function splitSystemContext(rawText) {
  if (!rawText) return { text: '', products: [], isAgent: false }
  let text = String(rawText)
  let products = []

  const isAgent = text.startsWith(AGENT_MARKER)
  if (isAgent) text = text.slice(AGENT_MARKER.length)

  // [CONTEXTO SISTEMA: Productos mostrados: A, B, C]
  const ctxRegex = /\n?\[CONTEXTO SISTEMA:[^\]]*Productos mostrados:\s*([^\]]*)\]/i;
  const match = text.match(ctxRegex);
  if (match) {
    products = match[1].split(',').map(s => s.trim()).filter(Boolean);
    text = text.replace(ctxRegex, '').trim();
  }

  // Otras marcas internas que no aportan al lector.
  text = text.replace(/\s*\[Botones Mostrados\]\s*/gi, ' ').trim();

  return { text, products, isAgent };
}

// Preview corto y limpio para la lista (sin el ruido del sistema).
export function cleanPreview(rawText, maxLen = 60) {
  const { text } = splitSystemContext(rawText);
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length === 0) return 'Sin texto…';
  return flat.length > maxLen ? flat.slice(0, maxLen) + '…' : flat;
}

// Resalta <mark> el término buscado dentro de un texto plano (devuelve React nodes).
export function highlight(text, term) {
  if (!term) return text;
  const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = String(text).split(new RegExp(`(${safeTerm})`, 'ig'));
  return parts.map((part, i) =>
    part.toLowerCase() === term.toLowerCase()
      ? <mark key={i} className="hl">{part}</mark>
      : part
  );
}

// Renderiza el contenido de un mensaje como nodos React con formato básico.
// Soporta: **negrita**, [texto](url), urls sueltas y saltos de línea.
export function renderRichText(rawText) {
  const { text } = splitSystemContext(rawText);
  if (!text) return null;

  const lines = text.split('\n');
  return lines.map((line, li) => (
    <span key={li}>
      {renderInline(line)}
      {li < lines.length - 1 ? <br /> : null}
    </span>
  ));
}

// Procesa una línea: negritas, enlaces markdown y URLs sueltas.
function renderInline(line) {
  // Tokenizamos por: **bold**  |  [text](url)  |  url suelta
  const tokenRegex = /(\*\*[^*]+\*\*)|(\[[^\]]+\]\(https?:\/\/[^)\s]+\))|(https?:\/\/[^\s]+)/g;
  const nodes = [];
  let lastIndex = 0;
  let m;
  let key = 0;

  while ((m = tokenRegex.exec(line)) !== null) {
    if (m.index > lastIndex) nodes.push(line.slice(lastIndex, m.index));

    const token = m[0];
    if (m[1]) {
      // **negrita**
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (m[2]) {
      // [texto](url)
      const linkMatch = token.match(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/);
      nodes.push(
        <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer">{linkMatch[1]}</a>
      );
    } else {
      // url suelta (le quitamos puntuación final pegada)
      const clean = token.replace(/[.,;:]+$/, '');
      const trailing = token.slice(clean.length);
      nodes.push(
        <a key={key++} href={clean} target="_blank" rel="noopener noreferrer">{clean}</a>
      );
      if (trailing) nodes.push(trailing);
    }
    lastIndex = m.index + token.length;
  }
  if (lastIndex < line.length) nodes.push(line.slice(lastIndex));
  return nodes;
}

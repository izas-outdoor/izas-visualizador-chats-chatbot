import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Avisamos pronto si faltan las variables de entorno, para que el error
// sea claro en lugar de una pantalla vacía sin explicación.
export const supabaseConfigError = (!url || !anonKey)
  ? 'Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. Crea un archivo .env en la raíz del proyecto con esas variables y reinicia el servidor.'
  : null

if (supabaseConfigError) {
  console.error('[Supabase] ' + supabaseConfigError)
}

// Creamos el cliente igualmente (con valores de relleno si faltan) para no
// romper los imports; la UI mostrará el error de configuración.
export const supabase = createClient(url || 'http://localhost', anonKey || 'public-anon-key')

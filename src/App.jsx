import { useState } from 'react'
import ChatList from './ChatList'
import ChatViewer from './ChatViewer'
import './App.css' // Asegúrate de importar tu CSS

export default function App() {
  // Corregido: Usamos 'selectedId' consistentemente
  const [selectedId, setSelectedId] = useState(null)

  return (
    <div className="layout">
      <ChatList
        onSelect={(id) => setSelectedId(id)}
        selectedId={selectedId}
      />

      {/* Pasamos la clase 'mobile-open' como prop en lugar de envolverlo en un div extra.
        Esto mantiene el CSS Grid/Flexbox limpio.
      */}
      <ChatViewer
        sessionId={selectedId}
        onBack={() => setSelectedId(null)}
        className={selectedId ? 'mobile-open' : ''}
      />
    </div>
  )
}
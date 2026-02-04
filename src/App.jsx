import { useState } from 'react'
import ChatList from './ChatList'
import ChatViewer from './ChatViewer'

export default function App() {
  const [selectedSession, setSelectedSession] = useState(null)

  return (
    <div className="layout">
      <ChatList
        selectedId={selectedSession}
        onSelect={setSelectedSession}
      />
      <ChatViewer sessionId={selectedSession} />
    </div>
  )
}

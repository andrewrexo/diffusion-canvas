import { TopBar } from './ui/TopBar'
import { CanvasView } from './canvas/CanvasView'
import { SettingsDialog } from './ui/SettingsDialog'
import { Toasts } from './ui/Toasts'

export default function App() {
  return (
    <div className="app">
      <TopBar />
      <CanvasView />
      <SettingsDialog />
      <Toasts />
    </div>
  )
}

import { TopBar } from './ui/TopBar'
import { CanvasView } from './canvas/CanvasView'
import { PixelEditor } from './editor/PixelEditor'
import { SettingsDialog } from './ui/SettingsDialog'
import { Toasts } from './ui/Toasts'
import { useStore } from './store'

export default function App() {
  const editing = useStore((s) => s.editing)
  return (
    <div className="app">
      <TopBar />
      <CanvasView />
      {editing && <PixelEditor key={editing} id={editing} />}
      <SettingsDialog />
      <Toasts />
    </div>
  )
}

import { Upload } from 'lucide-react'
import { useAtomValue } from 'jotai'
import { isDraggingAtom } from '../../store/atoms/ui.atoms'
import { useStyles } from '../../hooks/useOptimizedState'

export function DragDropOverlay() {
  const isDragging = useAtomValue(isDraggingAtom)
  const styles = useStyles()

  if (!isDragging) return null

  return (
    <div className={styles.dropOverlay.className}>
      <div className="bg-surface rounded-2xl p-12 shadow-2xl flex flex-col items-center gap-4">
        <Upload className="w-16 h-16 text-primary-500" />
        <p className="text-2xl font-bold text-text-primary">Drop skin files here</p>
        <p className="text-sm text-text-secondary">Supports .wad, .zip, and .fantome files</p>
      </div>
    </div>
  )
}
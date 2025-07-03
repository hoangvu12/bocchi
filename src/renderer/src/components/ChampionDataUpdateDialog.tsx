import { RefreshCw } from 'lucide-react'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'

interface ChampionDataUpdateDialogProps {
  isOpen: boolean
  onUpdate: () => void
  onSkip: () => void
  currentVersion?: string
  isUpdating?: boolean
}

export function ChampionDataUpdateDialog({
  isOpen,
  onUpdate,
  onSkip,
  currentVersion,
  isUpdating = false
}: ChampionDataUpdateDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={() => !isUpdating && onSkip()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <DialogTitle>Champion Data Update Available</DialogTitle>
          </div>
        </DialogHeader>
        <DialogDescription>
          A new version of champion data is available. This update includes the latest champions,
          skins, and other game content.
          {currentVersion && (
            <span className="block mt-2 text-xs">Current version: {currentVersion}</span>
          )}
        </DialogDescription>
        <DialogFooter>
          <Button variant="secondary" onClick={onSkip} disabled={isUpdating}>
            Skip for now
          </Button>
          <Button
            onClick={onUpdate}
            disabled={isUpdating}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Now'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

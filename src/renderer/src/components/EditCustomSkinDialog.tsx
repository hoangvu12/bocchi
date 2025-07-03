import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'

interface EditCustomSkinDialogProps {
  isOpen: boolean
  currentName: string
  onClose: () => void
  onSave: (newName: string, newImagePath?: string) => void
}

export const EditCustomSkinDialog: React.FC<EditCustomSkinDialogProps> = ({
  isOpen,
  currentName,
  onClose,
  onSave
}) => {
  const [newName, setNewName] = useState(currentName)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedImageName, setSelectedImageName] = useState<string>('')

  useEffect(() => {
    setNewName(currentName)
    setSelectedImage(null)
    setSelectedImageName('')
  }, [currentName])

  const handleSelectImage = async () => {
    const result = await window.api.browseImageFile()
    if (result.success && result.filePath) {
      setSelectedImage(result.filePath)
      const fileName = result.filePath.split(/[\\/]/).pop() || ''
      setSelectedImageName(fileName)
    }
  }

  const handleSave = () => {
    if (newName.trim()) {
      onSave(newName.trim(), selectedImage || undefined)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Custom Mod</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="mod-name">Mod Name</Label>
            <Input
              id="mod-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter mod name"
            />
          </div>

          <div>
            <Label>Preview Image (Optional)</Label>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handleSelectImage}>
                Select Image
              </Button>
              {selectedImageName && (
                <span className="text-sm text-charcoal-600 dark:text-charcoal-400 truncate">
                  {selectedImageName}
                </span>
              )}
            </div>
            {selectedImage && (
              <p className="text-xs text-charcoal-500 dark:text-charcoal-500 mt-1">
                New image selected
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!newName.trim()}
            className="bg-terracotta-500 hover:bg-terracotta-600"
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

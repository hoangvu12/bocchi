import { useRef, useCallback, useEffect, ReactNode } from 'react'
import { useSetAtom } from 'jotai'
import { isDraggingAtom } from '../../store/atoms/ui.atoms'
import { useStyles } from '../../hooks/useOptimizedState'

interface MainLayoutProps {
  children: ReactNode
  fileUploadRef: React.MutableRefObject<any>
}

export function MainLayout({ children, fileUploadRef }: MainLayoutProps) {
  const setIsDragging = useSetAtom(isDraggingAtom)
  const styles = useStyles()
  const dragCounter = useRef(0)

  // Document drag over handler
  useEffect(() => {
    const handleDocumentDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    document.addEventListener('dragover', handleDocumentDragOver)
    return () => {
      document.removeEventListener('dragover', handleDocumentDragOver)
    }
  }, [])

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current++
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true)
      }
    },
    [setIsDragging]
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounter.current--
      if (dragCounter.current === 0) {
        setIsDragging(false)
      }
    },
    [setIsDragging]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      dragCounter.current = 0

      const files = Array.from(e.dataTransfer.files)
      const skinFiles = files.filter((file) => {
        const ext = file.name.toLowerCase()
        return ext.endsWith('.wad') || ext.endsWith('.zip') || ext.endsWith('.fantome')
      })

      if (skinFiles.length > 0 && fileUploadRef.current) {
        const filePaths: string[] = []
        for (const file of skinFiles) {
          try {
            const filePath = window.api.getPathForFile(file)
            if (filePath) {
              filePaths.push(filePath)
            }
          } catch (err) {
            console.error('Error getting file path:', err)
          }
        }

        if (filePaths.length > 0) {
          fileUploadRef.current.handleDroppedFiles(filePaths)
        }
      }
    },
    [setIsDragging, fileUploadRef]
  )

  return (
    <div
      className={styles.mainContainer.className}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
    </div>
  )
}

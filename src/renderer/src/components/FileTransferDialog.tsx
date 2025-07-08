import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Button } from './ui/button'
import { Progress } from './ui/progress'
import { p2pFileTransferService } from '../services/p2pFileTransferService'
import { getChampionDisplayName } from '../utils/championUtils'
import type { SelectedSkin } from '../store/atoms'

interface FileTransferRequest {
  id: string
  peerId: string
  metadata: {
    fileName: string
    fileSize: number
    modInfo: {
      championName: string
      skinName: string
    }
  }
  skinInfo: SelectedSkin
  accept: () => void
  reject: (reason?: string) => void
}

interface TransferProgress {
  id: string
  progress: number
  bytesTransferred: number
  totalBytes: number
}

interface FileTransferDialogProps {
  championData?: {
    champions: Array<{ key: string; name: string; nameEn?: string; [key: string]: any }>
  }
}

export const FileTransferDialog: React.FC<FileTransferDialogProps> = ({ championData }) => {
  const [pendingRequests, setPendingRequests] = useState<FileTransferRequest[]>([])
  const [activeTransfers, setActiveTransfers] = useState<Map<string, TransferProgress>>(new Map())
  const [completedTransfers, setCompletedTransfers] = useState<string[]>([])

  useEffect(() => {
    // Listen for transfer requests
    const handleTransferRequest = (request: FileTransferRequest) => {
      setPendingRequests((prev) => [...prev, request])
    }

    // Listen for transfer progress
    const handleTransferProgress = (data: TransferProgress) => {
      setActiveTransfers((prev) => {
        const newMap = new Map(prev)
        newMap.set(data.id, data)
        return newMap
      })
    }

    // Listen for transfer completion
    const handleTransferComplete = ({ id }: { id: string }) => {
      setActiveTransfers((prev) => {
        const newMap = new Map(prev)
        newMap.delete(id)
        return newMap
      })
      setCompletedTransfers((prev) => [...prev, id])

      // Clear completed after 3 seconds
      setTimeout(() => {
        setCompletedTransfers((prev) => prev.filter((tId) => tId !== id))
      }, 3000)
    }

    // Listen for transfer errors
    const handleTransferError = ({ id, error }: { id: string; error: any }) => {
      console.error(`Transfer ${id} failed:`, error)
      setActiveTransfers((prev) => {
        const newMap = new Map(prev)
        newMap.delete(id)
        return newMap
      })
    }

    // Subscribe to events
    p2pFileTransferService.on('transfer-request', handleTransferRequest)
    p2pFileTransferService.on('transfer-progress', handleTransferProgress)
    p2pFileTransferService.on('transfer-complete', handleTransferComplete)
    p2pFileTransferService.on('transfer-error', handleTransferError)

    // Cleanup
    return () => {
      p2pFileTransferService.removeListener('transfer-request', handleTransferRequest)
      p2pFileTransferService.removeListener('transfer-progress', handleTransferProgress)
      p2pFileTransferService.removeListener('transfer-complete', handleTransferComplete)
      p2pFileTransferService.removeListener('transfer-error', handleTransferError)
    }
  }, [])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const currentRequest = pendingRequests[0]

  return (
    <>
      {/* Transfer Request Dialog */}
      <Dialog open={!!currentRequest} onOpenChange={() => {}}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Incoming File Transfer</DialogTitle>
            <DialogDescription>A peer wants to share a custom mod with you</DialogDescription>
          </DialogHeader>

          {currentRequest && (
            <div className="space-y-4">
              <div className="bg-cream-50 dark:bg-charcoal-800 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-charcoal-600 dark:text-charcoal-400">File:</span>
                  <span className="text-sm font-medium">{currentRequest.metadata.fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-charcoal-600 dark:text-charcoal-400">Size:</span>
                  <span className="text-sm font-medium">
                    {formatFileSize(currentRequest.metadata.fileSize)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-charcoal-600 dark:text-charcoal-400">
                    Champion:
                  </span>
                  <span className="text-sm font-medium">
                    {(() => {
                      const champion = championData?.champions.find(
                        (c) => c.key === currentRequest.metadata.modInfo.championName
                      )
                      return champion
                        ? getChampionDisplayName(champion)
                        : currentRequest.metadata.modInfo.championName
                    })()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-charcoal-600 dark:text-charcoal-400">Skin:</span>
                  <span className="text-sm font-medium">
                    {currentRequest.metadata.modInfo.skinName}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    currentRequest.reject('User declined')
                    setPendingRequests((prev) => prev.slice(1))
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Decline
                </Button>
                <Button
                  onClick={() => {
                    currentRequest.accept()
                    setPendingRequests((prev) => prev.slice(1))
                  }}
                  className="flex-1 bg-terracotta-500 hover:bg-terracotta-600 text-white"
                >
                  Accept
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Active Transfers */}
      {activeTransfers.size > 0 && (
        <div className="fixed bottom-20 right-4 w-80 space-y-2">
          {Array.from(activeTransfers.values()).map((transfer) => (
            <div
              key={transfer.id}
              className="bg-white dark:bg-charcoal-800 border border-charcoal-200 dark:border-charcoal-700 rounded-lg p-4 shadow-lg"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Transferring file...</span>
                <span className="text-xs text-charcoal-600 dark:text-charcoal-400">
                  {Math.round(transfer.progress)}%
                </span>
              </div>
              <Progress value={transfer.progress} className="h-2" />
              <div className="mt-2 text-xs text-charcoal-600 dark:text-charcoal-400">
                {formatFileSize(transfer.bytesTransferred)} / {formatFileSize(transfer.totalBytes)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed Transfers */}
      {completedTransfers.length > 0 && (
        <div className="fixed bottom-20 right-4 w-80 space-y-2">
          {completedTransfers.map((id) => (
            <div
              key={id}
              className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-4"
            >
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  Transfer completed!
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

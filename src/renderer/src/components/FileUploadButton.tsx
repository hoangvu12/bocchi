import { FileImage, Image, Loader2, Upload, X } from 'lucide-react'
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Champion } from '../App'
import { useToolsManagement } from '../hooks/useToolsManagement'
import { detectChampionFromText, getChampionDisplayName } from '../utils/championUtils'
import { ImportMethodDialog } from './ImportMethodDialog'
import { Switch } from './ui/switch'

interface FileUploadButtonProps {
  champions: Champion[]
  onSkinImported: () => void
}

export interface FileUploadButtonRef {
  handleDroppedFiles: (filePaths: string[]) => void
}

// Format bytes to human readable
const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export const FileUploadButton = forwardRef<FileUploadButtonRef, FileUploadButtonProps>(
  ({ champions, onSkinImported }, ref) => {
    const { t } = useTranslation()
    const [isImporting, setIsImporting] = useState(false)
    const [showDialog, setShowDialog] = useState(false)
    const [showMethodDialog, setShowMethodDialog] = useState(false)
    const [selectedFile, setSelectedFile] = useState<string>('')
    const [selectedChampion, setSelectedChampion] = useState<string>('')
    const [customName, setCustomName] = useState<string>('')
    const [customAuthor, setCustomAuthor] = useState<string>('')
    const [selectedImage, setSelectedImage] = useState<string>('')
    const [error, setError] = useState<string>('')
    const [fixModIssues, setFixModIssues] = useState<boolean>(false)
    const [isExtractingImage, setIsExtractingImage] = useState<boolean>(false)
    const [extractionError, setExtractionError] = useState<string>('')
    const [extractionStatus, setExtractionStatus] = useState<string>('')
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('')

    // Tools management
    const { downloadingTools, toolsDownloadProgress, downloadSpeed, downloadSize } =
      useToolsManagement()

    // Load auto-fix setting when dialog opens
    useEffect(() => {
      if (showDialog) {
        window.api.getSettings('autoFixModIssues').then((value) => {
          setFixModIssues(value === true)
        })
      }
    }, [showDialog])

    // Listen to extraction status updates
    useEffect(() => {
      const unsubscribe = window.api.onExtractImageStatus((status) => {
        setExtractionStatus(status)
      })

      return () => {
        unsubscribe()
      }
    }, [])

    // Load image preview when selectedImage changes
    useEffect(() => {
      const loadImagePreview = async () => {
        if (selectedImage) {
          try {
            // Read the image as base64 data URL
            const result = await window.api.readImageAsBase64(selectedImage)
            if (result.success && result.data) {
              setImagePreviewUrl(result.data)
            } else {
              console.error('Failed to load image preview:', result.error)
              setImagePreviewUrl('')
            }
          } catch (error) {
            console.error('Error loading image preview:', error)
            setImagePreviewUrl('')
          }
        } else {
          setImagePreviewUrl('')
        }
      }

      loadImagePreview()
    }, [selectedImage])

    // Batch import states
    const [showBatchDialog, setShowBatchDialog] = useState(false)
    const [batchProgress, setBatchProgress] = useState<{
      current: number
      total: number
      currentFile: string
      results: Array<{ filePath: string; success: boolean; error?: string }>
    }>({ current: 0, total: 0, currentFile: '', results: [] })

    const handleBatchImport = useCallback(
      async (filePaths: string[]) => {
        setIsImporting(true)

        const results: Array<{ filePath: string; success: boolean; error?: string }> = []

        for (let i = 0; i < filePaths.length; i++) {
          const filePath = filePaths[i]
          const fileName = filePath.split(/[\\/]/).pop() || ''

          setBatchProgress((prev) => ({
            ...prev,
            current: i + 1,
            currentFile: fileName
          }))

          try {
            // Validate first
            const validation = await window.api.validateSkinFile(filePath)
            if (!validation.valid) {
              results.push({
                filePath,
                success: false,
                error: validation.error || 'Invalid file format'
              })
              continue
            }

            // Try to extract mod info for better champion detection
            const importOptions: any = {}
            try {
              const modInfo = await window.api.extractModInfo(filePath)
              if (modInfo.success && modInfo.info) {
                // Use extracted name if available
                if (modInfo.info.name) {
                  importOptions.skinName = modInfo.info.name
                }

                // Use extracted author if available
                if (modInfo.info.author) {
                  importOptions.author = modInfo.info.author
                }

                // Try to detect champion - prioritize explicit champion field
                let detectedChampion = ''

                // 1. FIRST PRIORITY: Check if champion is explicitly provided in info.json
                if (modInfo.info?.champion) {
                  // Direct match with champion key or name
                  const found = champions.find(
                    (c) =>
                      c.key.toLowerCase() === modInfo.info?.champion?.toLowerCase() ||
                      getChampionDisplayName(c).toLowerCase() ===
                        modInfo.info?.champion?.toLowerCase()
                  )
                  if (found) {
                    detectedChampion = found.key
                  } else {
                    // If no direct match, still use the champion field value
                    // It might be a valid champion key we don't have in our list
                    detectedChampion = modInfo.info.champion
                  }
                }

                // 2. SECOND PRIORITY: Try to detect from name and description
                if (!detectedChampion && (modInfo.info.name || modInfo.info.description)) {
                  const textToSearch = `${modInfo.info.name || ''} ${modInfo.info.description || ''}`
                  detectedChampion = detectChampionFromText(textToSearch, champions)
                }

                // 3. LAST PRIORITY: Try file name
                if (!detectedChampion) {
                  detectedChampion = detectChampionFromText(fileName, champions)
                }

                if (detectedChampion) {
                  importOptions.championName = detectedChampion
                }
              }
            } catch (error) {
              console.warn('Failed to extract mod info for batch import:', error)
            }

            // Import with extracted options or default
            const result = await window.api.importSkinFile(filePath, importOptions)

            // Fix mod issues if requested and import was successful
            if (result.success && fixModIssues && result.skinInfo?.localPath) {
              const fixResult = await window.api.fixModIssues(result.skinInfo.localPath)
              if (!fixResult.success) {
                console.warn(`Failed to fix mod issues for ${fileName}:`, fixResult.error)
              }
            }

            results.push({
              filePath,
              success: result.success,
              error: result.error
            })
          } catch (error) {
            results.push({
              filePath,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        }

        setBatchProgress((prev) => ({
          ...prev,
          results
        }))

        setIsImporting(false)

        // Refresh skin list if any imports succeeded
        if (results.some((r) => r.success)) {
          onSkinImported()
        }
      },
      [fixModIssues, champions, onSkinImported]
    )

    // Function to extract and auto-populate mod info
    const extractAndPopulateModInfo = useCallback(
      async (filePath: string) => {
        try {
          const result = await window.api.extractModInfo(filePath)

          if (result.success && result.info) {
            // Auto-populate custom name if available
            if (result.info.name) {
              setCustomName(result.info.name)
            }

            // Auto-populate author if available
            if (result.info.author) {
              setCustomAuthor(result.info.author)
            }

            // Try to detect champion - prioritize explicit champion field
            let detectedChampion = ''

            // 1. FIRST PRIORITY: Check if champion is explicitly provided in info.json
            if (result.info?.champion) {
              // Direct match with champion key or name
              const found = champions.find(
                (c) =>
                  c.key.toLowerCase() === result.info?.champion?.toLowerCase() ||
                  getChampionDisplayName(c).toLowerCase() === result.info?.champion?.toLowerCase()
              )
              if (found) {
                detectedChampion = found.key
              } else {
                // If no direct match, still use the champion field value
                // It might be a valid champion key we don't have in our list
                detectedChampion = result.info.champion
              }
            }

            // 2. SECOND PRIORITY: Try to detect from name and description
            if (!detectedChampion && (result.info.name || result.info.description)) {
              const textToSearch = `${result.info.name || ''} ${result.info.description || ''}`
              detectedChampion = detectChampionFromText(textToSearch, champions)
            }

            // 3. LAST PRIORITY: Try file name as fallback
            if (!detectedChampion) {
              const fileName = filePath.split(/[\\/]/).pop() || ''
              detectedChampion = detectChampionFromText(fileName, champions)
            }

            if (detectedChampion) {
              setSelectedChampion(detectedChampion)
            }
          } else {
            // Fallback to old behavior if extraction fails
            const fileName = filePath.split(/[\\/]/).pop() || ''
            const match = fileName.match(/^([A-Za-z]+)[-_\s]/i)
            if (match && champions.find((c) => c.key === match[1])) {
              setSelectedChampion(match[1])
            }
          }
        } catch (error) {
          console.error('Failed to extract mod info:', error)
          // Fallback to old behavior
          const fileName = filePath.split(/[\\/]/).pop() || ''
          const match = fileName.match(/^([A-Za-z]+)[-_\s]/i)
          if (match && champions.find((c) => c.key === match[1])) {
            setSelectedChampion(match[1])
          }
        }
      },
      [champions]
    )

    // Auto-extract image when dialog opens with a file selected
    useEffect(() => {
      const autoExtractImage = async () => {
        if (showDialog && selectedFile && !selectedImage) {
          const autoExtract = await window.api.getSettings('autoExtractImages')
          if (autoExtract) {
            // Automatically extract the image
            setIsExtractingImage(true)
            setExtractionError('')
            setExtractionStatus('')

            try {
              const extractResult = await window.api.extractImageFromMod(selectedFile)

              if (extractResult.success && extractResult.imagePath) {
                setSelectedImage(extractResult.imagePath)
                setExtractionStatus('')
              } else {
                // Don't show error for auto-extraction, just silently fail
                console.log('Auto-extraction failed:', extractResult.error)
              }
            } catch (error) {
              console.log('Auto-extraction error:', error)
            } finally {
              setIsExtractingImage(false)
              setExtractionStatus('')
            }
          }
        }
      }

      autoExtractImage()
    }, [showDialog, selectedFile, selectedImage])

    // Expose handleDroppedFiles method to parent
    useImperativeHandle(
      ref,
      () => ({
        handleDroppedFiles: async (filePaths: string[]) => {
          // Close the import method dialog if it's open
          setShowMethodDialog(false)

          if (filePaths.length === 1) {
            setSelectedFile(filePaths[0])
            setError('')
            setSelectedImage('') // Clear any previous image
            setExtractionError('') // Clear any previous extraction error

            // Show dialog immediately
            setShowDialog(true)

            // Extract and populate mod info in the background
            extractAndPopulateModInfo(filePaths[0])
          } else if (filePaths.length > 1) {
            // Multiple files dropped
            setBatchProgress({
              current: 0,
              total: filePaths.length,
              currentFile: '',
              results: []
            })
            setShowBatchDialog(true)
            handleBatchImport(filePaths)
          }
        }
      }),
      [handleBatchImport, extractAndPopulateModInfo]
    )

    const handleFileSelected = useCallback(
      async (filePath: string) => {
        setSelectedFile(filePath)
        setError('')
        setSelectedImage('') // Clear any previous image
        setExtractionError('') // Clear any previous extraction error

        // Show dialog immediately
        setShowDialog(true)

        // Extract and populate mod info in the background
        extractAndPopulateModInfo(filePath)
      },
      [extractAndPopulateModInfo]
    )

    const handleMultipleFilesSelected = useCallback(
      (filePaths: string[]) => {
        setBatchProgress({
          current: 0,
          total: filePaths.length,
          currentFile: '',
          results: []
        })
        setShowBatchDialog(true)
        handleBatchImport(filePaths)
      },
      [handleBatchImport]
    )

    const handleExtractImage = async () => {
      if (!selectedFile) return

      setIsExtractingImage(true)
      setExtractionError('')
      setExtractionStatus('')

      try {
        const result = await window.api.extractImageFromMod(selectedFile)

        if (result.success && result.imagePath) {
          setSelectedImage(result.imagePath)
          setExtractionStatus('')
        } else {
          setExtractionError(
            result.error || t('fileUpload.extractImageError', { error: 'Unknown error' })
          )
        }
      } catch (error) {
        setExtractionError(
          t('fileUpload.extractImageError', {
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        )
      } finally {
        setIsExtractingImage(false)
        setExtractionStatus('')
      }
    }

    const handleImport = async () => {
      if (!selectedFile) {
        setError(t('fileUpload.noFileSelected'))
        return
      }

      setError('')
      setIsImporting(true)

      try {
        // Validate file first
        const validation = await window.api.validateSkinFile(selectedFile)
        if (!validation.valid) {
          setError(validation.error || t('fileUpload.invalidFile'))
          setIsImporting(false)
          return
        }

        // Import the file
        const result = await window.api.importSkinFile(selectedFile, {
          championName: selectedChampion, // Pass empty string as-is, don't convert to undefined
          skinName: customName || undefined,
          author: customAuthor || undefined,
          imagePath: selectedImage || undefined
        })

        // Fix mod issues if requested
        if (result.success && fixModIssues && result.skinInfo?.localPath) {
          const fixResult = await window.api.fixModIssues(result.skinInfo.localPath)
          if (!fixResult.success) {
            console.warn('Failed to fix mod issues:', fixResult.error)
          }
        }

        if (result.success) {
          setShowDialog(false)
          onSkinImported()
          // Reset form
          setSelectedFile('')
          setSelectedChampion('')
          setCustomName('')
          setCustomAuthor('')
          setSelectedImage('')
          setImagePreviewUrl('')
          setFixModIssues(false)
        } else {
          setError(result.error || t('fileUpload.importFailed'))
        }
      } catch {
        setError(t('fileUpload.importFailed'))
      } finally {
        setIsImporting(false)
      }
    }

    const handleDrop = async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        // Filter for skin files
        const skinFiles = files.filter((file) => {
          const ext = file.name.toLowerCase()
          return (
            ext.endsWith('.wad.client') ||
            ext.endsWith('.wad') ||
            ext.endsWith('.zip') ||
            ext.endsWith('.fantome')
          )
        })

        if (skinFiles.length > 0) {
          // Use webUtils.getPathForFile() to get file paths
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

          if (filePaths.length === 1) {
            setSelectedFile(filePaths[0])
            setError('')
            setSelectedImage('') // Clear any previous image
            setExtractionError('') // Clear any previous extraction error

            // Show dialog immediately
            setShowDialog(true)

            // Extract and populate mod info in the background
            extractAndPopulateModInfo(filePaths[0])
          } else {
            // Multiple files dropped
            setBatchProgress({
              current: 0,
              total: filePaths.length,
              currentFile: '',
              results: []
            })
            setShowBatchDialog(true)
            handleBatchImport(filePaths)
          }
        }
      }
    }

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const closeDialog = () => {
      if (!isImporting) {
        setShowDialog(false)
        setError('')
        setSelectedFile('')
        setSelectedChampion('')
        setCustomName('')
        setCustomAuthor('')
        setSelectedImage('')
        setImagePreviewUrl('')
        setFixModIssues(false)
        setExtractionError('')
        setExtractionStatus('')
        setIsExtractingImage(false)
      }
    }

    return (
      <>
        <div onDrop={handleDrop} onDragOver={handleDragOver} className="inline-block">
          <button
            onClick={() => setShowMethodDialog(true)}
            className="px-4 py-2.5 text-sm bg-surface hover:bg-secondary-100 dark:hover:bg-secondary-800 text-text-primary font-medium rounded-lg transition-all duration-200 border border-border hover:border-border-strong shadow-sm hover:shadow-md dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={isImporting}
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {t('fileUpload.uploadButton')}
          </button>
        </div>

        <ImportMethodDialog
          open={showMethodDialog}
          onClose={() => setShowMethodDialog(false)}
          onFileSelected={handleFileSelected}
          onMultipleFilesSelected={handleMultipleFilesSelected}
        />

        {showDialog && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-surface rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl dark:shadow-dark-xl animate-slide-down">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-text-primary">
                  {t('fileUpload.importTitle')}
                </h3>
                <button
                  onClick={closeDialog}
                  disabled={isImporting}
                  className="p-1 hover:bg-secondary-100 dark:hover:bg-secondary-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              <p className="text-text-secondary mb-6 text-sm">
                {t('fileUpload.importDescription')}
              </p>

              {error && (
                <div className="mb-4 bg-state-error/10 border border-state-error/30 text-state-error px-3 py-2 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    {t('fileUpload.selectedFile')}
                  </label>
                  <input
                    type="text"
                    value={selectedFile.split(/[\\/]/).pop() || ''}
                    disabled
                    className="w-full px-3 py-2 text-sm bg-secondary-100 dark:bg-secondary-900 border border-border rounded-lg text-text-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    {t('fileUpload.selectChampion')}{' '}
                    <span className="text-text-muted font-normal">(Optional)</span>
                  </label>
                  <select
                    value={selectedChampion}
                    onChange={(e) => setSelectedChampion(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-secondary-100 dark:bg-secondary-900 border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">{t('fileUpload.championPlaceholder')}</option>
                    {champions.map((champion) => (
                      <option key={champion.key} value={champion.key}>
                        {getChampionDisplayName(champion)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    {t('fileUpload.customName')}{' '}
                    <span className="text-text-muted font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder={t('fileUpload.customNamePlaceholder')}
                    className="w-full px-3 py-2 text-sm bg-secondary-100 dark:bg-secondary-900 border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    {t('fileUpload.author')}{' '}
                    <span className="text-text-muted font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={customAuthor}
                    onChange={(e) => setCustomAuthor(e.target.value)}
                    placeholder={t('fileUpload.authorPlaceholder')}
                    className="w-full px-3 py-2 text-sm bg-secondary-100 dark:bg-secondary-900 border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    {t('fileUpload.previewImage')}{' '}
                    <span className="text-text-muted font-normal">(Optional)</span>
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={
                        downloadingTools
                          ? t('tools.downloadingTools')
                          : isExtractingImage && extractionStatus
                            ? extractionStatus
                            : selectedImage.split(/[\\/]/).pop() || ''
                      }
                      disabled
                      placeholder={t('fileUpload.noImageSelected')}
                      className="w-full px-3 py-2 text-sm bg-secondary-100 dark:bg-secondary-900 border border-border rounded-lg text-text-primary placeholder-text-muted"
                    />
                    {downloadingTools && (
                      <div className="bg-secondary-100 dark:bg-secondary-900 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-text-secondary">{t('tools.downloading')}</span>
                          <span className="text-text-primary font-medium">
                            {Math.round(toolsDownloadProgress)}%
                          </span>
                        </div>
                        <div className="w-full bg-secondary-200 dark:bg-secondary-800 rounded-full h-2">
                          <div
                            className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${toolsDownloadProgress}%` }}
                          />
                        </div>
                        {downloadSpeed > 0 && (
                          <div className="flex items-center justify-between text-xs text-text-secondary">
                            <span>{formatBytes(downloadSpeed)}/s</span>
                            <span>
                              {formatBytes(downloadSize.loaded)} / {formatBytes(downloadSize.total)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {/* Image Preview or Extraction Status */}
                    {(selectedImage || isExtractingImage) && (
                      <div className="bg-secondary-100 dark:bg-secondary-900 rounded-lg p-3 flex items-center justify-center min-h-[144px]">
                        {isExtractingImage ? (
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary-500" />
                            <p className="text-xs text-text-secondary">
                              {extractionStatus || t('fileUpload.extractingImage')}
                            </p>
                          </div>
                        ) : imagePreviewUrl ? (
                          <img
                            src={imagePreviewUrl}
                            alt="Preview"
                            className="max-h-32 max-w-full rounded-md object-contain"
                            onError={(e) => {
                              console.error('Failed to load preview image:', imagePreviewUrl)
                              // Try alternative approach - hide the broken image
                              const target = e.currentTarget as HTMLImageElement
                              target.style.display = 'none'
                              // Show placeholder text instead
                              const parent = target.parentElement
                              if (parent) {
                                const placeholder = document.createElement('div')
                                placeholder.className = 'text-xs text-text-muted text-center'
                                placeholder.innerHTML = `
                                  <div class="mb-1">✓ Image extracted</div>
                                  <div class="text-xs opacity-60">${selectedImage.split(/[\\/]/).pop()}</div>
                                `
                                parent.appendChild(placeholder)
                              }
                            }}
                          />
                        ) : null}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const result = await window.api.browseImageFile()
                          if (result.success && result.filePath) {
                            setSelectedImage(result.filePath)
                            setExtractionError('') // Clear any extraction errors when manually selecting
                          }
                        }}
                        className="flex-1 px-4 py-2 text-sm bg-surface hover:bg-secondary-100 dark:hover:bg-secondary-800 text-text-primary font-medium rounded-lg transition-all duration-200 border border-border flex items-center justify-center gap-2"
                      >
                        <Image className="h-4 w-4" />
                        {t('fileUpload.browseImage')}
                      </button>
                      {selectedFile && !selectedImage && (
                        <button
                          type="button"
                          onClick={handleExtractImage}
                          disabled={isExtractingImage}
                          className="flex-1 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                        >
                          {isExtractingImage ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              {extractionStatus || t('fileUpload.extractingImage')}
                            </>
                          ) : (
                            <>
                              <FileImage className="h-4 w-4" />
                              {t('fileUpload.extractImage')}
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  {extractionError && (
                    <p className="mt-2 text-xs text-state-error">{extractionError}</p>
                  )}
                </div>

                <div className="flex items-center justify-between space-x-4">
                  <div className="flex-1">
                    <label
                      htmlFor="fix-mod-issues"
                      className="text-sm text-text-primary cursor-pointer select-none"
                    >
                      {t('fileUpload.fixModIssues')}
                      <span className="block text-xs text-text-muted mt-0.5">
                        {t('fileUpload.fixModIssuesDescription')}
                      </span>
                    </label>
                  </div>
                  <Switch
                    id="fix-mod-issues"
                    checked={fixModIssues}
                    onCheckedChange={setFixModIssues}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={closeDialog}
                  disabled={isImporting}
                  className="px-4 py-2 text-sm bg-surface hover:bg-secondary-100 dark:hover:bg-secondary-800 text-text-primary font-medium rounded-lg transition-all duration-200 border border-border disabled:opacity-50"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleImport}
                  disabled={isImporting || !selectedFile}
                  className="px-4 py-2 text-sm bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('fileUpload.importing')}
                    </>
                  ) : (
                    t('fileUpload.import')
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {showBatchDialog && (
          <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-surface rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl dark:shadow-dark-xl animate-slide-down">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-text-primary">
                  {t('fileUpload.batchImportTitle')}
                </h3>
                <button
                  onClick={() => {
                    if (!isImporting) {
                      setShowBatchDialog(false)
                      setBatchProgress({ current: 0, total: 0, currentFile: '', results: [] })
                    }
                  }}
                  disabled={isImporting}
                  className="p-1 hover:bg-secondary-100 dark:hover:bg-secondary-800 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              <div className="space-y-4">
                {isImporting ? (
                  <>
                    <div className="text-center">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary-500" />
                      <p className="text-sm text-text-secondary">
                        {t('fileUpload.importingProgress', {
                          current: batchProgress.current,
                          total: batchProgress.total
                        })}
                      </p>
                      <p className="text-xs text-text-muted mt-1 truncate">
                        {batchProgress.currentFile}
                      </p>
                    </div>

                    <div className="w-full bg-secondary-200 dark:bg-secondary-700 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center mb-4">
                      <p className="text-sm text-text-secondary">{t('fileUpload.batchComplete')}</p>
                      <p className="text-lg font-semibold text-text-primary mt-2">
                        {batchProgress.results.filter((r) => r.success).length}{' '}
                        {t('fileUpload.succeeded')},{' '}
                        {batchProgress.results.filter((r) => !r.success).length}{' '}
                        {t('fileUpload.failed')}
                      </p>
                    </div>

                    {batchProgress.results.filter((r) => !r.success).length > 0 && (
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        <p className="text-xs font-medium text-text-primary mb-2">
                          {t('fileUpload.failedFiles')}
                        </p>
                        {batchProgress.results
                          .filter((r) => !r.success)
                          .map((result, idx) => (
                            <div
                              key={idx}
                              className="text-xs bg-state-error/10 border border-state-error/30 text-state-error px-2 py-1 rounded"
                            >
                              <p className="font-medium truncate">
                                {result.filePath.split(/[\\/]/).pop()}
                              </p>
                              <p className="text-state-error">{result.error}</p>
                            </div>
                          ))}
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setShowBatchDialog(false)
                        setBatchProgress({ current: 0, total: 0, currentFile: '', results: [] })
                      }}
                      className="w-full px-4 py-2 text-sm bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-all duration-200"
                    >
                      {t('fileUpload.close')}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    )
  }
)

FileUploadButton.displayName = 'FileUploadButton'

import React, { useState, forwardRef, useImperativeHandle, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, Loader2, X, Image } from 'lucide-react'
import type { Champion } from '../App'
import { getChampionDisplayName, detectChampionFromText } from '../utils/championUtils'
import { Switch } from './ui/switch'

interface FileUploadButtonProps {
  champions: Champion[]
  onSkinImported: () => void
}

export interface FileUploadButtonRef {
  handleDroppedFiles: (filePaths: string[]) => void
}

export const FileUploadButton = forwardRef<FileUploadButtonRef, FileUploadButtonProps>(
  ({ champions, onSkinImported }, ref) => {
    const { t } = useTranslation()
    const [isImporting, setIsImporting] = useState(false)
    const [showDialog, setShowDialog] = useState(false)
    const [selectedFile, setSelectedFile] = useState<string>('')
    const [selectedChampion, setSelectedChampion] = useState<string>('')
    const [customName, setCustomName] = useState<string>('')
    const [selectedImage, setSelectedImage] = useState<string>('')
    const [error, setError] = useState<string>('')
    const [fixModIssues, setFixModIssues] = useState<boolean>(false)

    // Load auto-fix setting when dialog opens
    useEffect(() => {
      if (showDialog) {
        window.api.getSettings('autoFixModIssues').then((value) => {
          setFixModIssues(value === true)
        })
      }
    }, [showDialog])

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

    // Expose handleDroppedFiles method to parent
    useImperativeHandle(
      ref,
      () => ({
        handleDroppedFiles: async (filePaths: string[]) => {
          if (filePaths.length === 1) {
            setSelectedFile(filePaths[0])
            setError('')

            // Extract and populate mod info
            await extractAndPopulateModInfo(filePaths[0])

            setShowDialog(true)
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

    const handleBrowseMultipleFiles = async () => {
      const result = await window.api.browseSkinFiles()
      if (result.success && result.filePaths && result.filePaths.length > 0) {
        if (result.filePaths.length === 1) {
          // Single file, show normal dialog
          setSelectedFile(result.filePaths[0])
          setError('')

          // Extract and populate mod info
          await extractAndPopulateModInfo(result.filePaths[0])

          setShowDialog(true)
        } else {
          // Multiple files, show batch dialog
          setBatchProgress({
            current: 0,
            total: result.filePaths.length,
            currentFile: '',
            results: []
          })
          setShowBatchDialog(true)
          // Start batch import immediately
          handleBatchImport(result.filePaths)
        }
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
          setSelectedImage('')
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

            // Extract and populate mod info
            await extractAndPopulateModInfo(filePaths[0])

            setShowDialog(true)
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
        setSelectedImage('')
        setFixModIssues(false)
      }
    }

    return (
      <>
        <div onDrop={handleDrop} onDragOver={handleDragOver} className="inline-block">
          <button
            onClick={handleBrowseMultipleFiles}
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
                    {t('fileUpload.previewImage')}{' '}
                    <span className="text-text-muted font-normal">(Optional)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={selectedImage.split(/[\\/]/).pop() || ''}
                      disabled
                      placeholder={t('fileUpload.noImageSelected')}
                      className="flex-1 px-3 py-2 text-sm bg-secondary-100 dark:bg-secondary-900 border border-border rounded-lg text-text-primary placeholder-text-muted"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const result = await window.api.browseImageFile()
                        if (result.success && result.filePath) {
                          setSelectedImage(result.filePath)
                        }
                      }}
                      className="px-4 py-2 text-sm bg-surface hover:bg-secondary-100 dark:hover:bg-secondary-800 text-text-primary font-medium rounded-lg transition-all duration-200 border border-border flex items-center gap-2"
                    >
                      <Image className="h-4 w-4" />
                      {t('fileUpload.browseImage')}
                    </button>
                  </div>
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

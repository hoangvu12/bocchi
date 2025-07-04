import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, Loader2, X, Image } from 'lucide-react'
import type { Champion } from '../App'

interface FileUploadButtonProps {
  champions: Champion[]
  onSkinImported: () => void
}

export const FileUploadButton: React.FC<FileUploadButtonProps> = ({
  champions,
  onSkinImported
}) => {
  const { t } = useTranslation()
  const [isImporting, setIsImporting] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [selectedChampion, setSelectedChampion] = useState<string>('')
  const [customName, setCustomName] = useState<string>('')
  const [selectedImage, setSelectedImage] = useState<string>('')
  const [error, setError] = useState<string>('')

  // Batch import states
  const [showBatchDialog, setShowBatchDialog] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{
    current: number
    total: number
    currentFile: string
    results: Array<{ filePath: string; success: boolean; error?: string }>
  }>({ current: 0, total: 0, currentFile: '', results: [] })

  const handleBrowseMultipleFiles = async () => {
    const result = await window.api.browseSkinFiles()
    if (result.success && result.filePaths && result.filePaths.length > 0) {
      if (result.filePaths.length === 1) {
        // Single file, show normal dialog
        setSelectedFile(result.filePaths[0])

        // Try to extract champion name from file path
        const fileName = result.filePaths[0].split(/[\\/]/).pop() || ''
        const match = fileName.match(/^([A-Za-z]+)[-_\s]/i)
        if (match && champions.find((c) => c.key === match[1])) {
          setSelectedChampion(match[1])
        }

        setError('')
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

      if (result.success) {
        setShowDialog(false)
        onSkinImported()
        // Reset form
        setSelectedFile('')
        setSelectedChampion('')
        setCustomName('')
        setSelectedImage('')
      } else {
        setError(result.error || t('fileUpload.importFailed'))
      }
    } catch {
      setError(t('fileUpload.importFailed'))
    } finally {
      setIsImporting(false)
    }
  }

  const handleBatchImport = async (filePaths: string[]) => {
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

        // Import with default options (auto-detect)
        const result = await window.api.importSkinFile(filePath, {})

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
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      if (files.length === 1) {
        setSelectedFile(files[0].path)
        setShowDialog(true)
      } else {
        // Multiple files dropped
        const filePaths = files.map((f) => f.path)
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
    }
  }

  return (
    <>
      <div onDrop={handleDrop} onDragOver={handleDragOver} className="inline-block">
        <button
          onClick={handleBrowseMultipleFiles}
          className="px-4 py-2.5 text-sm bg-white dark:bg-charcoal-800 hover:bg-cream-100 dark:hover:bg-charcoal-700 text-charcoal-800 dark:text-charcoal-200 font-medium rounded-lg transition-all duration-200 border border-charcoal-200 dark:border-charcoal-700 hover:border-charcoal-300 dark:hover:border-charcoal-600 shadow-sm hover:shadow-md dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
        <div className="fixed inset-0 bg-charcoal-950 bg-opacity-50 dark:bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-charcoal-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl dark:shadow-dark-xl animate-slide-down">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-charcoal-900 dark:text-cream-50">
                {t('fileUpload.importTitle')}
              </h3>
              <button
                onClick={closeDialog}
                disabled={isImporting}
                className="p-1 hover:bg-charcoal-100 dark:hover:bg-charcoal-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-charcoal-600 dark:text-charcoal-400" />
              </button>
            </div>

            <p className="text-charcoal-600 dark:text-charcoal-300 mb-6 text-sm">
              {t('fileUpload.importDescription')}
            </p>

            {error && (
              <div className="mb-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-2 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-charcoal-700 dark:text-charcoal-200 mb-1">
                  {t('fileUpload.selectedFile')}
                </label>
                <input
                  type="text"
                  value={selectedFile.split(/[\\/]/).pop() || ''}
                  disabled
                  className="w-full px-3 py-2 text-sm bg-cream-50 dark:bg-charcoal-900 border border-charcoal-200 dark:border-charcoal-700 rounded-lg text-charcoal-700 dark:text-charcoal-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal-700 dark:text-charcoal-200 mb-1">
                  {t('fileUpload.selectChampion')}{' '}
                  <span className="text-charcoal-500 dark:text-charcoal-400 font-normal">
                    (Optional)
                  </span>
                </label>
                <select
                  value={selectedChampion}
                  onChange={(e) => setSelectedChampion(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-cream-50 dark:bg-charcoal-900 border border-charcoal-200 dark:border-charcoal-700 rounded-lg text-charcoal-700 dark:text-charcoal-200 focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                >
                  <option value="">{t('fileUpload.championPlaceholder')}</option>
                  {champions.map((champion) => (
                    <option key={champion.key} value={champion.key}>
                      {champion.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal-700 dark:text-charcoal-200 mb-1">
                  {t('fileUpload.customName')}{' '}
                  <span className="text-charcoal-500 dark:text-charcoal-400 font-normal">
                    (Optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={t('fileUpload.customNamePlaceholder')}
                  className="w-full px-3 py-2 text-sm bg-cream-50 dark:bg-charcoal-900 border border-charcoal-200 dark:border-charcoal-700 rounded-lg text-charcoal-700 dark:text-charcoal-200 placeholder-charcoal-400 dark:placeholder-charcoal-500 focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-charcoal-700 dark:text-charcoal-200 mb-1">
                  {t('fileUpload.previewImage')}{' '}
                  <span className="text-charcoal-500 dark:text-charcoal-400 font-normal">
                    (Optional)
                  </span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedImage.split(/[\\/]/).pop() || ''}
                    disabled
                    placeholder={t('fileUpload.noImageSelected')}
                    className="flex-1 px-3 py-2 text-sm bg-cream-50 dark:bg-charcoal-900 border border-charcoal-200 dark:border-charcoal-700 rounded-lg text-charcoal-700 dark:text-charcoal-200 placeholder-charcoal-400 dark:placeholder-charcoal-500"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await window.api.browseImageFile()
                      if (result.success && result.filePath) {
                        setSelectedImage(result.filePath)
                      }
                    }}
                    className="px-4 py-2 text-sm bg-white dark:bg-charcoal-700 hover:bg-cream-100 dark:hover:bg-charcoal-600 text-charcoal-800 dark:text-charcoal-200 font-medium rounded-lg transition-all duration-200 border border-charcoal-200 dark:border-charcoal-600 flex items-center gap-2"
                  >
                    <Image className="h-4 w-4" />
                    {t('fileUpload.browseImage')}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={closeDialog}
                disabled={isImporting}
                className="px-4 py-2 text-sm bg-white dark:bg-charcoal-700 hover:bg-cream-100 dark:hover:bg-charcoal-600 text-charcoal-800 dark:text-charcoal-200 font-medium rounded-lg transition-all duration-200 border border-charcoal-200 dark:border-charcoal-600 disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting || !selectedFile}
                className="px-4 py-2 text-sm bg-terracotta-500 hover:bg-terracotta-600 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
        <div className="fixed inset-0 bg-charcoal-950 bg-opacity-50 dark:bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-charcoal-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl dark:shadow-dark-xl animate-slide-down">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-charcoal-900 dark:text-cream-50">
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
                className="p-1 hover:bg-charcoal-100 dark:hover:bg-charcoal-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-charcoal-600 dark:text-charcoal-400" />
              </button>
            </div>

            <div className="space-y-4">
              {isImporting ? (
                <>
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-terracotta-500" />
                    <p className="text-sm text-charcoal-600 dark:text-charcoal-300">
                      {t('fileUpload.importingProgress', {
                        current: batchProgress.current,
                        total: batchProgress.total
                      })}
                    </p>
                    <p className="text-xs text-charcoal-500 dark:text-charcoal-400 mt-1 truncate">
                      {batchProgress.currentFile}
                    </p>
                  </div>

                  <div className="w-full bg-charcoal-200 dark:bg-charcoal-700 rounded-full h-2">
                    <div
                      className="bg-terracotta-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-4">
                    <p className="text-sm text-charcoal-600 dark:text-charcoal-300">
                      {t('fileUpload.batchComplete')}
                    </p>
                    <p className="text-lg font-semibold text-charcoal-900 dark:text-cream-50 mt-2">
                      {batchProgress.results.filter((r) => r.success).length}{' '}
                      {t('fileUpload.succeeded')},{' '}
                      {batchProgress.results.filter((r) => !r.success).length}{' '}
                      {t('fileUpload.failed')}
                    </p>
                  </div>

                  {batchProgress.results.filter((r) => !r.success).length > 0 && (
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      <p className="text-xs font-medium text-charcoal-700 dark:text-charcoal-300 mb-2">
                        {t('fileUpload.failedFiles')}
                      </p>
                      {batchProgress.results
                        .filter((r) => !r.success)
                        .map((result, idx) => (
                          <div
                            key={idx}
                            className="text-xs bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-2 py-1 rounded"
                          >
                            <p className="font-medium truncate">
                              {result.filePath.split(/[\\/]/).pop()}
                            </p>
                            <p className="text-red-500 dark:text-red-500">{result.error}</p>
                          </div>
                        ))}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setShowBatchDialog(false)
                      setBatchProgress({ current: 0, total: 0, currentFile: '', results: [] })
                    }}
                    className="w-full px-4 py-2 text-sm bg-terracotta-500 hover:bg-terracotta-600 text-white font-medium rounded-lg transition-all duration-200"
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

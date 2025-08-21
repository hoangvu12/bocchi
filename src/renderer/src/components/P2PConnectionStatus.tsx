import React, { useEffect, useState } from 'react'
import { useAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { p2pConnectionStatusAtom, p2pRoomAtom } from '../store/atoms'
import { p2pService } from '../services/p2pService'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

interface ConnectionQuality {
  type: 'direct' | 'relay' | 'unknown'
  latency: number
  packetLoss: number
  bandwidth: number
}

export const P2PConnectionStatus: React.FC = () => {
  const { t } = useTranslation()
  const [connectionStatus] = useAtom(p2pConnectionStatusAtom)
  const [p2pRoom] = useAtom(p2pRoomAtom)
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality | null>(null)
  const [natType, setNatType] = useState<string>('Detecting...')
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [connectionStats, setConnectionStats] = useState(p2pService.getConnectionStats())

  useEffect(() => {
    // Update connection quality every 5 seconds
    const updateQuality = async () => {
      if (p2pService.isConnected()) {
        const quality = await p2pService.getConnectionQuality()
        setConnectionQuality(quality)
        setConnectionStats(p2pService.getConnectionStats())
      }
    }

    updateQuality()
    const interval = setInterval(updateQuality, 5000)

    return () => clearInterval(interval)
  }, [connectionStatus, p2pRoom])

  useEffect(() => {
    // Detect NAT type once when component mounts
    const detectNAT = async () => {
      const type = await p2pService.detectNATType()
      setNatType(type)
    }
    detectNAT()
  }, [])

  const getStatusColor = () => {
    if (connectionStatus === 'disconnected') return 'bg-gray-500'
    if (connectionStatus === 'connecting') return 'bg-yellow-500 animate-pulse'
    if (connectionStatus === 'connected') {
      if (connectionQuality?.type === 'direct') return 'bg-green-500'
      if (connectionQuality?.type === 'relay') return 'bg-yellow-500'
    }
    return 'bg-gray-500'
  }

  const getStatusText = () => {
    if (connectionStatus === 'disconnected') return t('p2p.status.disconnected')
    if (connectionStatus === 'connecting') return t('p2p.status.retrying')
    if (connectionStatus === 'connected') {
      // If we're alone in the room (host with no members)
      if (!p2pRoom?.members?.length && p2pRoom?.host) {
        return t('p2p.status.roomReady')
      }
      if (connectionQuality?.type === 'direct') return t('p2p.status.direct')
      if (connectionQuality?.type === 'relay') return t('p2p.status.relay')
      return t('p2p.status.connected')
    }
    return t('p2p.status.unknown')
  }

  const getConnectionTypeIcon = () => {
    if (connectionQuality?.type === 'direct') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      )
    }
    if (connectionQuality?.type === 'relay') {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      )
    }
    return null
  }

  if (!p2pRoom) return null

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShowDiagnostics(true)}
              className="flex items-center gap-2 px-3 py-1 rounded-lg bg-secondary-100 dark:bg-secondary-800 hover:bg-secondary-200 dark:hover:bg-secondary-700 transition-colors"
            >
              <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
              <span className="text-sm text-text-secondary">{getStatusText()}</span>
              {getConnectionTypeIcon()}
              {connectionQuality && (
                <span className="text-xs text-text-muted">
                  {connectionQuality.latency.toFixed(0)}ms
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1 text-xs">
              <p>
                {t('p2p.tooltip.connectionType', { type: connectionQuality?.type || 'unknown' })}
              </p>
              {connectionQuality && (
                <>
                  <p>{t('p2p.tooltip.latency', { ms: connectionQuality.latency.toFixed(0) })}</p>
                  <p>
                    {t('p2p.tooltip.packetLoss', {
                      percent: connectionQuality.packetLoss.toFixed(1)
                    })}
                  </p>
                  <p>
                    {t('p2p.tooltip.bandwidth', { mbps: connectionQuality.bandwidth.toFixed(1) })}
                  </p>
                </>
              )}
              <p className="text-text-muted mt-2">{t('p2p.tooltip.clickForDetails')}</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={showDiagnostics} onOpenChange={setShowDiagnostics}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('p2p.diagnostics.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Connection Status */}
            <div className="p-3 bg-secondary-100 dark:bg-secondary-800 rounded-lg">
              <h3 className="text-sm font-medium mb-2">{t('p2p.diagnostics.connectionStatus')}</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">{t('p2p.diagnostics.status')}:</span>
                  <span
                    className={
                      connectionStatus === 'connected' ? 'text-green-500' : 'text-yellow-500'
                    }
                  >
                    {getStatusText()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">{t('p2p.diagnostics.type')}:</span>
                  <span>
                    {!p2pRoom?.members?.length && p2pRoom?.host
                      ? t('p2p.diagnostics.waitingForPeers')
                      : connectionQuality?.type || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">{t('p2p.diagnostics.attempts')}:</span>
                  <span>{connectionStats.connectionAttempts}</span>
                </div>
              </div>
            </div>

            {/* Connection Quality */}
            {connectionQuality && (
              <div className="p-3 bg-secondary-100 dark:bg-secondary-800 rounded-lg">
                <h3 className="text-sm font-medium mb-2">{t('p2p.diagnostics.quality')}</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">{t('p2p.diagnostics.latency')}:</span>
                    <span
                      className={
                        connectionQuality.latency < 50
                          ? 'text-green-500'
                          : connectionQuality.latency < 150
                            ? 'text-yellow-500'
                            : 'text-red-500'
                      }
                    >
                      {connectionQuality.latency.toFixed(0)}ms
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">{t('p2p.diagnostics.packetLoss')}:</span>
                    <span
                      className={
                        connectionQuality.packetLoss < 1
                          ? 'text-green-500'
                          : connectionQuality.packetLoss < 5
                            ? 'text-yellow-500'
                            : 'text-red-500'
                      }
                    >
                      {connectionQuality.packetLoss.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">{t('p2p.diagnostics.bandwidth')}:</span>
                    <span>{connectionQuality.bandwidth.toFixed(1)} Mbps</span>
                  </div>
                </div>
              </div>
            )}

            {/* NAT Type */}
            <div className="p-3 bg-secondary-100 dark:bg-secondary-800 rounded-lg">
              <h3 className="text-sm font-medium mb-2">{t('p2p.diagnostics.network')}</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-muted">{t('p2p.diagnostics.natType')}:</span>
                  <span
                    className={
                      natType.includes('Symmetric')
                        ? 'text-yellow-500'
                        : natType.includes('Full Cone')
                          ? 'text-green-500'
                          : ''
                    }
                  >
                    {natType}
                  </span>
                </div>
              </div>
            </div>

            {/* Help Text */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs text-text-secondary">
                {!p2pRoom?.members?.length && p2pRoom?.host
                  ? t('p2p.diagnostics.waitingForPeers')
                  : connectionQuality?.type === 'relay'
                    ? t('p2p.diagnostics.relayHelp')
                    : connectionQuality?.type === 'direct'
                      ? t('p2p.diagnostics.directHelp')
                      : t('p2p.diagnostics.connectingHelp')}
              </p>
            </div>

            {/* Troubleshooting */}
            {(connectionStatus !== 'connected' || connectionQuality?.type === 'relay') && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <h3 className="text-sm font-medium mb-2">{t('p2p.diagnostics.troubleshooting')}</h3>
                <ul className="text-xs text-text-secondary space-y-1">
                  <li>• {t('p2p.diagnostics.tip1')}</li>
                  <li>• {t('p2p.diagnostics.tip2')}</li>
                  <li>• {t('p2p.diagnostics.tip3')}</li>
                  {natType.includes('Symmetric') && (
                    <li>• {t('p2p.diagnostics.symmetricNatWarning')}</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

import { useEffect, useCallback } from 'react'
import { useAtom } from 'jotai'
import { p2pRoomAtom, autoSyncedSkinsAtom } from '../store/atoms'
import { lcuSelectedChampionAtom, isChampionLockedAtom } from '../store/atoms/lcu.atoms'
import { championDetectionEnabledAtom, p2pAutoSyncEnabledAtom } from '../store/atoms/settings.atoms'
import { p2pService } from '../services/p2pService'
import type { AutoSyncedSkin, SelectedSkin } from '../store/atoms'

interface UseP2PChampionSyncProps {
  downloadedSkins: Array<{ championName: string; skinName: string; localPath?: string }>
  enabled?: boolean
}

export const useP2PChampionSync = ({
  downloadedSkins,
  enabled = true
}: UseP2PChampionSyncProps) => {
  const [p2pRoom] = useAtom(p2pRoomAtom)
  const [autoSyncedSkins, setAutoSyncedSkins] = useAtom(autoSyncedSkinsAtom)
  const [lcuSelectedChampion] = useAtom(lcuSelectedChampionAtom)
  const [isChampionLocked] = useAtom(isChampionLockedAtom)
  const [championDetectionEnabled] = useAtom(championDetectionEnabledAtom)
  const [p2pAutoSyncEnabled] = useAtom(p2pAutoSyncEnabledAtom)

  // Broadcast our champion selection to P2P room
  useEffect(() => {
    if (!enabled || !p2pRoom || !lcuSelectedChampion || !championDetectionEnabled) return

    const broadcastChampion = async () => {
      try {
        await p2pService.broadcastChampionSelection({
          id: lcuSelectedChampion.id,
          key: lcuSelectedChampion.key,
          name: lcuSelectedChampion.name,
          isLocked: isChampionLocked
        })
      } catch (error) {
        console.error('[P2PChampionSync] Failed to broadcast champion selection:', error)
      }
    }

    // Debounce to avoid too many updates
    const timer = setTimeout(broadcastChampion, 300)
    return () => clearTimeout(timer)
  }, [enabled, p2pRoom, lcuSelectedChampion, isChampionLocked, championDetectionEnabled])

  // Handle peer champion selection and auto-sync their skins
  const handlePeerChampionSelected = useCallback(
    ({ peerId, championData }: { peerId: string; championData: any }) => {
      if (!enabled || !championDetectionEnabled || !p2pAutoSyncEnabled) return

      // Find the peer in the room
      const allMembers = p2pRoom ? [p2pRoom.host, ...p2pRoom.members] : []
      const peer = allMembers.find((m) => m.id === peerId)
      if (!peer) return

      // Find the first non-custom skin for this champion from the peer
      const championKey = championData.key
      const peerSkinsForChampion = peer.activeSkins.filter(
        (skin) => skin.championKey === championKey && skin.championKey !== 'Custom'
      )

      // Get the first skin (could be enhanced to pick by rarity/preference)
      const peerSkinForChampion = peerSkinsForChampion[0]

      if (peerSkinForChampion) {
        // Check if this skin is already downloaded
        const isDownloaded = checkIfSkinDownloaded(peerSkinForChampion, downloadedSkins)

        // Create auto-synced skin entry
        const autoSyncedSkin: AutoSyncedSkin = {
          ...peerSkinForChampion,
          fromPeerId: peerId,
          fromPeerName: peer.name,
          isAutoSynced: true,
          championId: championData.id,
          isDownloaded
        }

        // Update auto-synced skins for this peer
        setAutoSyncedSkins((prev) => {
          const newMap = new Map(prev)
          const peerSkins = newMap.get(peerId) || []

          // Remove any previous skin for this champion from this peer
          const filteredSkins = peerSkins.filter((s) => s.championKey !== championKey)

          // Add the new skin
          newMap.set(peerId, [...filteredSkins, autoSyncedSkin])

          return newMap
        })
      }
    },
    [
      enabled,
      p2pRoom,
      championDetectionEnabled,
      p2pAutoSyncEnabled,
      downloadedSkins,
      setAutoSyncedSkins
    ]
  )

  // Listen for peer champion selection events
  useEffect(() => {
    if (!enabled || !p2pRoom) return

    const unsubscribe = p2pService.on('peer-champion-selected', handlePeerChampionSelected)
    return unsubscribe
  }, [enabled, p2pRoom, handlePeerChampionSelected])

  // Handle member leaving - clean up their auto-synced skins
  useEffect(() => {
    if (!enabled || !p2pRoom) return

    const handleMemberLeft = (peerId: string) => {
      setAutoSyncedSkins((prev) => {
        const newMap = new Map(prev)

        // TODO: Clean up downloaded files for auto-synced custom mods
        // This would require tracking which files were auto-downloaded

        // Remove the peer's skins
        newMap.delete(peerId)

        return newMap
      })
    }

    const unsubscribe = p2pService.on('member-left', handleMemberLeft)
    return unsubscribe
  }, [enabled, p2pRoom, setAutoSyncedSkins])

  // Clean up all auto-synced skins when leaving room
  useEffect(() => {
    if (!p2pRoom && autoSyncedSkins.size > 0) {
      setAutoSyncedSkins(new Map())
    }
  }, [p2pRoom, autoSyncedSkins.size, setAutoSyncedSkins])

  // Get all auto-synced skins as a flat array
  const getAllAutoSyncedSkins = useCallback((): AutoSyncedSkin[] => {
    const allSkins: AutoSyncedSkin[] = []
    autoSyncedSkins.forEach((skins) => {
      allSkins.push(...skins)
    })
    return allSkins
  }, [autoSyncedSkins])

  return {
    autoSyncedSkins: getAllAutoSyncedSkins(),
    autoSyncedSkinsMap: autoSyncedSkins
  }
}

// Helper function to check if a skin is downloaded
function checkIfSkinDownloaded(
  skin: SelectedSkin,
  downloadedSkins: Array<{ championName: string; skinName: string; localPath?: string }>
): boolean {
  // Custom skins are always "downloaded" since they're user imports
  if (skin.championKey === 'Custom') {
    return true
  }

  // Use the actual name for file checking
  const actualName = skin.lolSkinsName || skin.skinNameEn || skin.skinName
  const baseName = actualName.replace(/:/g, '')

  if (skin.chromaId) {
    const chromaFileName = `${baseName} ${skin.chromaId}.zip`
    return downloadedSkins.some(
      (ds) => ds.championName === skin.championKey && ds.skinName === chromaFileName
    )
  } else {
    const skinFileName = `${baseName}.zip`
    return downloadedSkins.some(
      (ds) => ds.championName === skin.championKey && ds.skinName === skinFileName
    )
  }
}

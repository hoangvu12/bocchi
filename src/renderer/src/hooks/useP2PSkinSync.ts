import { useEffect } from 'react'
import { useAtom } from 'jotai'
import { selectedSkinsAtom, p2pRoomAtom } from '../store/atoms'
import { useP2P } from '../contexts/P2PContext'

export const useP2PSkinSync = () => {
  const [selectedSkins] = useAtom(selectedSkinsAtom)
  const [p2pRoom] = useAtom(p2pRoomAtom)
  const { broadcastSkins } = useP2P()

  useEffect(() => {
    // Only broadcast if we're in a room
    if (!p2pRoom) return

    // Broadcast our selected skins whenever they change
    const sendSkins = () => {
      try {
        broadcastSkins(selectedSkins)
      } catch (error) {
        console.error('Failed to broadcast skins:', error)
      }
    }

    // Debounce the broadcast to avoid too many updates
    const timer = setTimeout(sendSkins, 500)

    return () => clearTimeout(timer)
  }, [selectedSkins, p2pRoom, broadcastSkins])
}

import React, { createContext, useContext, useEffect } from 'react'
import { useAtom } from 'jotai'
import { p2pRoomAtom, p2pConnectionStatusAtom } from '../store/atoms'
import { p2pService } from '../services/p2pService'
import type { P2PRoom } from '../../../main/types'

interface P2PContextValue {
  createRoom: (displayName: string) => Promise<string>
  joinRoom: (roomId: string, displayName: string) => Promise<void>
  leaveRoom: () => Promise<void>
  broadcastSkins: (skins: any[]) => void
  isConnected: boolean
}

const P2PContext = createContext<P2PContextValue | null>(null)

export const P2PProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, setP2pRoom] = useAtom(p2pRoomAtom)
  const [, setConnectionStatus] = useAtom(p2pConnectionStatusAtom)

  useEffect(() => {
    // Set up event listeners
    const unsubRoomUpdate = p2pService.on('room-updated', (room: P2PRoom | null) => {
      setP2pRoom(room)
    })

    const unsubConnStatus = p2pService.on('connection-status', (status: string) => {
      setConnectionStatus(status as any)
    })

    const unsubMemberJoined = p2pService.on('member-joined', (member: any) => {
      console.log('Member joined:', member.name)
    })

    const unsubMemberLeft = p2pService.on('member-left', (peerId: string) => {
      console.log('Member left:', peerId)
    })

    return () => {
      unsubRoomUpdate()
      unsubConnStatus()
      unsubMemberJoined()
      unsubMemberLeft()
    }
  }, [setP2pRoom, setConnectionStatus])

  const value: P2PContextValue = {
    createRoom: async (displayName: string) => {
      return await p2pService.createRoom(displayName)
    },
    joinRoom: async (roomId: string, displayName: string) => {
      await p2pService.joinRoom(roomId, displayName)
    },
    leaveRoom: async () => {
      await p2pService.leaveRoom()
    },
    broadcastSkins: (skins: any[]) => {
      p2pService.broadcastActiveSkins(skins)
    },
    isConnected: p2pService.isConnected()
  }

  return <P2PContext.Provider value={value}>{children}</P2PContext.Provider>
}

export const useP2P = () => {
  const context = useContext(P2PContext)
  if (!context) {
    throw new Error('useP2P must be used within P2PProvider')
  }
  return context
}

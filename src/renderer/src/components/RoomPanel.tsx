import React, { useState, useEffect } from 'react'
import { useAtom } from 'jotai'
import {
  p2pRoomAtom,
  p2pSettingsAtom,
  p2pConnectionStatusAtom,
  generateRandomPlayerName
} from '../store/atoms'
import { useP2P } from '../contexts/P2PContext'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Separator } from './ui/separator'

export const RoomPanel: React.FC = () => {
  const [p2pRoom] = useAtom(p2pRoomAtom)
  const [p2pSettings, setP2pSettings] = useAtom(p2pSettingsAtom)
  const [connectionStatus] = useAtom(p2pConnectionStatusAtom)
  const [showModal, setShowModal] = useState(false)
  const [roomIdInput, setRoomIdInput] = useState('')
  const [displayNameInput, setDisplayNameInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { createRoom, joinRoom, leaveRoom } = useP2P()

  // Initialize display name on first render
  useEffect(() => {
    if (!p2pSettings.displayName || p2pSettings.displayName === 'Player') {
      const randomName = generateRandomPlayerName()
      setDisplayNameInput(randomName)
      setP2pSettings({ ...p2pSettings, displayName: randomName })
    } else {
      setDisplayNameInput(p2pSettings.displayName)
    }
  }, [p2pSettings, setP2pSettings])

  const handleCreateRoom = async () => {
    setLoading(true)
    setError(null)
    try {
      await createRoom(displayNameInput)
      setP2pSettings({ ...p2pSettings, displayName: displayNameInput })
      setShowModal(false)
    } catch (err) {
      setError(`Failed to create room ${err}`)
    }
    setLoading(false)
  }

  const handleJoinRoom = async () => {
    if (!roomIdInput.trim()) {
      setError('Please enter a room ID')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await joinRoom(roomIdInput.toUpperCase(), displayNameInput)
      setP2pSettings({ ...p2pSettings, displayName: displayNameInput })
      setShowModal(false)
    } catch (err) {
      setError(`Failed to join room ${err}`)
    }
    setLoading(false)
  }

  const handleLeaveRoom = async () => {
    await leaveRoom()
  }

  const copyRoomId = () => {
    if (p2pRoom) {
      navigator.clipboard.writeText(p2pRoom.id)
    }
  }

  const totalMembers = p2pRoom ? 1 + p2pRoom.members.length : 0

  if (!p2pRoom) {
    return (
      <>
        <Button
          onClick={() => setShowModal(true)}
          className="bg-terracotta-500 hover:bg-terracotta-600"
        >
          Join/Create Room
        </Button>

        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>P2P Room</DialogTitle>
              <DialogDescription>
                Create a new room or join an existing one to share skins with others.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  type="text"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>

              <Separator />
              <div>
                <h3 className="font-medium mb-3 text-charcoal-900 dark:text-charcoal-100">
                  Create a New Room
                </h3>
                <Button
                  onClick={handleCreateRoom}
                  disabled={loading || !displayNameInput.trim()}
                  className="w-full bg-terracotta-500 hover:bg-terracotta-600"
                >
                  {loading ? 'Creating...' : 'Create Room'}
                </Button>
              </div>

              <Separator />
              <div>
                <h3 className="font-medium mb-3 text-charcoal-900 dark:text-charcoal-100">
                  Join Existing Room
                </h3>
                <Input
                  type="text"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                  placeholder="Enter room ID (e.g., ABC123)"
                  maxLength={6}
                  className="mb-2"
                />
                <Button
                  onClick={handleJoinRoom}
                  disabled={loading || !displayNameInput.trim() || !roomIdInput.trim()}
                  className="w-full bg-terracotta-500 hover:bg-terracotta-600"
                >
                  {loading ? 'Joining...' : 'Join Room'}
                </Button>
              </div>

              {error && <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>}
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-cream-50 dark:bg-charcoal-800 rounded-lg">
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' : 'bg-yellow-500'
          }`}
        />
        <span className="text-sm font-medium text-charcoal-700 dark:text-charcoal-300">
          Room: {p2pRoom.id}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={copyRoomId}
          className="h-8 w-8"
          title="Copy room ID"
        >
          <svg
            className="w-4 h-4 text-charcoal-600 dark:text-charcoal-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </Button>
      </div>
      <span className="text-sm text-charcoal-600 dark:text-charcoal-400">
        ({totalMembers} {totalMembers === 1 ? 'member' : 'members'})
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLeaveRoom}
        className="ml-auto text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
      >
        Leave
      </Button>
    </div>
  )
}

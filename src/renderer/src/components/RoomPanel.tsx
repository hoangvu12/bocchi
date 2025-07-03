import React, { useState, useEffect } from 'react'
import { useAtom } from 'jotai'
import {
  p2pRoomAtom,
  p2pSettingsAtom,
  p2pConnectionStatusAtom,
  generateRandomPlayerName
} from '../store/atoms'
import { useP2P } from '../contexts/P2PContext'

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
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 text-sm font-medium bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-lg transition-colors"
        >
          Join/Create Room
        </button>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-charcoal-800 rounded-lg p-6 w-96 max-w-[90vw]">
              <h2 className="text-xl font-bold mb-4 text-charcoal-900 dark:text-charcoal-100">
                P2P Room
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-charcoal-700 dark:text-charcoal-300">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    className="w-full px-3 py-2 border border-charcoal-300 dark:border-charcoal-600 rounded-lg bg-white dark:bg-charcoal-900 text-charcoal-900 dark:text-charcoal-100"
                    placeholder="Enter your name"
                  />
                </div>

                <div className="border-t border-charcoal-200 dark:border-charcoal-700 pt-4">
                  <h3 className="font-medium mb-3 text-charcoal-900 dark:text-charcoal-100">
                    Create a New Room
                  </h3>
                  <button
                    onClick={handleCreateRoom}
                    disabled={loading || !displayNameInput.trim()}
                    className="w-full px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 disabled:bg-charcoal-400 text-white rounded-lg transition-colors"
                  >
                    {loading ? 'Creating...' : 'Create Room'}
                  </button>
                </div>

                <div className="border-t border-charcoal-200 dark:border-charcoal-700 pt-4">
                  <h3 className="font-medium mb-3 text-charcoal-900 dark:text-charcoal-100">
                    Join Existing Room
                  </h3>
                  <input
                    type="text"
                    value={roomIdInput}
                    onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-charcoal-300 dark:border-charcoal-600 rounded-lg bg-white dark:bg-charcoal-900 text-charcoal-900 dark:text-charcoal-100 mb-2"
                    placeholder="Enter room ID (e.g., ABC123)"
                    maxLength={6}
                  />
                  <button
                    onClick={handleJoinRoom}
                    disabled={loading || !displayNameInput.trim() || !roomIdInput.trim()}
                    className="w-full px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 disabled:bg-charcoal-400 text-white rounded-lg transition-colors"
                  >
                    {loading ? 'Joining...' : 'Join Room'}
                  </button>
                </div>

                {error && <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>}

                <button
                  onClick={() => setShowModal(false)}
                  className="w-full px-4 py-2 text-charcoal-600 dark:text-charcoal-400 hover:text-charcoal-900 dark:hover:text-charcoal-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
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
        <button
          onClick={copyRoomId}
          className="p-1 hover:bg-charcoal-200 dark:hover:bg-charcoal-700 rounded transition-colors"
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
        </button>
      </div>
      <span className="text-sm text-charcoal-600 dark:text-charcoal-400">
        ({totalMembers} {totalMembers === 1 ? 'member' : 'members'})
      </span>
      <button
        onClick={handleLeaveRoom}
        className="ml-auto px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
      >
        Leave
      </button>
    </div>
  )
}

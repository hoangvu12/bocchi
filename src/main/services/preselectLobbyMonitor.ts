import { EventEmitter } from 'events'
import { lcuConnector } from './lcuConnector'
import { gameflowMonitor } from './gameflowMonitor'

// Queue IDs for modes with preselected champions
const PRESELECT_CHAMPION_QUEUE_IDS = [
  430, // Normal (Blind Pick)
  480, // Swiftplay
  490, // Quickplay
  830 // Intro
]

enum SwiftplayState {
  IDLE = 'idle',
  LOBBY_SELECTING = 'selecting',
  LOBBY_QUEUED = 'queued',
  MATCH_FOUND = 'found',
  TRANSITIONING_TO_GAME = 'transitioning'
}

interface ChampionSelection {
  summonerInternalName: string
  championId: number
  championKey?: string
  isLocalPlayer?: boolean
}

interface ChampionSnapshot {
  timestamp: number
  queueId: number
  champions: ChampionSelection[]
  searchState: string
  gameflowPhase: string
}

interface MatchmakingSearchState {
  searchState: 'Invalid' | 'Searching' | 'Found' | 'Canceled' | 'Error'
  timeInQueue?: number
  estimatedQueueTime?: number
}

export class PreselectLobbyMonitor extends EventEmitter {
  private currentState: SwiftplayState = SwiftplayState.IDLE
  private currentQueueId: number | null = null
  private currentChampions: ChampionSelection[] = []
  private championSnapshot: ChampionSnapshot | null = null
  private matchmakingState: MatchmakingSearchState | null = null
  private monitoringActive: boolean = false
  private lastEmittedChampions: string = ''
  private preselectDetected: boolean = false
  private autoApplyTriggered: boolean = false

  constructor() {
    super()
    this.setupEventListeners()
  }

  async start(): Promise<void> {
    this.monitoringActive = true
    console.log('[PreselectLobbyMonitor] Started monitoring')

    // Check current state on startup
    const currentPhase = gameflowMonitor.getCurrentPhase()
    if (currentPhase === 'Lobby') {
      await this.checkForPreselectMode()
    }
  }

  stop(): void {
    this.monitoringActive = false
    this.resetState()
    console.log('[PreselectLobbyMonitor] Stopped monitoring')
  }

  private setupEventListeners(): void {
    // Listen for phase changes
    gameflowMonitor.on('phase-changed', async (phase: string, previousPhase: string) => {
      if (!this.monitoringActive) return

      console.log(`[PreselectLobbyMonitor] Phase changed: ${previousPhase} → ${phase}`)

      switch (phase) {
        case 'Lobby':
          if (previousPhase !== 'Lobby') {
            await this.handleEnterLobby()
          }
          break

        case 'Matchmaking':
          await this.handleEnterMatchmaking()
          break

        case 'ReadyCheck':
          await this.handleReadyCheck()
          break

        case 'GameStart':
        case 'InProgress':
          await this.handleGameStart()
          break

        default:
          if (!['Lobby', 'Matchmaking', 'ReadyCheck'].includes(phase)) {
            this.resetState()
          }
          break
      }
    })

    // Listen for LCU connection events
    lcuConnector.on('connected', () => {
      if (this.monitoringActive) {
        this.start()
      }
    })

    lcuConnector.on('disconnected', () => {
      this.resetState()
    })
  }

  private async handleEnterLobby(): Promise<void> {
    console.log('[PreselectLobbyMonitor] Entered lobby, checking for preselect mode')
    this.currentState = SwiftplayState.LOBBY_SELECTING
    await this.checkForPreselectMode()
  }

  private async handleEnterMatchmaking(): Promise<void> {
    if (!this.preselectDetected) return

    console.log('[PreselectLobbyMonitor] Entered matchmaking in preselect mode')
    this.currentState = SwiftplayState.LOBBY_QUEUED

    // For Swiftplay, champion data might become available when entering matchmaking
    if (this.currentQueueId === 480) {
      await this.checkForSwiftplayChampions()
    }

    // Take snapshot of current champions
    await this.takeChampionSnapshot()

    // Start monitoring matchmaking state
    this.monitorMatchmakingState()
  }

  private async handleReadyCheck(): Promise<void> {
    if (!this.preselectDetected) return

    console.log('[PreselectLobbyMonitor] Ready check phase - triggering smart apply')
    this.currentState = SwiftplayState.MATCH_FOUND
    this.emit('match-found', this.championSnapshot)

    // Trigger auto-apply during ready check phase (earlier than game start)
    if (this.championSnapshot && !this.autoApplyTriggered) {
      console.log(
        '[PreselectLobbyMonitor] Emitting ready-for-preselect-apply event during ready check'
      )
      this.emit('ready-for-preselect-apply', this.championSnapshot)
      this.autoApplyTriggered = true
    }
  }

  private async handleGameStart(): Promise<void> {
    if (!this.preselectDetected || !this.championSnapshot) return

    console.log('[PreselectLobbyMonitor] Game starting')
    this.currentState = SwiftplayState.TRANSITIONING_TO_GAME

    // Only emit if we haven't triggered during matchmaking (fallback)
    if (!this.autoApplyTriggered) {
      console.log('[PreselectLobbyMonitor] Emitting ready-for-preselect-apply event as fallback')
      this.emit('ready-for-preselect-apply', this.championSnapshot)
      this.autoApplyTriggered = true
    }

    // Reset after applying
    this.resetState()
  }

  private async checkForPreselectMode(): Promise<void> {
    try {
      const gameflowSession = await lcuConnector.getGameflowSession()
      if (!gameflowSession) return

      const queueId = gameflowSession.gameData?.queue?.id
      const skipChampionSelect = gameflowSession.skipChampionSelect
      const playerChampionSelections = gameflowSession.gameData?.playerChampionSelections

      // Debug: Log Swiftplay detection info
      if (queueId === 480) {
        console.log('[PreselectLobbyMonitor] Swiftplay detection:', {
          queueId,
          skipChampionSelect,
          selectionsLength: playerChampionSelections?.length || 0
        })
      }

      // Check if this is a preselect queue
      const isPreselectQueue = queueId && PRESELECT_CHAMPION_QUEUE_IDS.includes(queueId)
      const hasPreselectedChampions =
        Array.isArray(playerChampionSelections) && playerChampionSelections.length > 0

      // For Swiftplay (queue 480), we should detect preselect mode even if champions aren't immediately available
      if (isPreselectQueue) {
        if (skipChampionSelect || hasPreselectedChampions || queueId === 480) {
          console.log(`[PreselectLobbyMonitor] Preselect mode detected for queue ${queueId}`)
          this.preselectDetected = true
          this.currentQueueId = queueId

          // Extract and monitor champions
          await this.updateChampionSelections(playerChampionSelections || [])

          // Start periodic monitoring for champion updates
          this.startChampionMonitoring()

          this.emit('preselect-mode-detected', {
            queueId,
            champions: this.currentChampions
          })
        } else {
          console.log(
            `[PreselectLobbyMonitor] Not a preselect mode: queueId=${queueId}, skip=${skipChampionSelect}, selections=${playerChampionSelections?.length || 0}`
          )
          this.preselectDetected = false
        }
      } else {
        console.log(`[PreselectLobbyMonitor] Not a preselect queue: queueId=${queueId}`)
        this.preselectDetected = false
      }
    } catch (error) {
      console.error('[PreselectLobbyMonitor] Error checking preselect mode:', error)
    }
  }

  private async updateChampionSelections(playerChampionSelections: any[]): Promise<void> {
    const newChampions: ChampionSelection[] = playerChampionSelections.map((selection) => ({
      summonerInternalName: selection.summonerInternalName || '',
      championId: selection.championId || 0,
      championKey: selection.championKey,
      isLocalPlayer: selection.isLocalPlayer
    }))

    // Filter out champions with ID 0 (not selected)
    const validChampions = newChampions.filter((champ) => champ.championId > 0)

    const championsKey = JSON.stringify(
      validChampions.map((c) => ({ id: c.championId, name: c.summonerInternalName }))
    )

    if (championsKey !== this.lastEmittedChampions) {
      console.log(
        `[PreselectLobbyMonitor] Champions updated:`,
        validChampions.map((c) => `${c.summonerInternalName}:${c.championId}`).join(', ')
      )

      this.currentChampions = validChampions
      this.lastEmittedChampions = championsKey

      this.emit('champions-changed', validChampions)
    }
  }

  private startChampionMonitoring(): void {
    // Poll for champion changes every 2 seconds while in lobby
    const monitorInterval = setInterval(async () => {
      if (!this.preselectDetected || this.currentState !== SwiftplayState.LOBBY_SELECTING) {
        clearInterval(monitorInterval)
        return
      }

      try {
        const gameflowSession = await lcuConnector.getGameflowSession()

        if (gameflowSession?.gameData?.playerChampionSelections) {
          await this.updateChampionSelections(gameflowSession.gameData.playerChampionSelections)
        }

        // For Swiftplay, also try to get lobby data as an alternative source
        if (this.currentQueueId === 480 && this.currentChampions.length === 0) {
          const lobbyData = await lcuConnector.getLobbyData()
          if (lobbyData?.gameConfig?.customTeam100) {
            // Check lobby data for Swiftplay champions
          }
        }
      } catch (error) {
        console.error('[PreselectLobbyMonitor] Error monitoring champions:', error)
      }
    }, 2000)
  }

  private async checkForSwiftplayChampions(): Promise<void> {
    try {
      // Try to get matchmaking search state data
      const searchState = await lcuConnector.getMatchmakingSearchState()
      console.log('[PreselectLobbyMonitor] Swiftplay matchmaking search state:', searchState)

      // Try to get more detailed gameflow session again
      const gameflowSession = await lcuConnector.getGameflowSession()
      if (gameflowSession) {
        console.log('[PreselectLobbyMonitor] Swiftplay gameflow in matchmaking:', {
          phase: gameflowSession.phase,
          playerChampionSelections: gameflowSession.gameData?.playerChampionSelections,
          teamOne: gameflowSession.gameData?.teamOne,
          teamTwo: gameflowSession.gameData?.teamTwo
        })

        // Check if champion data is now available
        if (gameflowSession.gameData?.playerChampionSelections?.length > 0) {
          console.log('[PreselectLobbyMonitor] Found champions in matchmaking phase!')
          await this.updateChampionSelections(gameflowSession.gameData.playerChampionSelections)
        }
      }

      // Try alternative endpoint - lobby data for champion slots
      const lobbyData = await lcuConnector.getLobbyData()
      if (lobbyData?.localMember?.playerSlots?.length > 0) {
        console.log(
          '[PreselectLobbyMonitor] Found Swiftplay champion slots:',
          lobbyData.localMember.playerSlots.length
        )

        // Extract champions from playerSlots
        const championSelections: ChampionSelection[] = []
        for (const slot of lobbyData.localMember.playerSlots) {
          if (slot.championId && slot.championId > 0) {
            championSelections.push({
              summonerInternalName: lobbyData.localMember.summonerInternalName || 'local',
              championId: slot.championId,
              championKey: slot.championKey,
              isLocalPlayer: true
            })
          }
        }

        if (championSelections.length > 0) {
          console.log(
            '[PreselectLobbyMonitor] Extracted Swiftplay champions:',
            championSelections.map((c) => c.championId)
          )
          await this.updateChampionSelections(championSelections)
        }
      }
    } catch (error) {
      console.error('[PreselectLobbyMonitor] Error checking Swiftplay champions:', error)
    }
  }

  private async takeChampionSnapshot(): Promise<void> {
    if (this.currentChampions.length === 0) {
      console.log('[PreselectLobbyMonitor] No champions to snapshot')
      return
    }

    this.championSnapshot = {
      timestamp: Date.now(),
      queueId: this.currentQueueId!,
      champions: [...this.currentChampions],
      searchState: 'Searching',
      gameflowPhase: 'Matchmaking'
    }

    console.log(
      `[PreselectLobbyMonitor] Champion snapshot taken:`,
      this.championSnapshot.champions
        .map((c) => `${c.summonerInternalName}:${c.championId}`)
        .join(', ')
    )

    this.emit('snapshot-taken', this.championSnapshot)
  }

  private async monitorMatchmakingState(): Promise<void> {
    const checkMatchmakingState = async () => {
      if (!this.preselectDetected || this.currentState === SwiftplayState.IDLE) {
        return
      }

      try {
        const searchState = await lcuConnector.getMatchmakingSearchState()
        if (searchState) {
          const previousState = this.matchmakingState?.searchState
          this.matchmakingState = searchState

          // Trigger auto-apply when in Searching or Found state
          if (
            (searchState.searchState === 'Searching' || searchState.searchState === 'Found') &&
            this.championSnapshot &&
            !this.autoApplyTriggered
          ) {
            console.log(
              `[PreselectLobbyMonitor] Auto-applying during ${searchState.searchState} state`
            )
            this.emit('ready-for-preselect-apply', this.championSnapshot)
            this.autoApplyTriggered = true
          }

          // Handle state transitions
          if (searchState.searchState === 'Found' && previousState === 'Searching') {
            console.log('[PreselectLobbyMonitor] Match found!')
            this.currentState = SwiftplayState.MATCH_FOUND
            this.emit('match-found', this.championSnapshot)
          } else if (
            searchState.searchState === 'Canceled' ||
            searchState.searchState === 'Invalid'
          ) {
            console.log('[PreselectLobbyMonitor] Queue cancelled, resetting state')
            this.currentState = SwiftplayState.LOBBY_SELECTING
            this.championSnapshot = null

            // If auto-apply was triggered, emit cancellation to stop the patcher
            if (this.autoApplyTriggered) {
              this.emit('cancel-preselect-apply')
            }

            this.autoApplyTriggered = false
            this.emit('queue-cancelled')
          }
        }
      } catch (error) {
        console.error('[PreselectLobbyMonitor] Error checking matchmaking state:', error)
      }

      // Continue monitoring if still relevant
      if (
        this.preselectDetected &&
        [SwiftplayState.LOBBY_QUEUED, SwiftplayState.MATCH_FOUND].includes(this.currentState)
      ) {
        setTimeout(checkMatchmakingState, 1000)
      }
    }

    // Start monitoring
    checkMatchmakingState()
  }

  private resetState(): void {
    console.log('[PreselectLobbyMonitor] Resetting state')
    this.currentState = SwiftplayState.IDLE
    this.currentQueueId = null
    this.currentChampions = []
    this.championSnapshot = null
    this.matchmakingState = null
    this.lastEmittedChampions = ''
    this.preselectDetected = false
    this.autoApplyTriggered = false
    this.emit('state-reset')
  }

  // Public getters
  getCurrentState(): SwiftplayState {
    return this.currentState
  }

  getCurrentChampions(): ChampionSelection[] {
    return [...this.currentChampions]
  }

  getChampionSnapshot(): ChampionSnapshot | null {
    return this.championSnapshot ? { ...this.championSnapshot } : null
  }

  isPreselectModeDetected(): boolean {
    return this.preselectDetected
  }

  getCurrentQueueId(): number | null {
    return this.currentQueueId
  }
}

// Singleton instance
export const preselectLobbyMonitor = new PreselectLobbyMonitor()

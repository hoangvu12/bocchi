import { EventEmitter } from 'events'
import { lcuConnector } from './lcuConnector'
import { gameflowMonitor } from './gameflowMonitor'

interface TeamMember {
  cellId: number
  championId: number
  assignedPosition: string
  summonerId: number
}

interface ChampSelectSession {
  timer: {
    phase: string
    adjustedTimeLeftInPhase: number
  }
  actions: Array<
    Array<{
      id: number
      type: string
      championId: number
      completed: boolean
    }>
  >
  myTeam: TeamMember[]
  localPlayerCellId: number
}

interface TeamComposition {
  championIds: number[]
  allLocked: boolean
  inFinalization: boolean
  timeLeft: number
}

export class TeamCompositionMonitor extends EventEmitter {
  private currentSession: ChampSelectSession | null = null
  private lastEmittedComposition: string = ''
  private monitoringActive: boolean = false
  private hasEmittedReadyForThisPhase: boolean = false

  constructor() {
    super()
    this.setupEventListeners()
  }

  async start(): Promise<void> {
    this.monitoringActive = true

    // Check if we're already in champ select
    const currentPhase = gameflowMonitor.getCurrentPhase()
    if (currentPhase === 'ChampSelect') {
      const session = await lcuConnector.getChampSelectSession()
      if (session) {
        this.handleSessionUpdate(session)
      }
    }
  }

  stop(): void {
    this.monitoringActive = false
    this.currentSession = null
    this.lastEmittedComposition = ''
    this.hasEmittedReadyForThisPhase = false
  }

  private setupEventListeners(): void {
    // Listen for champion select session updates
    lcuConnector.on('champ-select-session', (session: ChampSelectSession) => {
      if (this.monitoringActive) {
        this.handleSessionUpdate(session)
      }
    })

    // Listen for phase changes
    gameflowMonitor.on('phase-changed', (phase: string) => {
      if (phase !== 'ChampSelect') {
        // Reset when leaving champ select
        this.currentSession = null
        this.lastEmittedComposition = ''
        this.hasEmittedReadyForThisPhase = false
        // Include the phase we're transitioning to in the event
        this.emit('team-reset', phase)
      }
    })

    // Handle connection events
    lcuConnector.on('connected', () => {
      if (this.monitoringActive) {
        this.start()
      }
    })

    lcuConnector.on('disconnected', () => {
      this.currentSession = null
      this.lastEmittedComposition = ''
      this.hasEmittedReadyForThisPhase = false
    })
  }

  private handleSessionUpdate(session: ChampSelectSession): void {
    this.currentSession = session

    // Log the raw session data
    console.log('[TeamCompositionMonitor] Session update received:', {
      phase: session.timer?.phase,
      myTeam: session.myTeam.map((member) => ({
        cellId: member.cellId,
        championId: member.championId,
        assignedPosition: member.assignedPosition
      })),
      localPlayerCellId: session.localPlayerCellId
    })

    // Extract team champion IDs (excluding 0 which means not picked)
    const championIds = session.myTeam.map((member) => member.championId).filter((id) => id > 0)

    console.log('[TeamCompositionMonitor] Extracted champion IDs:', championIds)

    // Check if all champions are locked (5 non-zero champion IDs)
    const allLocked = championIds.length === 5

    // Check if we're in finalization phase
    const inFinalization = session.timer?.phase === 'FINALIZATION'

    // Also check if all actions are completed as backup
    const allActionsCompleted =
      session.actions?.every((phase) => phase.every((action) => action.completed)) ?? false

    console.log('[TeamCompositionMonitor] Status:', {
      allLocked,
      inFinalization,
      allActionsCompleted,
      timerPhase: session.timer?.phase,
      timeLeft: session.timer?.adjustedTimeLeftInPhase
    })

    const composition: TeamComposition = {
      championIds,
      allLocked,
      inFinalization: inFinalization || (allLocked && allActionsCompleted),
      timeLeft: session.timer?.adjustedTimeLeftInPhase
    }

    // Emit only if composition changed
    const compositionKey = JSON.stringify(composition)
    if (compositionKey !== this.lastEmittedComposition) {
      // Reset ready flag if team composition changed during finalization
      if (this.lastEmittedComposition !== '' && composition.inFinalization) {
        this.hasEmittedReadyForThisPhase = false
        console.log(
          '[TeamCompositionMonitor] Team composition changed in finalization, reset ready flag'
        )
      }

      this.lastEmittedComposition = compositionKey
      console.log('[TeamCompositionMonitor] Emitting composition update:', composition)
      this.emit('team-composition-updated', composition)

      // Emit special event when ready for smart apply
      // For custom games/practice tool, we might have less than 5 champions
      // So check if we're in finalization with at least 1 champion
      if (composition.inFinalization && composition.championIds.length > 0) {
        const timeLeft = session.timer?.adjustedTimeLeftInPhase || 0

        // Only emit ready when time left is 10 seconds or less
        if (timeLeft <= 10000 && !this.hasEmittedReadyForThisPhase) {
          console.log(
            '[TeamCompositionMonitor] Ready for smart apply! Time left:',
            timeLeft,
            'ms, Champions:',
            composition.championIds.length
          )
          this.hasEmittedReadyForThisPhase = true
          this.emit('ready-for-smart-apply', composition)
        } else if (timeLeft > 10000) {
          console.log(
            '[TeamCompositionMonitor] In finalization but waiting... Time left:',
            timeLeft,
            'ms'
          )
        }
      }
    } else {
      console.log('[TeamCompositionMonitor] Composition unchanged, not emitting')
    }
  }

  getCurrentTeamComposition(): TeamComposition | null {
    if (!this.currentSession) {
      return null
    }

    const championIds = this.currentSession.myTeam
      .map((member) => member.championId)
      .filter((id) => id > 0)

    const allLocked = championIds.length === 5
    const inFinalization = this.currentSession.timer?.phase === 'FINALIZATION'

    return {
      championIds,
      allLocked,
      inFinalization,
      timeLeft: this.currentSession.timer?.adjustedTimeLeftInPhase
    }
  }

  isReadyForSmartApply(): boolean {
    const composition = this.getCurrentTeamComposition()
    return composition ? composition.inFinalization && composition.championIds.length > 0 : false
  }
}

// Singleton instance
export const teamCompositionMonitor = new TeamCompositionMonitor()

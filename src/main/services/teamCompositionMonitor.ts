import { EventEmitter } from 'events'
import { lcuConnector } from './lcuConnector'
import { gameflowMonitor } from './gameflowMonitor'
import { settingsService } from './settingsService'

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
  private lastEmittedCheckpoint: number = 0

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
    this.lastEmittedCheckpoint = 0
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
        this.lastEmittedCheckpoint = 0
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
      this.lastEmittedCheckpoint = 0
    })
  }

  private handleSessionUpdate(session: ChampSelectSession): void {
    this.currentSession = session

    // Log the raw session data

    // Extract team champion IDs (excluding 0 which means not picked)
    const championIds = session.myTeam.map((member) => member.championId).filter((id) => id > 0)

    // Check if all champions are locked (5 non-zero champion IDs)
    const allLocked = championIds.length === 5

    // Check if we're in finalization phase
    const inFinalization = session.timer?.phase === 'FINALIZATION'

    // Also check if all actions are completed as backup
    const allActionsCompleted =
      session.actions?.every((phase) => phase.every((action) => action.completed)) ?? false

    const composition: TeamComposition = {
      championIds,
      allLocked,
      inFinalization: inFinalization || (allLocked && allActionsCompleted),
      timeLeft: session.timer?.adjustedTimeLeftInPhase
    }

    // Emit only if composition changed
    const compositionKey = JSON.stringify(composition)
    if (compositionKey !== this.lastEmittedComposition) {
      // Reset ready flag if team composition changed
      if (this.lastEmittedComposition !== '') {
        this.hasEmittedReadyForThisPhase = false
        this.lastEmittedCheckpoint = 0
      }

      this.lastEmittedComposition = compositionKey

      this.emit('team-composition-updated', composition)

      // Check for auto-apply conditions with multiple fallbacks
      const timeLeft = session.timer?.adjustedTimeLeftInPhase || 0

      // Multi-checkpoint system: 20s, 15s, 10s, 5s
      const checkpoints = [20000, 15000, 10000, 5000]
      // Get trigger time from settings, default to 15 seconds
      const triggerTimeSeconds = settingsService.get('autoApplyTriggerTime') || 15
      const triggerTime = Math.max(5, Math.min(30, triggerTimeSeconds)) * 1000 // Clamp between 5-30s

      // Determine if we should trigger auto-apply
      if (composition.championIds.length > 0 && timeLeft > 0) {
        // Find which checkpoint we're at
        const currentCheckpoint = checkpoints.find((cp) => timeLeft <= cp)

        // Multiple conditions for triggering auto-apply
        const shouldTrigger =
          // Time-based trigger (primary condition)
          timeLeft <= triggerTime &&
          // Original condition: in finalization phase
          (composition.inFinalization ||
            // Fallback 1: All 5 champions locked (normal game)
            composition.allLocked ||
            // Fallback 2: All actions completed with champions selected
            allActionsCompleted ||
            // Fallback 3: Custom/practice games with fewer than 5 champions
            (composition.championIds.length < 5 && timeLeft <= triggerTime)) &&
          // Haven't already triggered for this checkpoint
          (!this.hasEmittedReadyForThisPhase ||
            (currentCheckpoint && currentCheckpoint < this.lastEmittedCheckpoint))

        if (shouldTrigger) {
          this.hasEmittedReadyForThisPhase = true
          this.lastEmittedCheckpoint = currentCheckpoint || triggerTime
          this.emit('ready-for-smart-apply', composition)
        } else if (timeLeft <= 20000) {
          // Log why we're not triggering yet
        }
      }
    } else {
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

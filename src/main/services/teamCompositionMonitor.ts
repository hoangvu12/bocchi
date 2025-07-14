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
  private hasTriggeredInWindow: boolean = false
  private lastTriggerTimeLeft: number = 0
  private triggerWindowTolerance: number = 1000 // 1 second tolerance
  private currentPhase: string = ''

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
    this.hasTriggeredInWindow = false
    this.lastTriggerTimeLeft = 0
    this.currentPhase = ''
  }

  private setupEventListeners(): void {
    // Listen for champion select session updates
    lcuConnector.on('champ-select-session', (session: ChampSelectSession) => {
      if (this.monitoringActive) {
        this.handleSessionUpdate(session)
      }
    })

    // Listen for phase changes
    gameflowMonitor.on('phase-changed', (phase: string, previousPhase: string) => {
      console.log('phase-changed', phase, previousPhase)

      this.currentPhase = phase
      if (phase !== 'ChampSelect') {
        // Reset when leaving champ select
        this.currentSession = null
        this.lastEmittedComposition = ''
        this.hasTriggeredInWindow = false
        this.lastTriggerTimeLeft = 0
        // Include the phase we're transitioning to in the event
        this.emit('team-reset', phase)
      } else if (previousPhase !== 'ChampSelect') {
        // Entering champion select - reset trigger state
        this.hasTriggeredInWindow = false
        this.lastTriggerTimeLeft = 0
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
      this.hasTriggeredInWindow = false
      this.lastTriggerTimeLeft = 0
      this.currentPhase = ''
    })
  }

  private handleSessionUpdate(session: ChampSelectSession): void {
    this.currentSession = session

    // Extract team champion IDs (excluding 0 which means not picked)
    const championIds = session.myTeam.map((member) => member.championId).filter((id) => id > 0)

    // Log session update details
    console.log(
      `[TeamCompositionMonitor] Session update: phase=${session.timer?.phase}, timeLeft=${session.timer?.adjustedTimeLeftInPhase}ms, champions=[${championIds.join(',')}]`
    )

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

    // Create composition key without timeLeft for change detection
    const compositionKeyWithoutTime = JSON.stringify({
      championIds: composition.championIds,
      allLocked: composition.allLocked,
      inFinalization: composition.inFinalization
    })

    // Emit composition update only if team/state changed (not just time)
    if (compositionKeyWithoutTime !== this.lastEmittedComposition) {
      // Reset trigger window if team composition changed significantly
      if (this.lastEmittedComposition !== '') {
        try {
          const prevData = JSON.parse(this.lastEmittedComposition)
          const championsChanged =
            prevData.championIds.length !== composition.championIds.length ||
            !prevData.championIds.every((id) => composition.championIds.includes(id))

          if (championsChanged) {
            console.log(`[TeamCompositionMonitor] Champions changed, resetting trigger state`)
            this.hasTriggeredInWindow = false
            this.lastTriggerTimeLeft = 0
          }
        } catch {
          // Handle parse error gracefully
        }
      }

      this.lastEmittedComposition = compositionKeyWithoutTime
      this.emit('team-composition-updated', composition)
    }

    // Check for auto-apply conditions with time window approach (run on every update)
    const timeLeft = session.timer?.adjustedTimeLeftInPhase || 0

    // Get trigger time from settings, default to 15 seconds
    const triggerTimeSeconds = settingsService.get('autoApplyTriggerTime') || 15
    const triggerTime = Math.max(5, Math.min(30, triggerTimeSeconds)) * 1000 // Clamp between 5-30s

    // Determine if we should trigger auto-apply
    if (composition.championIds.length > 0 && timeLeft > 0) {
      // Check if we're within the trigger window
      const withinTriggerWindow = timeLeft <= triggerTime + this.triggerWindowTolerance

      // Reset trigger state if we've moved to a new time window (time increased)
      if (timeLeft > this.lastTriggerTimeLeft + 2000) {
        // Time jumped up by more than 2 seconds, likely new phase or reset
        console.log(
          `[TeamCompositionMonitor] Time jumped from ${this.lastTriggerTimeLeft}ms to ${timeLeft}ms, resetting trigger state`
        )
        this.hasTriggeredInWindow = false
      }

      // Track if we're entering finalization for the first time
      const enteringFinalization =
        composition.inFinalization &&
        (!session.timer?.phase || session.timer.phase !== this.currentPhase)

      if (enteringFinalization) {
        console.log(`[TeamCompositionMonitor] Entering finalization phase, resetting trigger state`)
        this.currentPhase = session.timer?.phase || ''
        this.hasTriggeredInWindow = false
      }

      // Multiple conditions for triggering auto-apply
      const shouldTrigger =
        // Within trigger window
        withinTriggerWindow &&
        // Haven't triggered in this window yet
        !this.hasTriggeredInWindow &&
        // Original condition: in finalization phase
        (composition.inFinalization ||
          // Fallback 1: All 5 champions locked (normal game)
          composition.allLocked ||
          // Fallback 2: All actions completed with champions selected
          allActionsCompleted ||
          // Fallback 3: Custom/practice games with fewer than 5 champions
          (composition.championIds.length < 5 && timeLeft <= triggerTime))

      if (shouldTrigger) {
        console.log(
          `[TeamCompositionMonitor] Triggering auto-apply: timeLeft=${timeLeft}ms, triggerTime=${triggerTime}ms, inFinalization=${composition.inFinalization}, allLocked=${composition.allLocked}`
        )
        this.hasTriggeredInWindow = true
        this.lastTriggerTimeLeft = timeLeft
        this.emit('ready-for-smart-apply', composition)
      } else if (withinTriggerWindow && this.hasTriggeredInWindow) {
        // Already triggered in this window
        console.log(`[TeamCompositionMonitor] Already triggered in window: timeLeft=${timeLeft}ms`)
      } else if (timeLeft <= 30000) {
        // Log why we're not triggering yet
        console.log(
          `[TeamCompositionMonitor] Not triggering: timeLeft=${timeLeft}ms, triggerTime=${triggerTime}ms, withinWindow=${withinTriggerWindow}, hasTriggered=${this.hasTriggeredInWindow}, inFinalization=${composition.inFinalization}`
        )
      }

      // Update last time for next iteration
      this.lastTriggerTimeLeft = timeLeft
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

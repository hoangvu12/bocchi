import { EventEmitter } from 'events'
import { lcuConnector } from './lcuConnector'
import { settingsService } from './settingsService'

interface ChampSelectAction {
  id: number
  actorCellId: number
  type: 'pick' | 'ban'
  championId: number
  completed: boolean
  isInProgress: boolean
}

interface ChampSelectSession {
  localPlayerCellId: number
  myTeam: Array<{
    cellId: number
    championId: number
    championPickIntent: number
  }>
  theirTeam: Array<{
    cellId: number
    championId: number
    championPickIntent: number
  }>
  bans: {
    myTeamBans: number[]
    theirTeamBans: number[]
  }
  actions: ChampSelectAction[][]
}

export class AutoBanPickService extends EventEmitter {
  private enabled = false
  private monitoringInterval: NodeJS.Timeout | null = null
  private pickChampions: number[] = []
  private banChampions: number[] = []
  private pickForce = false
  private banForce = false

  constructor() {
    super()
    this.loadSettings()
  }

  private async loadSettings(): Promise<void> {
    this.pickChampions = settingsService.get('autoPickChampions') || []
    this.banChampions = settingsService.get('autoBanChampions') || []
    this.pickForce = settingsService.get('autoPickForce') || false
    this.banForce = settingsService.get('autoBanForce') || false
  }

  async start(): Promise<void> {
    if (this.enabled) return

    this.enabled = true
    await this.loadSettings()

    // Start monitoring at 300ms intervals like the reference implementation
    this.monitoringInterval = setInterval(() => {
      this.checkAndPerformActions()
    }, 300)
  }

  stop(): void {
    if (!this.enabled) return

    this.enabled = false

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }

  async setPickChampions(championIds: number[]): Promise<void> {
    this.pickChampions = championIds
    await settingsService.set('autoPickChampions', championIds)
  }

  async setBanChampions(championIds: number[]): Promise<void> {
    this.banChampions = championIds
    await settingsService.set('autoBanChampions', championIds)
  }

  async setPickForce(force: boolean): Promise<void> {
    this.pickForce = force
    await settingsService.set('autoPickForce', force)
  }

  async setBanForce(force: boolean): Promise<void> {
    this.banForce = force
    await settingsService.set('autoBanForce', force)
  }

  private async checkAndPerformActions(): Promise<void> {
    if (!lcuConnector.isConnected()) return

    try {
      const session = await lcuConnector.getChampSelectSession()
      if (!session || !session.actions) return

      await this.handleChampSelectUpdate(session)
    } catch (error: any) {
      // Suppress 404 errors as they're expected when not in champ select
      // Only log other errors
      if (error?.httpStatus !== 404) {
        console.error('[AutoBanPickService] Error checking champ select:', error)
      }
    }
  }

  private async handleChampSelectUpdate(session: ChampSelectSession): Promise<void> {
    const pickEnabled = settingsService.get('autoPickEnabled')
    const banEnabled = settingsService.get('autoBanEnabled')

    if (!pickEnabled && !banEnabled) return

    // Find local player's pending actions
    const localActions = this.getLocalPlayerActions(session)
    if (localActions.length === 0) return

    // Sort actions: picks first, then bans
    const sortedActions = localActions.sort((a, b) => {
      if (a.type === 'pick' && b.type === 'ban') return -1
      if (a.type === 'ban' && b.type === 'pick') return 1
      return 0
    })

    for (const action of sortedActions) {
      if (action.type === 'pick' && pickEnabled && this.pickChampions.length > 0) {
        await this.handlePickAction(action, session)
      } else if (action.type === 'ban' && banEnabled && this.banChampions.length > 0) {
        await this.handleBanAction(action, session)
      }
    }
  }

  private getLocalPlayerActions(session: ChampSelectSession): ChampSelectAction[] {
    const actions: ChampSelectAction[] = []

    // Flatten actions array and find local player's incomplete actions
    for (const actionGroup of session.actions) {
      for (const action of actionGroup) {
        if (
          action.actorCellId === session.localPlayerCellId &&
          !action.completed &&
          action.isInProgress
        ) {
          actions.push(action)
        }
      }
    }

    return actions
  }

  private async handlePickAction(
    action: ChampSelectAction,
    session: ChampSelectSession
  ): Promise<void> {
    // Get all currently picked champions
    const allPicks = [
      ...session.myTeam.map((p) => p.championId).filter((id) => id > 0),
      ...session.theirTeam.map((p) => p.championId).filter((id) => id > 0)
    ]

    // Try each champion in priority order
    for (const championId of this.pickChampions) {
      // Check if already picked
      if (allPicks.includes(championId)) {
        if (this.pickForce) {
          console.log(`[AutoBanPickService] Champion ${championId} already picked, but forcing...`)
        } else {
          console.log(`[AutoBanPickService] Champion ${championId} already picked, skipping...`)
          continue
        }
      }

      try {
        await lcuConnector.performChampSelectAction(action.id, championId)
        console.log(`[AutoBanPickService] Successfully picked champion ${championId}`)
        this.emit('action-performed', { type: 'pick', championId })
        break
      } catch (error) {
        console.error(`[AutoBanPickService] Failed to pick champion ${championId}:`, error)
      }
    }
  }

  private async handleBanAction(
    action: ChampSelectAction,
    session: ChampSelectSession
  ): Promise<void> {
    // Get all currently banned champions
    const allBans = [...session.bans.myTeamBans, ...session.bans.theirTeamBans]

    // Get team intents (champions teammates want to play)
    const teamIntents = session.myTeam.map((p) => p.championPickIntent).filter((id) => id > 0)

    // Try each champion in priority order
    for (const championId of this.banChampions) {
      // Check if already banned
      if (allBans.includes(championId)) {
        console.log(`[AutoBanPickService] Champion ${championId} already banned, skipping...`)
        continue
      }

      // Check if teammate wants to play this champion
      if (teamIntents.includes(championId)) {
        if (this.banForce) {
          console.log(
            `[AutoBanPickService] Teammate wants champion ${championId}, but forcing ban...`
          )
        } else {
          console.log(`[AutoBanPickService] Teammate wants champion ${championId}, skipping ban...`)
          continue
        }
      }

      try {
        await lcuConnector.performChampSelectAction(action.id, championId)
        console.log(`[AutoBanPickService] Successfully banned champion ${championId}`)
        this.emit('action-performed', { type: 'ban', championId })
        break
      } catch (error) {
        console.error(`[AutoBanPickService] Failed to ban champion ${championId}:`, error)
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }
}

export const autoBanPickService = new AutoBanPickService()

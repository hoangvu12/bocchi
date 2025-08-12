import { ProgressTracker } from '../types/champion.types'

export class ProgressService {
  private progress: ProgressTracker = {
    total: 0,
    completed: 0,
    startTime: Date.now(),
    currentPhase: 'Initializing'
  }

  reset(): void {
    this.progress = {
      total: 0,
      completed: 0,
      startTime: Date.now(),
      currentPhase: 'Initializing'
    }
  }

  update(phase: string, completed?: number, total?: number): void {
    this.progress.currentPhase = phase
    if (completed !== undefined) this.progress.completed = completed
    if (total !== undefined) this.progress.total = total

    const percentage =
      this.progress.total > 0 ? (this.progress.completed / this.progress.total) * 100 : 0
    const elapsed = (Date.now() - this.progress.startTime) / 1000
    const rate = this.progress.completed / elapsed
    const eta =
      this.progress.total > this.progress.completed
        ? (this.progress.total - this.progress.completed) / rate
        : 0

    console.log(
      `[${phase}] Progress: ${this.progress.completed}/${this.progress.total} (${percentage.toFixed(1)}%) - ` +
        `ETA: ${eta.toFixed(0)}s - Rate: ${rate.toFixed(1)}/s`
    )
  }

  getElapsedTime(): number {
    return (Date.now() - this.progress.startTime) / 1000
  }

  getCompleted(): number {
    return this.progress.completed
  }

  getMetrics(): {
    totalTime: number
    requestRate: number
    completed: number
    total: number
  } {
    const totalTime = this.getElapsedTime()
    return {
      totalTime,
      requestRate: this.progress.completed / totalTime,
      completed: this.progress.completed,
      total: this.progress.total
    }
  }
}

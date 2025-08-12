export const PERFORMANCE_CONFIG = {
  // CDN-optimized settings (no rate limits)
  LANGUAGE_CONCURRENCY: 0, // 0 = unlimited, fetch all languages at once
  CHAMPION_CONCURRENCY_PER_LANGUAGE: 50, // 50 champions concurrent per language

  // HTTP client settings
  HTTP_POOL_SIZE: 200, // Large connection pool for CDN
  HTTP_TIMEOUT: 10000, // 10s timeout (CDN should be fast)
  HTTP_KEEP_ALIVE: true,
  HTTP_PIPELINING: 6, // HTTP/1.1 pipelining

  // Retry settings (minimal delay for CDN)
  RETRY_ATTEMPTS: 2,
  RETRY_DELAY: 100, // 100ms initial delay
  RETRY_MULTIPLIER: 2, // 100ms, 200ms

  // Progress tracking
  PROGRESS_UPDATE_INTERVAL: 100, // Update progress every 100ms

  // Memory management
  MAX_MEMORY_MB: 512, // Maximum memory usage

  // Feature flags
  USE_PARALLEL_MODE: true,
  USE_CHAMPION_LIST_CACHE: true,
  USE_HTTP2: true,

  // Batch sizes for controlled parallelism (if needed)
  FALLBACK_LANGUAGE_BATCH_SIZE: 5,
  FALLBACK_CHAMPION_BATCH_SIZE: 10
} as const

export type PerformanceConfig = typeof PERFORMANCE_CONFIG

# Bocchi Performance Optimization Plan
**Status:** Ready for Implementation
**Last Updated:** 2025-10-04
**Codex Review:** ✅ Completed with corrections applied

---

## Executive Summary

This plan addresses critical performance issues in Bocchi:
- **Backend:** 360-420 LCU requests/minute → **50-80 requests/minute** (85% reduction)
- **Frontend:** Massive atom recomputation → **Focused, minimal recalculation**
- **Expected Results:** 70-80% CPU reduction, smooth 60fps UI, stable memory

---

## Phase 1: Critical Backend Fixes (Week 1 - Days 1-3)

### 1.1 Shared LCU Request Manager ⭐ HIGH PRIORITY
**File:** `src/main/services/lcuRequestManager.ts` (NEW)
**Time:** 2-3 hours
**Risk:** Low

```typescript
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class LCURequestManager {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private inFlightRequests: Map<string, Promise<any>> = new Map()
  private defaultTTL = 500
  private requestCounts: Map<string, number> = new Map()
  private cacheHits = 0
  private cacheMisses = 0

  async request<T>(
    key: string,
    requestFn: () => Promise<T>,
    ttl: number = this.defaultTTL
  ): Promise<T> {
    // Check cache
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      this.cacheHits++
      return cached.data
    }

    // Deduplicate in-flight requests
    const inFlight = this.inFlightRequests.get(key)
    if (inFlight) {
      return inFlight
    }

    // Make request
    this.cacheMisses++
    const promise = requestFn()
    this.inFlightRequests.set(key, promise)

    try {
      const data = await promise
      this.cache.set(key, { data, timestamp: Date.now(), ttl })
      this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1)
      return data
    } finally {
      this.inFlightRequests.delete(key)
    }
  }

  clearCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear()
    } else {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) this.cache.delete(key)
      }
    }
  }

  getMetrics() {
    return {
      totalRequests: Array.from(this.requestCounts.values()).reduce((a, b) => a + b, 0),
      cacheHitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
      requestsByEndpoint: Object.fromEntries(this.requestCounts),
      cacheSize: this.cache.size
    }
  }
}

export const lcuRequestManager = new LCURequestManager()
```

**Usage in services:**
```typescript
// Before:
const session = await lcuConnector.getChampSelectSession()

// After:
const session = await lcuRequestManager.request(
  'champ-select-session',
  () => lcuConnector.getChampSelectSession(),
  300 // 300ms TTL
)
```

---

### 1.2 Fix Auto Ban/Pick Polling ⭐ HIGH PRIORITY
**File:** `src/main/services/autoBanPickService.ts`
**Time:** 30 minutes
**Risk:** Low

```typescript
// Line 60: Change interval from 300ms to 1500ms
this.monitoringInterval = setInterval(() => {
  this.checkAndPerformActions()
}, 1500) // Was 300, now 1500 (5x reduction)

// Line 96-111: Add phase check at start
private async checkAndPerformActions(): Promise<void> {
  // Early exit if not in champion select
  const phase = gameflowMonitor.getCurrentPhase()
  if (phase !== 'ChampSelect') {
    return
  }

  if (!lcuConnector.isConnected()) return

  try {
    // Use request manager for caching/deduplication
    const session = await lcuRequestManager.request(
      'champ-select-session',
      () => lcuConnector.getChampSelectSession(),
      200 // Short TTL for action-critical data
    )
    if (!session || !session.actions) return
    await this.handleChampSelectUpdate(session)
  } catch (error: any) {
    if (error?.httpStatus !== 404) {
      console.error('[AutoBanPickService] Error:', error)
    }
  }
}
```

**Impact:** 200 req/min → 40 req/min + eliminates wasteful polling

---

### 1.3 Disable Redundant Polling When WebSocket Active
**File:** `src/main/services/gameflowMonitor.ts`
**Time:** 1-2 hours
**Risk:** Medium (need thorough testing)

```typescript
// CORRECTED: Make function async (Codex caught this)
private async startChampSelectMonitoring(): Promise<void> {
  // Subscribe to WebSocket
  await lcuConnector.subscribe('OnJsonApiEvent_lol-champ-select_v1_session')

  // Get initial state
  const session = await lcuConnector.getChampSelectSession()
  if (session) {
    this.handleChampSelectUpdate(session)
  }

  // Only poll if WebSocket is having issues
  let missedUpdates = 0
  const maxMissedUpdates = 3

  lcuConnector.on('websocket-error', () => {
    missedUpdates++
    if (missedUpdates >= maxMissedUpdates && !this.sessionCheckInterval) {
      console.log('[GameflowMonitor] WebSocket unstable, enabling backup polling')
      this.startBackupPolling()
    }
  })

  lcuConnector.on('websocket-recovered', () => {
    missedUpdates = 0
    this.stopBackupPolling()
  })
}

private startBackupPolling(): void {
  if (this.sessionCheckInterval) return

  this.sessionCheckInterval = setInterval(async () => {
    if (this.currentPhase !== 'ChampSelect') {
      this.stopBackupPolling()
      return
    }

    const session = await lcuRequestManager.request(
      'champ-select-session',
      () => lcuConnector.getChampSelectSession(),
      500
    )
    if (session) {
      this.handleChampSelectUpdate(session)
    }
  }, 2000) // Less frequent backup
}

private stopBackupPolling(): void {
  if (this.sessionCheckInterval) {
    clearInterval(this.sessionCheckInterval)
    this.sessionCheckInterval = null
  }
}
```

**Impact:** Eliminates 60 req/min when WebSocket healthy

---

### 1.4 Cache Lockfile Path
**File:** `src/main/services/lcuConnector.ts`
**Time:** 1 hour
**Risk:** Low

```typescript
// Add class properties (around line 24)
private cachedLockfilePath: string | null = null
private lockfileCacheExpiry: number = 0
private readonly lockfileCacheDuration = 30000 // 30 seconds

// Update findLockfile method (line 258)
private async findLockfile(): Promise<LCUCredentials | null> {
  // Check cache first
  if (this.cachedLockfilePath && Date.now() < this.lockfileCacheExpiry) {
    try {
      const lockfileContent = await fs.promises.readFile(
        this.cachedLockfilePath,
        'utf-8'
      )
      const credentials = this.parseLockfileContent(lockfileContent)
      if (credentials) {
        return credentials
      }
    } catch {
      // Cache invalid, clear and continue
      this.cachedLockfilePath = null
    }
  }

  // Rest of existing search logic...
  const possiblePaths: string[] = []
  // ... (existing path detection code)

  for (const lockfilePath of possiblePaths) {
    try {
      const lockfileContent = await fs.promises.readFile(lockfilePath, 'utf-8')
      const credentials = this.parseLockfileContent(lockfileContent)

      if (credentials) {
        // Cache successful path
        this.cachedLockfilePath = lockfilePath
        this.lockfileCacheExpiry = Date.now() + this.lockfileCacheDuration
        return credentials
      }
    } catch {
      continue
    }
  }

  // Try process method...
  return this.findLockfileFromProcess()
}

// Add helper method
private parseLockfileContent(content: string): LCUCredentials | null {
  const parts = content.split(':')
  if (parts.length < 5) return null

  const [, , port, password, protocol] = parts
  return {
    protocol: protocol?.trim() || 'https',
    address: '127.0.0.1',
    port: parseInt(port, 10),
    username: 'riot',
    password: password.trim()
  }
}
```

**Impact:** Eliminates 15+ file system calls on reconnection

---

### 1.5 Use WebSocket State for Connection Health
**File:** `src/main/services/lcuConnector.ts`
**Time:** 1-2 hours
**Risk:** Medium

```typescript
// Replace startPolling method (line 439)
private startPolling(): void {
  let lastHeartbeat = Date.now()

  // Track WebSocket activity
  if (this.ws) {
    this.ws.on('message', () => {
      lastHeartbeat = Date.now()
    })

    this.ws.on('ping', () => {
      lastHeartbeat = Date.now()
    })
  }

  // Only test if truly stale (10 seconds without activity)
  this.pollInterval = setInterval(async () => {
    const timeSinceLastHeartbeat = Date.now() - lastHeartbeat

    if (timeSinceLastHeartbeat > 10000) {
      // Only make HTTP call if WebSocket seems dead
      const connected = await this.testConnection()
      if (!connected) {
        this.handleDisconnection()
      }
    }
  }, 5000) // Check every 5s, but only HTTP call if stale
}
```

**Impact:** 20 req/min → 2 req/min

---

## Phase 2: Frontend Critical Fixes (Week 1 - Days 4-7)

### 2.1 Split displaySkinsAtom into Focused Atoms ⭐ HIGH PRIORITY
**File:** `src/renderer/src/store/atoms/computed.atoms.ts`
**Time:** 4-6 hours
**Risk:** Medium (requires thorough testing)

**CORRECTED VERSION** (Codex feedback applied):

```typescript
import memoizeOne from 'memoize-one' // Add dependency

// 1. Create champion-to-skins lookup (expensive, cache once)
const championSkinsMapAtom = atom((get) => {
  const championData = get(championDataAtom)
  if (!championData) return new Map()

  const map = new Map<string, Array<{ champion: Champion; skin: Skin }>>()

  for (const champion of championData.champions) {
    const skins = champion.skins
      .filter(skin => skin.num !== 0)
      .map(skin => ({ champion, skin }))
    map.set(champion.key, skins)
  }

  return map
})

// 2. Base filtered skins (select champion's skins only)
export const baseFilteredSkinsAtom = atom((get) => {
  const championSkinsMap = get(championSkinsMapAtom)
  const selectedChampion = get(selectedChampionAtom)
  const selectedChampionKey = get(selectedChampionKeyAtom)

  if (!selectedChampion && selectedChampionKey === 'all') {
    // Flatten all skins
    return Array.from(championSkinsMap.values()).flat()
  } else if (selectedChampion) {
    return championSkinsMap.get(selectedChampion.key) || []
  }

  return []
})

// 3. Search filter (only active when searching)
export const searchFilteredSkinsAtom = atom((get) => {
  const skins = get(baseFilteredSkinsAtom)
  const searchQuery = get(skinSearchQueryAtom)

  if (!searchQuery.trim()) return skins

  const searchLower = searchQuery.toLowerCase()
  return skins.filter(({ skin }) =>
    skin.name.toLowerCase().includes(searchLower)
  )
})

// 4. Favorites filter (only active when enabled)
export const favoritesFilteredSkinsAtom = atom((get) => {
  const skins = get(searchFilteredSkinsAtom)
  const showFavoritesOnly = get(showFavoritesOnlyAtom)

  if (!showFavoritesOnly) return skins

  const favorites = get(favoritesAtom)
  return skins.filter(({ champion, skin }) =>
    isSkinOrChromaFavorited(favorites, champion.key, skin.id)
  )
})

// 5. Download filter
export const downloadFilteredSkinsAtom = atom((get) => {
  const skins = get(favoritesFilteredSkinsAtom)
  const filters = get(filtersAtom)

  if (filters.downloadStatus === 'all') return skins

  const downloadedSkins = get(downloadedSkinsAtom)

  return skins.filter(({ champion, skin }) => {
    const skinFileName = `${skin.nameEn || skin.name}.zip`.replace(/:/g, '')
    const isDownloaded = downloadedSkins.some(
      ds => ds.championName === champion.key && ds.skinName === skinFileName
    )
    return filters.downloadStatus === 'downloaded' ? isDownloaded : !isDownloaded
  })
})

// 6. Sorting (using memoize-one, NOT useMemo - Codex correction)
const sortSkins = memoizeOne(
  (skins: DisplaySkin[], sortBy: string) => {
    return [...skins].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return (a.skin.nameEn || a.skin.name).localeCompare(
            b.skin.nameEn || b.skin.name
          )
        case 'name-desc':
          return (b.skin.nameEn || b.skin.name).localeCompare(
            a.skin.nameEn || a.skin.name
          )
        case 'skin-asc':
          return a.skin.num - b.skin.num
        case 'skin-desc':
          return b.skin.num - a.skin.num
        // ... other cases
        default:
          return 0
      }
    })
  }
)

export const displaySkinsAtom = atom((get) => {
  const skins = get(downloadFilteredSkinsAtom)
  const filters = get(filtersAtom)

  return sortSkins(skins, filters.sortBy)
})
```

**Impact:** 80-90% reduction in recomputation

---

### 2.2 Memoize VirtualizedSkinGrid Cell ⭐ HIGH PRIORITY
**File:** `src/renderer/src/components/VirtualizedSkinGrid.tsx`
**Time:** 3-4 hours
**Risk:** Medium

**CORRECTED VERSION** (Codex feedback applied):

```typescript
// Create Maps for O(1) lookup - FIX KEY FORMAT (Codex caught this)
const downloadedSkinsMap = useMemo(() => {
  const map = new Map<string, DownloadedSkin>()
  downloadedSkins.forEach(ds => {
    // Use consistent key format: championName:skinFileName
    map.set(`${ds.championName}:${ds.skinName}`, ds)
  })
  return map
}, [downloadedSkins])

const selectedSkinsMap = useMemo(() => {
  const map = new Map<string, SelectedSkin>()
  selectedSkins.forEach(s => {
    // Use consistent key format: championKey:skinId
    map.set(`${s.championKey}:${s.skinId}`, s)
  })
  return map
}, [selectedSkins])

// Memoized cell component - PASS ALL NEEDED DATA AS PROPS (Codex correction)
const SkinGridCell = React.memo<{
  champion: Champion
  skin: Skin
  viewMode: ViewMode
  isDownloaded: boolean
  downloadedSkin: DownloadedSkin | undefined // Pass the whole object
  isSelected: boolean
  isFavorite: boolean
  loading: boolean
  onSkinClick: () => void
  onToggleFavorite: () => void
  customImageUrl?: string
}>(({
  champion,
  skin,
  viewMode,
  isDownloaded,
  downloadedSkin,
  isSelected,
  isFavorite,
  loading,
  onSkinClick,
  onToggleFavorite,
  customImageUrl
}) => {
  const imageUrl = useMemo(() =>
    getSkinImageUrl(champion.key, skin.num, skin.id, customImageUrl),
    [champion.key, skin.num, skin.id, customImageUrl]
  )

  const isUserSkin = useMemo(() =>
    downloadedSkin?.skinName?.includes('[User]') || false,
    [downloadedSkin]
  )

  // Render logic...
  return (
    <div className="...">
      {/* Card content */}
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom equality check
  return (
    prevProps.skin.id === nextProps.skin.id &&
    prevProps.champion.key === nextProps.champion.key &&
    prevProps.isDownloaded === nextProps.isDownloaded &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.loading === nextProps.loading &&
    prevProps.customImageUrl === nextProps.customImageUrl
  )
})

// In Cell callback - FIX KEY LOOKUPS (Codex correction)
const Cell = useCallback(({ columnIndex, rowIndex, style }) => {
  const index = rowIndex * columnCount + columnIndex
  if (index >= skins.length) return null

  const { champion, skin } = skins[index]
  const skinFileName = generateSkinFilename(skin)

  // Use consistent key format
  const downloadedSkin = downloadedSkinsMap.get(`${champion.key}:${skinFileName}`)
  const isDownloaded = !!downloadedSkin
  const isSelected = selectedSkinsMap.has(`${champion.key}:${skin.id}`)
  const isFavorite = favorites.has(`${champion.key}_${skin.id}_base`)

  const adjustedStyle = {
    ...style,
    left: style.left + 32,
    top: style.top + 24,
    width: style.width - 24,
    height: style.height - 24
  }

  return (
    <div style={adjustedStyle}>
      <SkinGridCell
        champion={champion}
        skin={skin}
        viewMode={viewMode}
        isDownloaded={isDownloaded}
        downloadedSkin={downloadedSkin}
        isSelected={isSelected}
        isFavorite={isFavorite}
        loading={loading}
        onSkinClick={() => onSkinClick(champion, skin)}
        onToggleFavorite={() => onToggleFavorite(champion, skin)}
        customImageUrl={customImages[downloadedSkin?.localPath || '']}
      />
    </div>
  )
}, [
  skins,
  columnCount,
  downloadedSkinsMap,
  selectedSkinsMap,
  favorites,
  viewMode,
  loading,
  onSkinClick,
  onToggleFavorite,
  customImages
])
```

**Impact:** 70-80% reduction in cell render time

---

### 2.3 Batch Custom Image Loading
**File:** Multiple files
**Time:** 2-3 hours
**Risk:** Low

**CORRECTED: Full IPC setup** (Codex caught missing preload exposure)

**Step 1: Backend handler**
```typescript
// src/main/index.ts - Add handler
ipcMain.handle('get-custom-skin-images', async (_, modPaths: string[]) => {
  const images: Record<string, string> = {}

  // Parallel processing
  await Promise.all(
    modPaths.map(async (modPath) => {
      try {
        const result = await imageService.getCustomSkinImage(modPath)
        if (result.success && result.imageUrl) {
          images[modPath] = result.imageUrl
        }
      } catch (error) {
        console.error(`Failed to load image for ${modPath}:`, error)
      }
    })
  )

  return { success: true, images }
})
```

**Step 2: Preload exposure** (Codex correction - this was missing!)
```typescript
// src/preload/index.ts - Add to exposed API
contextBridge.exposeInMainWorld('api', {
  // ... existing methods

  getCustomSkinImages: (modPaths: string[]) =>
    ipcRenderer.invoke('get-custom-skin-images', modPaths)
})
```

**Step 3: Type definitions**
```typescript
// src/preload/index.d.ts - Add type
export interface ElectronAPI {
  // ... existing types

  getCustomSkinImages: (
    modPaths: string[]
  ) => Promise<{ success: boolean; images: Record<string, string> }>
}
```

**Step 4: Renderer usage**
```typescript
// src/renderer/src/components/VirtualizedSkinGrid.tsx
useEffect(() => {
  const loadCustomImages = async () => {
    const customSkins = skins.filter(
      s => s.champion.key === 'Custom' || s.skin.id.startsWith('custom_')
    )

    if (customSkins.length === 0) return

    const modPaths = customSkins
      .map(({ champion, skin }) =>
        downloadedSkins.find(ds =>
          ds.skinName.startsWith('[User]') &&
          ds.skinName.includes(skin.name) &&
          (champion.key === 'Custom' || ds.championName === champion.key)
        )?.localPath
      )
      .filter((path): path is string => !!path)

    if (modPaths.length === 0) return

    // Single batched call
    const result = await window.api.getCustomSkinImages(modPaths)

    if (result.success) {
      setCustomImages(prev => ({
        ...prev,
        ...result.images
      }))
    }
  }

  loadCustomImages()
}, [skins, downloadedSkins])
```

**Impact:** N IPC calls → 1 batched call, 80-90% faster

---

### 2.4 Add Bounded Cache for chromaDataAtom
**File:** `src/renderer/src/store/atoms.ts`
**Time:** 1 hour
**Risk:** Low

**CORRECTED VERSION** (Codex caught mutation issue):

```typescript
// Create immutable cache helper
class LRUCache<K, V> {
  private items: Array<[K, V]> = []
  private maxSize: number

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize
  }

  get(key: K): V | undefined {
    const index = this.items.findIndex(([k]) => k === key)
    if (index === -1) return undefined

    const [, value] = this.items[index]
    // Move to end (most recently used)
    this.items.splice(index, 1)
    this.items.push([key, value])
    return value
  }

  set(key: K, value: V): LRUCache<K, V> {
    // Return NEW cache instance (immutable)
    const newCache = new LRUCache<K, V>(this.maxSize)

    // Copy existing items (excluding the key if it exists)
    newCache.items = this.items.filter(([k]) => k !== key)

    // Add new item
    newCache.items.push([key, value])

    // Trim if exceeds max
    if (newCache.items.length > this.maxSize) {
      newCache.items.shift() // Remove oldest
    }

    return newCache
  }

  toMap(): Map<K, V> {
    return new Map(this.items)
  }
}

// Atom with immutable updates (Codex correction)
export const chromaDataCacheAtom = atom<LRUCache<string, Chroma[]>>(
  new LRUCache(50)
)

// Derived atom for reading
export const chromaDataAtom = atom(
  (get) => {
    const cache = get(chromaDataCacheAtom)
    return cache.toMap()
  },
  (get, set, update: { key: string; data: Chroma[] }) => {
    const currentCache = get(chromaDataCacheAtom)
    const newCache = currentCache.set(update.key, update.data)
    set(chromaDataCacheAtom, newCache) // Set NEW cache instance
  }
)
```

**Impact:** Prevents unbounded memory growth

---

## Phase 3: Code Organization (Week 2)

### 3.1 Extract App.tsx Callbacks
**Time:** 4-6 hours
**Risk:** Low

**New files:**
```
src/renderer/src/hooks/useAutoSkinSelection.ts (460 lines extracted)
src/renderer/src/hooks/useChampionSelectEffects.ts
src/renderer/src/hooks/useOverlaySkinSelection.ts
src/renderer/src/hooks/useFileAssociationHandler.ts
```

---

### 3.2 Optimize react-window Configuration
**File:** `src/renderer/src/components/VirtualizedSkinGrid.tsx`
**Time:** 30 minutes
**Risk:** Low

```typescript
const overscanCount = useMemo(() => {
  const viewportRows = Math.ceil(containerHeight / rowHeight)
  return Math.max(2, Math.floor(viewportRows * 0.5))
}, [containerHeight, rowHeight])

<Grid
  overscanRowCount={overscanCount}
  overscanColumnCount={2}
  // ... other props
/>
```

---

## Phase 4: Monitoring & Validation (Ongoing)

### 4.1 Add Performance Monitoring
**File:** `src/renderer/src/utils/performanceMonitor.ts` (NEW)

```typescript
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()

  startMeasure(label: string): () => void {
    const start = performance.now()
    return () => {
      const duration = performance.now() - start
      const metrics = this.metrics.get(label) || []
      metrics.push(duration)

      if (metrics.length > 100) metrics.shift()
      this.metrics.set(label, metrics)

      if (duration > 16) {
        console.warn(`⚠️ Slow: ${label} took ${duration.toFixed(2)}ms`)
      }
    }
  }

  getStats(label: string) {
    const metrics = this.metrics.get(label) || []
    if (metrics.length === 0) return null

    const sum = metrics.reduce((a, b) => a + b, 0)
    return {
      avg: sum / metrics.length,
      max: Math.max(...metrics),
      min: Math.min(...metrics),
      count: metrics.length
    }
  }

  logAll(): void {
    console.table(
      Array.from(this.metrics.keys()).map(label => ({
        label,
        ...this.getStats(label)
      }))
    )
  }
}

export const perfMonitor = new PerformanceMonitor()
```

---

## Implementation Sequence (Codex Recommendation)

### ✅ Week 1 - Days 1-3: Backend
1. Phase 1.1: LCU Request Manager (2-3h)
2. Phase 1.2: Fix Auto Ban/Pick (30m)
3. Phase 1.4: Cache lockfile (1h)
4. Phase 1.5: WebSocket health (1-2h)
5. Phase 1.3: Conditional polling (1-2h)

**Test after each:** Verify request count drops, no regressions

### ✅ Week 1 - Days 4-7: Frontend Core
1. Phase 2.1: Split displaySkinsAtom (4-6h)
   - Write unit tests first
   - Deploy incrementally
2. Phase 2.2: Memoize grid cell (3-4h)
3. Phase 2.3: Batch image loading (2-3h)
4. Phase 2.4: Bounded cache (1h)

**Test after each:** Profile with React DevTools, verify smooth scrolling

### Week 2: Polish & Monitor
1. Phase 3.1: Extract App.tsx (4-6h)
2. Phase 3.2: Optimize react-window (30m)
3. Phase 4.1: Add monitoring (2h)
4. Integration testing
5. Performance regression tests

---

## Testing Strategy (Codex Recommendations)

### Unit Tests
```typescript
// Test LCURequestManager
describe('LCURequestManager', () => {
  it('should cache requests within TTL', async () => {
    let callCount = 0
    const manager = new LCURequestManager()

    const result1 = await manager.request('test', async () => {
      callCount++
      return 'data'
    }, 1000)

    const result2 = await manager.request('test', async () => {
      callCount++
      return 'data'
    }, 1000)

    expect(callCount).toBe(1)
    expect(result1).toBe(result2)
  })

  it('should deduplicate in-flight requests', async () => {
    let callCount = 0
    const manager = new LCURequestManager()

    const promise1 = manager.request('test', async () => {
      callCount++
      await new Promise(resolve => setTimeout(resolve, 100))
      return 'data'
    })

    const promise2 = manager.request('test', async () => {
      callCount++
      return 'data'
    })

    await Promise.all([promise1, promise2])
    expect(callCount).toBe(1)
  })
})

// Test atom splitting
describe('displaySkinsAtom', () => {
  it('should match current filtering behavior', () => {
    const oldResult = computeOldWay(mockData)
    const newResult = get(displaySkinsAtom)

    expect(newResult).toEqual(oldResult)
  })
})
```

### Performance Tests
```typescript
// Measure atom recomputation
describe('Performance', () => {
  it('should recompute <5 times per second', async () => {
    let computeCount = 0

    const testAtom = atom((get) => {
      computeCount++
      return get(displaySkinsAtom)
    })

    // Simulate user typing
    for (let i = 0; i < 10; i++) {
      set(skinSearchQueryAtom, 'test' + i)
      await wait(100)
    }

    expect(computeCount).toBeLessThan(50) // <5/sec
  })
})
```

### Integration Tests
- Monitor actual LCU request count over 5 minutes
- Profile champion switching time
- Measure scroll FPS with React DevTools
- Memory leak detection (heap snapshots)

---

## Expected Results

### Backend
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| LCU requests/min | 360-420 | 50-80 | **-85%** |
| Connection tests/min | 20 | 2 | **-90%** |
| Lockfile reads/connect | 15+ | 1 | **-93%** |

### Frontend
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| displaySkinsAtom recomputes/sec | 10-20 | <5 | **-75%** |
| Cell renders/scroll | All cells | Visible only | **-80%** |
| Custom image IPC calls | N (sequential) | 1 (batched) | **-90%** |

### User Experience
| Action | Before | After | Target |
|--------|--------|-------|--------|
| Champion switch | 300ms | <50ms | ✅ |
| Search keystroke | Laggy | Instant | ✅ |
| Scroll performance | Stuttery | 60fps | ✅ |
| Memory growth | Unbounded | Stable | ✅ |

---

## Risks & Mitigation

1. **Cache staleness** → Conservative TTLs (200-500ms)
2. **WebSocket-only failure** → Backup polling fallback
3. **Atom splitting bugs** → Comprehensive tests, gradual rollout
4. **Key format mismatches** → Unit tests for lookup logic (Codex caught this)
5. **Missing IPC exposure** → Checklist for preload updates (Codex caught this)

---

## Dependencies to Add

```json
{
  "dependencies": {
    "memoize-one": "^6.0.0"
  }
}
```

---

## Success Criteria

✅ LCU request rate < 100/minute
✅ Champion switching < 100ms
✅ Search typing feels instant
✅ Scroll maintains 60fps
✅ Memory stable over 1 hour session
✅ All existing tests pass
✅ No user-reported regressions

---

**Plan Status:** Ready for Implementation
**Review Status:** ✅ Approved by Codex with corrections applied
**Next Step:** Begin Phase 1.1 (LCU Request Manager)

## v1.24.1

### Features
- Pass championId directly from UI to download service for ID-based repositories
- Eliminates error-prone name→ID conversions for better reliability
- Improved URL construction for ID-based skin repositories

### Improvements
- Replace all 'any' types with proper TypeScript types across the entire codebase
- Add comprehensive type definitions (preload.types.ts, overlay.types.ts)
- Full end-to-end type safety across IPC communication
- Better IDE support with proper autocomplete and IntelliSense

### Technical Changes
- Support both 5 and 6 digit chroma IDs
- Reorder URL pattern matching for better accuracy (ID-based patterns checked before variants)
- Enhanced Preset and P2PRoomMember interfaces with proper types
- 0 TypeScript errors with strict type checking enabled

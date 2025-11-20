# v1.24.11

## Fixed
- Replaced node-7z with 7z-wasm for 100% reliable cslol-manager extraction across all user environments
- Eliminated antivirus false-positive blocking issues during tool downloads
- Removed external binary dependencies (7zip-bin, node-7z) that required ASAR unpacking
- Fixed extraction timeout issues with self-extracting archives

## Technical Changes
- Migrated to pure JavaScript/WebAssembly solution for 7z extraction
- Simplified electron-builder configuration by removing ASAR unpacking requirements
- Improved error handling and logging for extraction failures

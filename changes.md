## v1.24.3

### Bug Fixes

- Fixed champion names using internal keys (AurelionSol, Kaisa, MonkeyKing) instead of display names (Aurelion Sol, Kai'Sa, Wukong) for name-based repository URLs
- Fixed skins failing to download from name-based repositories due to incorrect directory paths
- Improved champion name matching for existing downloaded skins to support both old and new folder name formats

### Technical Changes

- Use champion display names for name-based repository URL construction
- Pass championId to repository URL construction for better ID-based repository support
- Enhanced backward compatibility with existing downloaded skins in different folder name formats

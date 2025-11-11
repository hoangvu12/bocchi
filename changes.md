## v1.24.2

### Bug Fixes

- Fixed custom skins failing to apply after v1.24.0 refactor
- Fixed custom skins not appearing in Custom section of sidebar
- Fixed repository structure detection not providing user feedback

### Improvements

- Repository structure now detected upfront when adding repositories
- Added re-detect button for manual repository structure refresh
- Improved error messages with detailed logging for skin mapping failures
- Enhanced 404 errors with specific causes and actionable suggestions

### Technical Changes

- Changed custom skin detection from string matching to property-based checks
- Added skinContextMap to preserve full SelectedSkin context in patcher
- Custom skins now appear in both Custom section and their champion's list
- Repository detection results shown to user with confidence levels

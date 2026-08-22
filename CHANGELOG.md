## [1.2.5] - 2026-08-22
### Fixed
- EXPO_PUBLIC_PROXY_URL added to eas.json production build env (was missing — caused empty flight board on real devices)
- Reverted broken AeroDataBox FIDS structure parse from commit 37ec3ea
- Fixed arrivals/departures plural endpoint in proxy/server.js

### Changed  
- Globe view is now default, list view is secondary in ServiceGlobe
- Inbound aircraft tracking added to DetailCard

### Added
- Gate change animation (scale spring + opacity flash)

## [1.2.4] - 2026-08-21 (BROKEN - do not use)
### Broken
- Commit 37ec3ea introduced wrong FIDS parse — caused empty flight board on all real devices
- Do not cherry-pick or revert to this version

## [1.2.3] - 2026-08-20
### Working baseline
- Commit 03d2980 — last known good FIDS implementation

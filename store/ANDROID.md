# Android prep (not building yet)

WaiAir is iOS-first. The codebase is structured so Android can be added without rewriting callers.

## Already cross-platform
- Push notifications via `expo-notifications`
- In-app purchases via RevenueCat (`react-native-purchases`) — set `EXPO_PUBLIC_RC_GOOGLE_KEY`
- Settings, paywall, legal, store review
- FIDS polling, cache, widgets stub

## iOS-only (skipped on Android)
- Live Activities / Dynamic Island (`liveActivitySync.ts` returns early) — included on Free
- Home screen widget (`widgetSync.ts` + `widgets/FlightHomeWidget.ts` stub) — included on Free
- Paywall copy is Pro power features only (unlimited tracks, timeline alerts, multi-airport)

## Later
- Android home widget: `react-native-android-widget` (do not install until the Android build)
- Play Console products: same IDs as App Store (`com.waiair.pro.monthly` / `yearly` / `lifetime`)

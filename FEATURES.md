# WaiAir feature inventory

Complete list of what is built in the app, grouped by area. One line per feature.

## Flight Board

- Arrivals and departures boards for a chosen airport, with live refresh.
- Yesterday / today / tomorrow day switcher for the FIDS board.
- Status chips (scheduled, delayed, boarding, en-route, landed, cancelled) with counts.
- Search by flight number, airline, city, or airport, with recent-search pills.
- Route search (origin–destination pair) and worldwide / global flight search.
- Nearby-airport results when location is available.
- Favourite airports and recent airports in the airport picker.
- Default / home airport plus “use current airport”.
- Airline logos and country-flag watermarks on rows.
- Gate badge with urgency (closing / last call) and terminal compact label.
- Flight status badge with live phase (boarding, delayed, en-route, landed).
- Reliability / on-time dot on airline rows with tap popup.
- Airport-wide delay banner when many flights are late.
- Stale-cache banner when the board is served from offline cache (“last updated X min ago”).
- Offline banner when there is no connection and cached data is shown.
- Pull-to-refresh and configurable poll interval (30s Pro, 60s, 5m).
- Infinite / paginated board load and FIDS “now” scroll-to-live-row.
- Skeleton cards and refresh overlay while loading.
- Promo / book-a-flight card on the board.
- Compact booking pass CTA to open the fare search.
- Smart search panel with autocomplete hits.
- Deep links and iOS quick actions: My Flights, scan, departures, search.
- Onboarding flow (alerts, pickup, how-it-works, home airport).

## Flight Detail Card

- Full flight header: number, airline, route, times, status, delay.
- Route hero: dark Leaflet map, great-circle path, live plane when airborne, weather chips.
- Flight stage timeline (scheduled → boarding → departed → en-route → landed).
- Gate closing banner and boarding-phase banner (open / closing / last call).
- Gate race card and full-screen gate-race walk between connecting flights.
- Turbulence forecast card on boarding / en-route flights.
- Delay prediction card (Pro) for scheduled / delayed flights.
- Luxury info panel: origin/dest weather, local time, FX rates, baggage belt.
- Country info card: language, currency, timezone, emergency, visa text, power, traffic, climate, phrases, ATM, transport, culture.
- Airport info card: Wi‑Fi, terminals, lounge names, tips, SIM notes (selected hubs).
- Aircraft info card: type, SeatGuru / Wikipedia links when type is known.
- Lounge checker (Pro): Priority Pass / DragonPass / alliance / ticket class vs hardcoded lounge list.
- Jetlag tips from origin–destination time difference.
- Immigration app tip after landing (THIM, SG Arrival Card, and similar).
- Early hotel check-in card after morning arrivals.
- Pickup mode card: drive time, leave-at, person photo, live pickup screen.
- Boarding-pass fields (seat, sequence, PNR) when a pass was scanned.
- Flight memory card after landing (save to passport / photos).
- Miles upgrade card and miles wallet.
- EU261 / AirHelp compensation banner when the route qualifies.
- Share flight: native share, story card, live link, Fly Together group.
- Book-this-flight button and in-app fare search (`BookFlightScreen`).
- Wake-up alarm control before landing (Pro).
- Runway / aircraft extras when data is present.
- Section order is scored once on open (priority + what the user viewed/dismissed).
- Affiliate sections (hotel, food, car, insurance, restaurants) exist as cards but are currently hidden from the scorer; they appear via the post-landing globe instead.

## My Flights / Tracking

- Track a flight from the board (bell) or by typing a flight number.
- Boarding-pass camera scan (PDF417 / QR / Aztec / Data Matrix / Code 128) with IATA BCBP parse.
- Manual flight-number fallback in the scanner.
- Calendar + pasted booking-email import (flight-number regex, confirm checkboxes).
- Free track limit of 3 flights; Pro / beta unlocks more.
- Live snapshot poll per tracked flight (`/flights/number`), merged over stale FIDS rows.
- Gate, delay, status, baggage, and revised-time updates stored on the track.
- Morning-of briefing card for today’s tracked trips.
- Connection-risk card: chronological dest→origin chains with green / amber / red / critical layover.
- Pickup countdown banner on My Flights when pickup is enabled.
- WhatsApp landing-message banner to a Settings pickup contact (name + phone) after a tracked flight lands; SMS fallback; tap to confirm.
- Urgent full-screen boarding and last-call overlays.
- Landed stamp overlay and after-landing welcome modal.
- Fly Together: create/join a 6-character group, share link, live member map.
- Connection checker modal (free daily quota, unlimited on Pro).
- Untrack with Live Activity end and home-widget refresh.
- Background refresh task for tracked flights when the app is not open.
- Offline cache: FIDS 24h, tracked flights 48h, stale flag on failed fetch.

## Notifications & Alerts

- Push categories: delay, gate change / assignment, boarding, gate closing, last call.
- Landed and baggage-belt assigned (foreground poll; landed pref gates baggage).
- Cancelled-flight alert.
- Smart time-to-go alerts: T‑24h, T‑3h, T‑1h, T‑30m (Pro-style `smart` flag).
- Departed and arriving-early alerts.
- Tight / critical connection push (critical &lt; 15 min layover, once per pair).
- Turbulence-ahead push plus in-app turbulence banner (once per flight + severity).
- Pickup leave-now / landing / gate-change notifications.
- Gate-race landing, delay-risk, and missed-connection notifications.
- Fly Together: member landed, delayed, everyone-here.
- Per-kind toggles: boarding, gate, delay, landed (Settings).
- Android notification channels and iOS notification permissions.
- Dedup so the same event is not pushed twice.
- Notification tap deep-links into the matching detail section (gate, globe, boarding, …).
- In-app toast for the same events while the app is open.
- Haptics on gate, boarding, last-call, and other urgent moments.
- Store-review prompt after a completed journey or second track.

## Live Activity / Widgets

- iOS Live Activity (`FlightActivity`) on Lock Screen and Dynamic Island.
- Live Activity fields: flight number, route, status, gate, countdown / timer, seat (from scanned boarding pass).
- Starts when a flight is tracked; updates on poll / boarding events; ends on land or cancel.
- Deep link from the activity to `waiair.app/flight/{number}`.
- Home-screen widget (`FlightHomeWidget`): next tracked flight(s), times, gate, terminal, delay banner.
- Widget plugin config: small / medium / large families, app group `group.com.waiair.WaiAir`.
- `NSSupportsLiveActivities` enabled in the iOS Info.plist.
- Widget help sheet in the app.
- No seat/barcode on the home widget; no SMS fallback (push + Live Activity only).

## Radar & Maps

- Radar tab: Leaflet WebView, dark English tiles, 250 km ring around the airport.
- Live aircraft from OpenSky / proxy snapshot, 15s poll, tap → `RadarFlightSheet`.
- Radar jump chips for major SEA hubs (BKK, HKT, SIN, KUL, DPS, CNX).
- Route hero map on the detail card (dark tiles, arc, weather, plane).
- Live share web page (`docs/live.html`, `waiair.app/live/{code}`) with progress bar and mini-map.
- Fly Together live map of group members.
- Pickup live screen map / leave-now UI.
- Airport map deep links (`constants/airportMaps.ts`).
- Service globe (3D-style) after landing for hotels, rides, eSIM, activities — not flown routes.
- Passport route map (`PassportRouteMap`): gold arcs between landed origin/dest, IATA dots, draw-in animation.
- Local airport catalog with coordinates (`lib/airportsDb.ts`, 200+ airports).

## After Landing

- After-landing welcome card: city, flag, local time, weather, FX, belt, taxi minutes.
- Post-landing accordion / service globe: hotels, transfer, activities, eSIM, car, bikes, luggage, compensation, flights.
- Get-into-town row with estimated taxi / Grab-style prices.
- Hotel search card (affiliate) when the landing phase is “hotel”.
- Food-after-landing and restaurant shortcuts (Grab Food, foodpanda, Uber Eats).
- Lounge + Fast Track block in the accordion for Pro when the hub has data.
- Immigration tip with official app / e-VOA links.
- Early check-in card before 11:00 local.
- Landed weather card (immediate / hotel phase).
- Jetlag tips and FX “good time to exchange” vs 30-day average.
- Baggage belt poll for ~45 minutes after landing.
- Landed stamp overlay and flight memory card (save image / add to passport).
- Pickup mode: when to leave home, person photo, surprise-welcome copy.
- Need-a-car / things-to-do / travel-insurance cards exist for affiliate use.

## Flight Passport

- Auto-save a passport entry when a tracked flight lands (route, times, km, duration, coords).
- Merge from Pro flight history if a passport entry is missing.
- Stats: flights, kilometres, air time, countries, airports, airlines.
- Passport tab cover on My Flights (flights + km) opening the full-screen passport.
- Stamp list with flags, flight number, clocks, delay, distance.
- Share art + `QuickShareRow` (image capture of the passport card).
- World route map above the stats (gold arcs, airport dots, sequential draw).
- Settings shortcut “My Flight Passport”.
- Dev-only seed button to load a test flight into the passport.

## Settings & Preferences

- Language picker (en, nl, zh, th, de, ru, ja, ko, vi, id, es) with split-flap board.
- Style themes and country themes (some style themes locked to Pro).
- Default airport and “use current airport”.
- Temperature °C / °F and 12h / 24h clocks.
- Notification master toggles (boarding, gate, delay, landed) + link to system settings.
- Refresh interval 30s / 60s / 5m (30s is Pro).
- Offline-data switch.
- Clear cache (keeps tracks, prefs, Pro, and user data).
- Account: Free vs Pro status, manage subscription, restore purchases.
- About: version/build, privacy, terms, rate app, contact `support@waiair.app`.
- Partner tile for Saved Souls Foundation.
- Follow @waiair on TikTok.
- Onboarding seen flag and last board-day persistence.

## Pro Features

- RevenueCat entitlement `WaiAir Pro` (monthly, yearly, lifetime products).
- More than 3 tracked flights (free cap is 3; TestFlight/beta currently unlocks).
- 30-second priority board refresh.
- Lounge checker and Fast Track access matcher.
- Delay prediction on the detail card.
- Wake-up alarm before landing.
- Flight history list of landed tracks.
- Unlimited connection checks (free users have a daily cap).
- Pro-only style themes.
- Paywall screen and upgrade-limit prompt when a free cap is hit.
- Restore purchases and Customer Center.

## Airport Info

- Static `data/airportInfo.json` for key hubs (BKK, DMK, HKT, CNX, SIN, KUL, and siblings): Wi‑Fi SSID, terminals, lounge names, city tips, tourist SIM.
- Lounge database (`data/lounges.ts`) with access tags for HKT, BKK, DMK, AMS, SIN, KUL, DXB (Coral, Royal Orchid, Miracle, SilverKris, Plaza Premium, Emirates, etc.).
- Fast Track lanes for the same hubs.
- Country info (`data/countryInfo.json`) for ~35 countries (SEA, Gulf, EU, US, AU, …).
- Currency map per country/airport and live FX snapshot (EUR-base proxy / Open ER-API).
- Weather + AQI snapshots (Open-Meteo via proxy) and air-quality screen.
- Local time and timezone per IATA (`lib/airportTz.ts`).
- Taxi / transfer estimates and Grab-style booking links (`lib/transportBooking.ts`).
- Terminal walk times and gate-to-belt walk estimates.
- Airport maps and aircraft/SeatGuru lookups.
- Immigration apps by destination IATA.
- Schiphol enrich for AMS when the board is Dutch.
- AeroDataBox / FlightAware / OpenSky services behind the proxy for live ops, inbound by registration, and radar.
- 10,000+ airport search catalog in `lib/airportsDb.ts` (SEA rows plus worldwide hubs).

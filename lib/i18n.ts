/** Lightweight i18n catalog — swap locale later without rewriting UI. */

import deTranslations from '../i18n/locales/de.json';
import jaTranslations from '../i18n/locales/ja.json';
import koTranslations from '../i18n/locales/ko.json';
import ruTranslations from '../i18n/locales/ru.json';
import thTranslations from '../i18n/locales/th.json';
import viTranslations from '../i18n/locales/vi.json';
import enFnParams from './en_fn_params.json';
import zhTranslations from '../zh_translations.json';

export type Locale = 'en' | 'nl' | 'zh' | 'th' | 'de' | 'ru' | 'ja' | 'ko' | 'vi';

export const LOCALES: readonly Locale[] = [
  'en', 'nl', 'zh', 'th', 'de', 'ru', 'ja', 'ko', 'vi',
] as const;

const TH_TODO = '【แปลภายหลัง】';
const ZH_TODO = '【待翻译】';

const EN = {
  live: 'LIVE',
  updating: 'Updating...',
  cached: 'Cached',
  demo: 'Demo',
  refreshing: 'Refreshing...',
  updated: 'Updated',
  updatedJustNow: 'Updated just now',
  noConnection: 'No connection · Showing cached data',
  retry: 'Retry',
  loadTimeout: 'Taking too long — check your connection',
  noFlights: 'No flights found',
  noFlightsFor: (q: string) => `No flights found for ‘${q}’`,
  noFlightsTo: (label: string, iata: string) => `No flights to ${label} at ${iata}`,
  noFlightsFrom: (label: string, iata: string) => `No flights from ${label} at ${iata}`,
  noFlightsMatching: (label: string, iata: string) => `No flights matching ${label} at ${iata}`,
  tryHints: (hints: string) => `Try: ${hints}`,
  orSwitchAirport: 'Or switch airport to see flights from another hub',
  recentSearches: 'Recent searches',
  recentAirports: 'Recent',
  favourites: 'Favourites',
  nearby: 'Nearby',
  skip: 'Skip',
  next: 'Next',
  getStarted: 'Get started',
  onboarding1Title: 'Live flight boards for any airport',
  onboarding1Body: 'Arrivals, departures and gates — updated in real time, worldwide.',
  onboarding2Title: 'Track your flight, get notified',
  onboarding2Body: 'Gate changes, delays and boarding — even when the app is closed.',
  onboarding3Title: 'Select your airport to start',
  onboarding3Body: 'Search any IATA code or city. You can change it anytime.',
  settings: 'Settings',
  notifications: 'Notifications',
  defaultAirport: 'Default airport',
  temperature: 'Temperature',
  timeFormat: 'Time format',
  clearCache: 'Clear cache',
  cacheCleared: 'Cache cleared',
  clearCacheConfirmTitle: 'Clear cache?',
  clearCacheConfirmBody: 'This will remove recent searches and cached flight data. Your tracked flights will not be affected.',
  clearCacheConfirmAction: 'Clear',
  about: 'About',
  version: 'Version',
  celsius: '°C',
  fahrenheit: '°F',
  hour24: '24-hour',
  hour12: '12-hour',
  notifyDelay: 'Delay updates',
  notifyGate: 'Gate changes',
  notifyBoarding: 'Boarding alerts',
  notifyLanded: 'After landing',
  useCurrentAirport: 'Use current airport',
  local: 'local',
  language: 'Language',
  refreshInterval: 'Refresh interval',
  offlineData: 'Offline data',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  termsShort: 'Terms',
  rateApp: 'Rate WaiAir',
  contact: 'Contact support',
  followUs: 'Follow us',
  widget: 'Home screen widget',
  addWidgetSheetTitle: 'Add home screen widget',
  addWidgetSheetBody: 'Long press your home screen → tap + → search WaiAir → add WaiAir Flight widget',
  addWidgetSheetIosOnly: 'Home screen widgets are available on iPhone.',
  addWidgetSheetBeforeTitle: 'Before the widget shows flight info:',
  addWidgetSheetStep1: 'Open WaiAir',
  addWidgetSheetStep2: 'Find your flight',
  addWidgetSheetStep3: 'Tap the 🔔 bell icon on the flight',
  addWidgetSheetStep4: 'The widget will now show live updates',
  enabled: 'Enabled',
  disabled: 'Disabled',
  english: 'English',
  dutch: 'Nederlands',
  chinese: '中文',
  thai: 'ไทย',
  german: 'Deutsch',
  russian: 'Русский',
  japanese: '日本語',
  korean: '한국어',
  vietnamese: 'Tiếng Việt',

  // Status
  all: 'All',
  boarding: 'Boarding',
  onTime: 'On Time',
  onTimeCheck: 'On Time ✓',
  onTimeLower: 'on time',
  pctOnTime: (n: number) => `${n}% on time`,
  landed: 'Landed',
  cancelled: 'Cancelled',
  cancelledStamp: 'CANCELLED',
  delayed: 'Delayed',
  boardingNow: 'Boarding Now',
  enRoute: 'En Route',
  scheduled: 'Scheduled',
  unknown: 'Unknown',
  departed: 'Departed',
  arrived: 'Arrived',
  departing: 'Departing',
  lastCall: 'Last Call 🚨',
  gateClosing: 'Gate Closing',
  statusBoardingDesc: 'Head to your gate now',
  statusEnRouteDesc: 'Flight is in the air',
  statusScheduledDesc: 'On time as planned',
  statusDelayedDesc: 'Departure pushed back',
  statusLandedDesc: 'Aircraft has arrived',
  statusUnknownDesc: 'Status unavailable',
  statusCancelledDesc: 'Flight has been cancelled',

  // Pickup
  pickupMode: 'Pickup Mode',
  pickingUp: (name: string) => `Picking up: ${name}`,
  pickingSomeoneUp: 'Picking someone up?',
  wellTellWhenToLeave: "We'll tell you when to leave",
  minToAirport: (n: number) => `~${n} min to airport`,
  leaveAt: (clock: string) => `Leave at ${clock}`,
  yourLocation: (label: string) => `Your location: ${label}`,
  saveLocationOnce: "We'll save your location once when you enable alerts",
  pickupBaggageHint: (bag: number, walk: number) =>
    `Includes ~${bag} min baggage + ${walk} min to arrivals`,
  enablePickupAlerts: 'Enable Pickup Alerts',
  saveMyLocation: 'Save my location',
  pickupAlertsOff: 'Pickup alerts off',
  pickupAlertsOn: 'Pickup alerts on',
  pickupAlertsOnAllowLocation: 'Pickup alerts on — allow location to time your drive',
  pickupAlertsOnEta: "Pickup alerts on — we'll time the drive when the ETA is known",
  pickupAlertsOnLeave: "Pickup alerts on — we'll tell you when to leave",
  surpriseWelcome: '🎁 Surprise welcome',
  surpriseWelcomeSub: "We'll tell you when to leave so you're there when they arrive",
  surpriseWelcomeActive: 'Surprise welcome active ✨',
  surpriseLeaveCountdown: (clock: string, mins: number) =>
    mins <= 0
      ? `Leave now · perfect moment at ${clock}`
      : `Leave in ${mins} min · around ${clock}`,
  surpriseEnterName: 'Add who you are picking up first — then surprise mode can use their name',
  surpriseEnabled: 'Surprise welcome on ✨',
  surpriseDisabled: 'Surprise welcome off',
  surpriseT2hTitle: (name: string) => `🎁 ${name}'s flight is on time`,
  surpriseT2hBody: (name: string, clock: string) =>
    `Plan to leave around ${clock} for a perfect welcome moment`,
  surpriseT45Title: '🎁 Leave in 45 minutes',
  surpriseT45Body: (name: string) =>
    `You'll arrive just as ${name} walks through arrivals ✨`,
  surpriseLeaveTitle: '🎁 Time to go!',
  surpriseLeaveBody: (name: string) =>
    `Leave now and you'll be there right when ${name} arrives 🌟`,
  surpriseLandedTitle: (name: string) => `✈️ ${name} just landed!`,
  surpriseLandedBody: (name: string, bagMin: number) =>
    `Head to arrivals — bags take ~${bagMin} min · Get ready for the moment 🎁`,
  tooFarToDrive: 'Too far to drive · Consider taxi from airport',
  whoPickingUp: 'Who are you picking up?',
  whoPickingUpHint: "Name and optional photo — we'll remember it for this flight.",
  name: 'Name',
  namePlaceholder: 'e.g. "Mom", "David", "Sarah"',
  save: 'Save',
  cancel: 'Cancel',
  close: 'Close',
  choosePhoto: 'Choose photo',
  takePhoto: 'Take photo',
  chooseFromLibrary: 'Choose from library',
  photos: 'Photos',
  photosPermission: 'WaiAir needs access to your photo library.',
  cameraPermission: 'WaiAir needs access to your camera.',
  photo: 'Photo',
  couldNotOpenPhotos: 'Could not open the photo library.',
  couldNotOpenCamera: 'Could not open the camera.',
  enterName: 'Enter a name, for example Mom or David.',
  couldNotSaveName: 'Could not save the name.',
  yourFlight: 'YOUR FLIGHT',
  isLanding: (label: string) => `${label} IS LANDING ✈`,
  baggageBeltTba: 'Baggage belt TBA',
  baggageBelt: (b: string) => `Baggage belt ${b}`,
  baggageBeltColon: (b: string) => `Baggage belt: ${b}`,
  baggageBeltOpen: (belt: string) => `🧳 Belt ${belt} is now open — your bags are on the way`,
  baggageInfoPending: 'Baggage info not yet available',
  landedBeltWalk: (belt: string, min: number) => `✅ Landed! ${belt} · expect in ~${min} min`,
  walkTimeGateBaggage: (min: number) => `Walk time gate → baggage: ~${min} min`,
  sendWhatsApp: 'Send WhatsApp',
  exitPickupMode: 'Exit Pickup Mode',
  waHereLanded: (label: string) => `I'm here! ${label} has landed ✈ — sent via WaiAir`,
  waHereLandingNow: (label: string) => `I'm here! ${label} is landing now ✈ — sent via WaiAir`,
  waHereLandsIn: (label: string, min: number) =>
    `I'm here! ${label} lands in ${min} minutes ✈ — sent via WaiAir`,
  leaveNow: 'Leave now',
  leaveSoon: 'Leave soon',
  planToLeave: 'Plan to leave',
  flightOnTime: (num: string) => `${num} on time`,
  flightOnTimeLeaveAt: (clock: string) => `Flight on time, plan to leave at ${clock}`,
  leaveIn30Min: 'Leave in 30 min',
  leaveIn30MinBody: (dest: string) => `Leave in 30 min to be there on time · ${dest}`,
  leaveNowFor: (dest: string) => `Leave now for ${dest}`,
  leaveNowBody: (drive: number, bag: number) =>
    `Drive ~${drive} min · Baggage ~${bag} min · Arrivals hall`,
  justLandedAt: (num: string, dest: string) => `✈️ ${num} just landed at ${dest}`,
  leaveNowMeetThem: 'Leave now → arrive in time to meet them',
  baggageTakes: (min: number) => `Baggage takes ~${min} min`,
  arrivalsHall: (hall: string) => `Arrivals hall ${hall}`,
  gateChangedTo: (gate: string) => `Gate changed to ${gate}`,
  updateMeetingPoint: (num: string) => `Update your meeting point · ${num}`,

  // Notifications
  gateChanged: 'Gate changed',
  gateChangedBody: (num: string, gate: string) => `⚠️ Gate changed · ${num} · Now Gate ${gate}`,
  flightDelayed: (num: string) => `${num} delayed`,
  flightDelayedBody: (num: string, delay: number, time: string) =>
    `${num} running ${delay} min late · New: ${time} · ☕ You have time`,
  flightDelayedBodyShort: (num: string, delay: number) =>
    `${num} running ${delay} min late · ☕ You have time`,
  flightCancelled: 'Flight cancelled',
  flightCancelledBody: (num: string) => `${num} has been cancelled`,
  landedIn: (city: string, flag: string) => `Landed in ${city} ${flag}`.replace(/\s{2,}/g, ' ').trim(),
  landedInBelt: (city: string, flag: string, belt: string) =>
    `Landed in ${city} ${flag} · Baggage belt ${belt}`.replace(/\s+·/, ' ·').replace(/\s{2,}/g, ' ').trim(),
  landedDotNum: (num: string) => `Landed · ${num}`,
  numLanded: (num: string) => `${num} landed`,
  tomorrow: 'Tomorrow',
  tomorrowBody: (route: string, time: string) =>
    `Tomorrow: ${route} ${time}. Check-in opens soon`,
  in3Hours: (num: string) => `${num} in 3 hours`,
  in3HoursBody: 'Your flight in 3 hours. Gate usually announced soon',
  in1Hour: (num: string) => `${num} in 1 hour`,
  yourFlightIn1Hour: 'Your flight in 1 hour',
  minLate: (n: number) => `${n} min late`,
  boardingStartsSoon: 'Boarding starts soon',
  boardingStartsSoonAtGate: (gate: string) => `Boarding starts soon at Gate ${gate}`,
  boardingStartsSoonNum: (num: string) => `Boarding starts soon · ${num}`,
  numDeparted: (num: string) => `${num} departed`,
  numDepartedArrives: (num: string, arr: string, city: string) =>
    city
      ? `${num} departed ✈️ Arrives ${arr} ${city} time`
      : `${num} departed ✈️ Arrives ${arr}`,
  numDepartedShort: (num: string) => `${num} departed ✈️`,
  numArrivingEarly: (num: string) => `${num} arriving early`,
  numArrivingEarlyBody: (num: string, mins: number, time: string) =>
    `${num} arriving ${mins} min early · New: ${time}`,
  tightConnection: 'Tight connection',
  tightConnectionBody: (inn: string, arrive: string, out: string, depart: string, mins: number) =>
    `${inn} lands ${arrive}, ${out} departs ${depart} — only ${mins} min`,
  flightUpdates: 'Flight updates',
  urgentFlightUpdates: 'Urgent flight updates',
  gateClosingSoonTitle: 'Gate closing soon',
  askAssistanceAtGate: (gate: string) => `Ask for assistance at gate ${gate}`,
  boardingNowPush: '🟢 Boarding Now',
  gateClosingSoonPush: '🟠 Gate Closing Soon',
  lastCallPush: '🚨 Last Call',
  gateClosingSoon: 'Gate closing soon',
  minToClose: (n: number) => `${n} min to close`,
  gateClosingNow: 'Gate closing now',
  run: 'Run!',
  gateClosesInMin: (n: number) => `Gate closes in ${n} min`,
  lastCallGateClosed: 'Last Call 🚨 · Gate closed',
  lastCallGateCloses: (n: number) => `Last Call 🚨 · Gate closes in ${n} min`,
  gateClosingRemaining: (n: number) => `Gate Closing · ${n} min remaining`,
  boardsIn: (d: string) => `Boards in ${d}`,
  enRouteLandsIn: (d: string) => `En Route · Lands in ${d}`,
  landedWelcomeTo: (city: string, flag: string) =>
    `Landed · Welcome to ${city}${flag ? ` ${flag}` : ''}`,
  landingSoon: 'Landing soon',
  landsIn: (d: string) => `Lands in ${d}`,
  connectingPassengerHold: (num: string, from: string, to: string) =>
    `Connecting passenger from ${num}, walking ${from} → ${to}. Please hold.`,
  alertGateAgent: 'Alert gate agent',
  callAirport: 'Call airport',
  gateRace: 'Gate Race',
  gateRaceBanner: (from: string, to: string, left: number, walk: string, mark: string) =>
    `⚡ Gate Race · ${from} → ${to} · ${left} min left · Walk ${walk} ${mark}`,
  gateRaceLandsAt: (num: string, gate: string, term: string, time: string) =>
    `${num} lands  Gate ${gate}  · ${term}    ${time}`,
  gateRaceWalkTo: (gate: string, term: string, walk: string) =>
    `Walk to      Gate ${gate} · ${term}    ${walk}`,
  gateRaceBoardsAt: (num: string, time: string) =>
    `${num} boards              ${time}`,
  gateRaceOnlyMinClose: (min: number) =>
    `⚠️ Only ${min} min — it's going to be close!`,
  gateRaceGotTime: "You've got time",
  gateRaceClose: "It's going to be close",
  gateRaceRunNotify: 'Run! Notify gate staff',
  gateRaceNotifyLandingTitle: '⚡ Gate Race!',
  gateRaceNotifyLandingBody: (min: number, gate: string, term: string) =>
    `You have ${min} min\nWalk to Gate ${gate} · ${term} — go now!`,
  gateRaceNotifyDelayTitle: '⚠️ Connection at risk',
  gateRaceNotifyDelayBody: (inn: string, out: string, min: number) =>
    `⚠️ ${inn} delayed — your connection ${out} is at risk · Only ${min} min left\nAsk cabin crew about gate assistance`,
  gateRaceConnectionMissedTitle: '❌ Connection missed',
  gateRaceConnectionMissedBody:
    'Ask airline staff for rebooking\nYour rights: EU261 may apply',
  gateRaceLiveRemain: (min: number) => `${min} min until boarding · keep moving`,
  fromGate: (gate: string) => `From:  Gate ${gate}`,
  toGate: (gate: string) => `To: Gate ${gate}`,
  firstFlightLanded: '[first flight landed]',
  secondFlightDeparts: '[second flight departing]',
  minutesLeft: 'minutes left',
  walkTimeGates: (from: string, to: string, walk: string) =>
    `Walk time ${from} → ${to}: ${walk}`,
  statusColon: (s: string) => `Status: ${s}`,
  stillEnoughTime: "You've got time",
  hurryUp: "It's going to be close",
  runNow: 'Run! Notify gate staff',
  walkMin: (n: number) => `~${n} min`,
  walkMinEstimate: (n: number) => `~${n} min (estimate)`,
  navigateToGate: (gate: string) => `🗺 Navigate to ${gate}`,
  exitGateRace: 'Exit Gate Race',
  openGateRace: 'Open Gate Race',
  dismissGateRaceBanner: 'Dismiss Gate Race banner',
  enoughTime: 'Enough time',

  // Settings extra
  closeSettings: 'Close settings',
  account: 'ACCOUNT',
  appearance: 'APPEARANCE',
  preferences: 'PREFERENCES',
  data: 'DATA',
  waiairPro: 'WaiAir Pro ✓',
  waiairFree: 'WaiAir Free',
  testFlightUnlocked: 'TestFlight · all features unlocked',
  active: 'Active',
  manageSubscription: 'Manage subscription',
  restorePurchase: 'Restore purchase',
  upgradeToPro: 'Upgrade to Pro →',
  flightsTrackedOf: (n: number, limit: number) => `${n} of ${limit} flights tracked`,
  nearestAirport: 'Nearest airport',
  systemNotificationSettings: 'System notification settings',
  proRestored: 'WaiAir Pro restored',
  customerCenterUnavailable: 'Customer Center unavailable — needs a native build',
  setAsDefault: (iata: string) => `${iata} set as default`,
  addWidgetHint: 'Add the WaiAir widget from your home screen',
  priorityRefreshPro: 'Priority refresh (30s) with Pro',
  themeA11y: (name: string, pro: boolean, locked: boolean, selected: boolean) =>
    `${name} theme${pro ? ', Pro' : ''}${locked ? ', locked' : ''}${selected ? ', selected' : ''}`,
  refreshA11y: (label: string, pro: boolean) => `Refresh ${label}${pro ? ', Pro' : ''}`,
  waiairOnX: 'WaiAir on X',
  waiairOnInstagram: 'WaiAir on Instagram',

  // App chrome
  arrives: 'Arrives',
  departs: 'Departs',
  arrivesAt: (time: string) => `Arrives ${time}`,
  departsAt: (time: string) => `Departs ${time}`,
  tracked: 'Tracked',
  radar: 'Radar',
  share: 'Share',
  shareCard: 'Share Card',
  whatsapp: 'WhatsApp',
  line: 'LINE',
  pro: 'Pro',
  untrack: 'Untrack',
  track: 'Track',
  details: 'Details ›',
  scanBoardingPass: 'Scan boarding pass',
  scanBoardingPassSub: 'Point the camera at the barcode, or type the flight number',
  scanBoardingPassHint: 'Point camera at boarding pass barcode',
  add: 'Add',
  trackYourFlight: 'Track your flight',
  trackEmptySub1: 'Tap the 🔔 Track button on any flight',
  trackEmptySub2: 'Get notified when boarding starts',
  browseFlights: 'Browse flights →',
  timeline: 'TIMELINE',
  timelineTitle: 'Timeline',
  willIMakeConnection: 'Will I make my connection?',
  checkLayover: 'Check layover time between two flights',
  incomingFlight: 'INCOMING FLIGHT',
  connectingFlight: 'CONNECTING FLIGHT',
  connectionAirport: 'CONNECTION AIRPORT',
  includeAirlineCode: 'Please include airline code, e.g. PR404',
  autoDetectedAirport: 'Auto-detected from flights',
  checkConnection: 'Check Connection',
  upgradeUnlimited: 'Upgrade for unlimited →',
  connection: 'CONNECTION',
  walk: 'WALK',
  gateToGate: 'Gate to gate',
  terminal: 'TERMINAL',
  incoming: 'Incoming',
  connecting: 'Connecting',
  incomingDot: (n: string) => `Incoming · ${n}`,
  connectingDot: (n: string) => `Connecting · ${n}`,
  same: 'Same',
  change: 'Change',
  delayedParen: ' (delayed)',
  recalculate: '↻  Recalculate with latest times',
  chooseAirport: 'Choose airport',
  nearMe: 'Near me',
  noAirportsMatch: (q: string) => `No airports match “${q}”`,
  airportsWorldwide: '10,000+ Airports worldwide — search any code or city',
  shareMyFlight: 'Share my flight',
  searchPlaceholder: '🔍 Flight, city, country or airport...',
  searchCityAirport: 'Search city, airport or code…',
  clearSearch: 'Clear search',
  yesterday: 'Yesterday',
  today: 'Today',
  globalSearching: 'Global · searching...',
  globalResults: (n: number, q: string) =>
    `Global · ${n} result${n === 1 ? '' : 's'} for ${q}`,
  routeSearching: 'Route · searching...',
  routeHintSearching: (hint: string) => `Route · searching${hint ? ` · ${hint}` : ''}...`,
  routeResults: (hint: string, n: number) =>
    `Route · ${hint} · ${n} flight${n === 1 ? '' : 's'}`,
  noFlightsThisDate: 'No flights found for this date',
  noStatusFlights: (status: string) => `No ${status} flights`,
  flightsLiveRefresh: (n: number) => `${n} flights · live refresh · pull to refresh`,
  worldwideSearch: (n: number) => `${n} worldwide · type a flight # to search any airport`,
  pullToRefresh: 'Pull to refresh',
  pullToRefreshInterval: 'Pull to refresh · Updates every 60s',
  popularFrom: (iata: string) => `Popular from ${iata}:`,
  findingNearest: 'Finding nearest airport…',
  loadingFlightsFor: (day: string) => `Loading flights for ${day}…`,
  loadingAirport: (iata: string, name: string) => `Loading ${iata} · ${name}`,
  loadingIata: (iata: string) => `Loading ${iata}…`,
  globalFlightSearch: 'Global flight search',
  notificationsDisabled: 'Notifications disabled',
  notifyBannerBody: 'To receive flight alerts when the app is closed, turn notifications on via: Settings → Notifications → WaiAir → Allow Notifications',
  openSettings: 'Open settings',
  later: 'Later',
  dismissBanner: 'Dismiss banner',
  closeAirportPicker: 'Close airport picker',
  searching: 'Searching…',
  results: 'Results',
  enterFlightNumber: 'Enter flight number (e.g. TG202)',
  enterValidFlight: 'Enter a valid flight number, e.g. TG202',
  enterValidFlightAlt: 'Enter a valid flight number, e.g. TG316',
  addedTracking: (num: string) => `${num} added — tracking now`,
  couldNotAdd: (num: string) => `Could not add ${num}`,
  couldNotReadFlight: 'Could not read flight number',
  trackingStopped: 'Tracking stopped',
  nowTracking: (num: string) => `${num} is being tracked`,
  freePlan3: 'Free plan includes 3 flights',
  selectFlightToShare: 'Select a flight to share',
  maxFavourites: (n: number) => `Max ${n} favourite airports`,
  locationPermissionNeeded: 'Location permission needed',
  couldNotFindNearby: 'Could not find nearby airports',
  scanFromMyFlights: 'Scan a boarding pass from My Flights',
  hideDetails: 'Hide details',
  showDetails: 'Show details',
  shareFlight: 'Share Flight',
  unlockProTracking: 'Unlock unlimited tracking with Pro',
  untrackFlight: 'Untrack flight',
  trackFlight: 'Track flight',
  shareOnWhatsApp: 'Share on WhatsApp',
  shareOnLINE: 'Share on LINE',
  scanBoardingPassBarcode: 'Scan boarding pass barcode',
  flightNumber: 'Flight number',
  addFlightToTracking: 'Add flight to tracking',
  browseFlightsA11y: 'Browse flights',
  darkMode: 'Dark mode',
  lightMode: 'Light mode',
  closeFlightDetails: 'Close flight details',
  downloadBolt: 'Download Bolt in the App Store',
  calendarExportApps: 'Calendar export is available in the iOS and Android apps.',
  calendarPermission: 'Calendar permission is required to add this flight.',
  noWritableCalendar: 'No writable calendar found on this device.',
  rateLimit: 'Too many requests — please wait a moment and try again',
  couldNotFindFlight: (n: string) =>
    `Could not find flight ${n}. Please check the flight number and try again.`,
  couldNotFindFlightShort: (n: string) => `Could not find flight ${n}`,
  unableConnectionTime: 'Unable to calculate connection time',
  incomingCancelled: 'Incoming flight is cancelled',
  connectingCancelled: 'Connecting flight is cancelled',
  missingTimes: 'Missing arrival or departure time',
  notSameDay: 'These flights are not on the same day — connection unlikely',
  missConnection: "❌ You'll miss it — contact airline now",
  tightBuffer: (min: number) => `⚠️ Very tight — ${min} min. Ask airline for help`,
  makeConnection: (min: number) => `✅ You'll make it — ${min} min buffer`,
  couldNotDetectHub: 'Could not auto-detect connection airport from these flights.',
  enterBothFlights: 'Enter both flight numbers',
  freeConnLimit: (n: number) =>
    `Free plan: ${n} checks per day. Your last result stays visible.`,
  couldNotCheckConnection: 'Could not check connection',
  checksToday: (used: number, limit: number) => `${used} of ${limit} checks today`,
  yourFlightFallback: 'Your flight',
  departsIn: (cd: string) => `Departs in ${cd}`,
  arrivesIn: (cd: string) => `Arrives in ${cd}`,
  gateCloses: (time: string) => `Gate closes: ${time}`,
  minRemaining: (n: number) => `${n} min remaining`,
  seat: (s: string) => `Seat ${s}`,
  checkInSequence: (s: string) => `Check-in sequence ${s}`,
  bookingReference: (p: string) => `Booking reference ${p}`,
  wasGate: (g: string) => `was ${g}`,
  delayedMin: (n: number) => `Delayed ${n} min`,
  delayedMinShort: (n: number) => `Delayed ${n}m`,
  delayedMinNewDep: (n: number, time: string) =>
    `Delayed ${n} min · New departure: ${time}`,
  onTimeDepartsIn: (cd: string) => `On Time · Departs in ${cd}`,
  arrivesApprox: (time: string) => `Arrives ~${time}`,
  earlyMin: (n: number) => `${n}m Early`,
  delayMinShort: (n: number) => `${n}m Delay`,
  mLate: (n: number) => `${n}m late`,
  enRouteArrivesIn: (cd: string) => `En Route · Arrives in ${cd}`,
  gateDepartureIn: (cd: string) => `Gate Departure in ${cd}`,
  enRoutePct: (pct: number, remain: string) =>
    remain ? `En Route · ${pct}% · Lands in ${remain}` : `En Route · ${pct}%`,
  delayNew: (n: number, time: string) => `${n}m Delay · New: ${time}`,
  criticalConnection: (min: number) => `Critical connection — only ${min} min`,
  tightConnectionMin: (min: number) => `Tight connection — only ${min} min`,
  getIntoTown: (dest: string) => `Get into town · ${dest}`,
  loadingAircraft: 'Loading aircraft…',
  nextUpdateIn: (s: number) => `Next update in ${s}s`,
  tapAPlane: 'tap a plane',
  refreshRadar: 'Refresh radar',
  closeRadar: 'Close radar',
  radarTitle: 'WaiAir Radar',
  radarAircraft: (shown: string, source: string, clock: string) =>
    `${shown} aircraft · SEA · ${source} ${clock}`,
  cachedUpper: 'CACHED',
  radarNextUpdate: (s: number) => `Next update in ${s}s · tap a plane`,
  noFlightsInApi: 'No flights in API response',
  trackedCountA11y: (n: number) => `Tracked, ${n} flights`,
  changeAirportA11y: (iata: string, city: string) =>
    `${iata}, ${city}. Tap to change airport`,
  removeFavourite: (iata: string) => `Remove ${iata} from favourites`,
  saveFavourite: (iata: string) => `Save ${iata} as favourite`,
  untrackNum: (n: string) => `Untrack ${n}`,
  openFlightDetails: (n: string) => `${n}, open flight details`,
  searchQuery: (q: string) => `Search ${q}`,
  filterFlightsA11y: (label: string, count: number) => `${label}, ${count} flights`,
  dayA11y: (label: string, date: string) => `${label}, ${date}`,
  airportA11y: (iata: string, name: string, country: string) =>
    `${iata}, ${name}, ${country}`,
  loadingScheduled: 'Loading scheduled details…',
  viewFlightDetails: 'View Flight Details →',
  flightProgress: 'FLIGHT PROGRESS',
  position: 'POSITION',
  altitude: (v: string) => `Altitude: ${v}`,
  speed: (v: string) => `Speed: ${v}`,
  heading: (v: string) => `Heading: ${v}`,
  departure: 'DEPARTURE',
  arrival: 'ARRIVAL',
  arrivesApproxUpper: 'ARRIVES ~',
  searchingFlights: 'Searching flights…',
  searchByRoute: 'Search by route',
  from: 'From',
  to: 'To',
  date: 'Date',
  searchFlights: 'Search flights',
  fromPlaceholder: 'Amsterdam / AMS / Netherlands',
  toPlaceholder: 'Bangkok / BKK / Thailand',
  eGFlight: 'e.g. TG937',
  eGFlight2: 'e.g. TG205',
  routeNoFlights: (hint: string) => `No flights on ${hint || 'this route'}`,
  routeSearchingShort: 'Searching route…',
  checkConnectionLink: 'Check connection',
  welcomeTo: (city: string, flag: string) => `Welcome to ${city} ${flag}`.trim(),
  localTimeColon: (time: string) => `Local time: ${time}`,
  localTimeCity: (city: string) => `Local time ${city}`,
  localRate: (rate: string, local: string, dest: string) => `1 ${local} = ${rate} ${dest}`,
  eurRate: (rate: string, code: string) => `1 EUR = ${rate} ${code}`,
  usdRate: (rate: string, code: string) => `1 USD = ${rate} ${code}`,
  taxiToCenter: (min: number) => `Taxi to center: ~${min} min`,
  dismiss: 'Dismiss',
  history: 'History',
  historyEmpty: 'Landed tracked flights appear here automatically.',
  gate: (g: string) => `Gate ${g}`,
  gateTba: 'Gate TBA',
  gateColon: (g: string) => `Gate: ${g}`,
  terminalN: (n: string) => `Terminal ${n}`,
  runway: 'Runway',
  delayHistory: 'Delay history',
  delayHistorySub: 'Historical average — not a live prediction',
  turbulenceForecast: '🌪️ Turbulence Forecast',
  turbulenceSmooth: 'Smooth',
  turbulenceLight: 'Light',
  turbulenceModerate: 'Moderate',
  turbulenceSevere: 'Severe',
  turbulenceOver: (region: string) => `Over ${region}`,
  turbulenceRegionLine: (region: string, start: string, end: string) =>
    `Over ${region} · ${start}–${end}`,
  turbulenceAlertBody: (severity: string, region: string, num: string, start: string, end: string) =>
    `⚠️ ${severity} turbulence expected over ${region} on your ${num} flight · ${start}–${end}\nConsider taking your seat early`,

  startFlyTogether: '👥 Fly Together',
  togetherCreatedTitle: 'Your group is ready',
  togetherGroupNamePlaceholder: 'Group name (optional)',
  togetherCreateAction: 'Create group',
  togetherCodeLabel: (code: string) => `Group code: ${code}`,
  togetherCopyLink: 'Copy link',
  togetherOpenGroup: 'Open group',
  togetherInviteMessage: (name: string, link: string) =>
    name
      ? `Join our Fly Together group "${name}" on WaiAir 👥\n${link}`
      : `Join our Fly Together group on WaiAir 👥\n${link}`,
  togetherJoinTitle: 'Join Fly Together',
  togetherCodePlaceholder: 'ABC123',
  togetherNamePlaceholder: 'Your name',
  togetherJoinAction: 'Join group',
  togetherJoinFailed: 'Could not join this group',
  togetherInvalidCode: 'Enter a valid group code (ABC123)',
  togetherLiveTitle: (name: string) => `👥 ${name}`,
  togetherLiveTitleDefault: '👥 Fly Together',
  togetherYou: '(you)',
  togetherLanded: 'Landed',
  togetherDelayed: 'Delayed',
  togetherInAir: 'In air',
  togetherScheduled: 'Scheduled',
  togetherEta: (time: string) => `ETA ${time}`,
  togetherMapWebFallback: 'Live map available in the iOS/Android app',
  togetherAllArrivingToday: (dest: string) => `All arriving at ${dest} today`,
  togetherMeetAt: (place: string) => `📍 Meet at ${place}`,
  togetherEveryoneHere: 'Everyone is here',
  togetherNotifyTitle: '👥 Fly Together',
  togetherNotifyLanded: (name: string, dest: string, others: string) =>
    `👥 ${name} has landed at ${dest}\n${others}`,
  togetherOthersEnRoute: (names: string) => `${names} still on their way`,
  togetherNotifyDelayed: (name: string, min: number) =>
    `⚠️ ${name} is delayed by ${min} min\nConsider waiting at the airport`,
  togetherNotifyAllLanded: (last: string, gapMin: number, first: string) =>
    `✅ Everyone has landed!\n${last} was last — ${gapMin} min after ${first}`,
  togetherStartFailed: 'Could not create Fly Together group',
  togetherEnterName: 'Enter your name for the group',

  typicallyOnTime: (pct: number) => `Typically: On Time (${pct}% of flights)`,
  avgDelayWhenLate: (n: number) => `Average delay when late: ${n} min`,
  todayOutlookOnTime: "Today's outlook: ✅ Usually on time",
  todayOutlookLate: "Today's outlook: ⚠️ Often a little late",
  eu261: 'EU261 compensation',
  amIEligible: 'Am I eligible?',
  yes: 'Yes',
  no: 'No',
  compensationAmount: 'Compensation amount',
  airlineLiability: 'Airline liability',
  whatToDo: 'What to do',
  claimDeadline: 'Claim deadline',
  claimDeadlineBody: '2 years in most EU countries (check your national enforcement body).',
  airlineClaimPage: 'Airline claim page',
  checkYourClaim: 'Check your claim',
  checkMyClaim: 'Check my claim →',
  entitledCompensation: (amount: number) => `You may be entitled to €${amount} compensation`,
  eu261DepartureNote: 'EU261 applies to flights departing from EU airports',
  airlineCompensationPolicy: 'Check with your airline for compensation policy',
  avgMinLateWhenDelayed: (n: number) => `Avg. ${n} min late when delayed`,
  openFlightCompensationInfo: 'Open flight for compensation info →',
  eu261Disclaimer: 'EU261/2004 · not legal advice · extraordinary circumstances can void a claim',
  youreTracking3: "You're tracking 3 flights",
  freePlanIncludes3: 'Free plan includes 3.',
  upgradeProPitch: 'Upgrade Pro to track unlimited\n+ faster updates + smart alerts',
  upgradePrice: 'Upgrade · €2.99/mo',
  notNow: 'Not now',
  waiairProBrand: '✈️ WaiAir Pro',
  paywallTag: 'For people who fly often\nor pick others up.\nEverything automatic, always\nwith you.',
  featureUnlimited: '♾️  Track unlimited flights',
  featureRefresh: '⚡  Updates every 30 seconds',
  featureAlerts: '🔔  Smart flight timeline alerts',
  featureHistory: '📊  Your flight history',
  featureAirports: '🌍  Follow multiple airports',
  featureBaggage: '🎯  Baggage info before landing',
  featureRadar: '📡  Live aircraft on map',
  saveBestValue: 'Save 44% · Best value',
  monthly: 'Monthly',
  yearly: 'Yearly',
  perMonth: '/month',
  perYear: '/year',
  freeTrial: '7 day free trial · Cancel anytime',
  noCommitment: 'No commitment · No tricks',
  startFreeTrial: 'Start free trial',
  yearlyA11y: 'Yearly 19.99 euro, save 44 percent, best value',
  monthlyA11y: 'Monthly 2.99 euro',
  upgradeA11y: 'Upgrade, 2.99 euro per month',
  setWakeAlarm: 'Set wake-up alarm',
  wakeUpBefore: (n: number) => `Wake-up · ${n} min before`,
  wakeMeBeforeLanding: 'Wake me before landing',
  clearAlarm: 'Clear alarm',
  min: (n: number) => `${n} min`,
  landingTooSoon: 'Landing time too soon for that alarm',
  wakeUpSet: (n: number) => `Wake-up set — ${n} min before landing`,
  wakeUpCleared: 'Wake-up alarm cleared',
  wakePreview: (num: string) => `✈️ ${num} lands in X minutes — time to freshen up`,
  myNextFlight: 'My Next Flight',
  closeScanner: 'Close scanner',
  cameraInApps: 'Camera scanning is available in the iOS and Android apps.',
  cameraAccessNeeded: 'Camera access is needed to scan your boarding pass.',
  allowCamera: 'Allow camera',
  enterFlightManually: 'Enter flight number manually',
  couldNotReadPass: 'Could not read boarding pass.',
  currency: 'Currency',
  baggage: 'Baggage',
  beltCollecting: (belt: string) => `🧳 Belt ${belt} · Collecting now`,
  beltExpected: (belt: string) => `🧳 Belt ${belt} expected`,
  arrivesLocal: (clock: string, city: string) =>
    city
      ? `Arrives ~${clock} ${city} time`
      : `Arrives ~${clock} local`,
  loungesAt: (code: string) => `Lounges at ${code}`,
  youCanEnter: 'You can enter',
  viewDetails: 'View details →',
  viewDetailsFor: (name: string) => `View details for ${name}`,
  openHours: (hours: string) => `Open ${hours}`,
  creditCard: 'CREDIT CARD',
  airlineStatus: 'AIRLINE STATUS',
  ticketClass: 'TICKET CLASS',
  fastTrack: 'Fast Track',
  likely: 'Likely',
  loadingFleet: 'Loading fleet details…',
  ageYears: (age: string) => `Age · ${age}`,
  trackedStat: 'TRACKED',
  avgDelay: 'AVG DELAY',
  worstRoutes: 'Worst routes',
  noRouteData: 'No route data yet',
  reliability: 'Reliability…',
  shareFlightCard: 'Share flight card',
  couldNotCreateShare: 'Could not create share card',
  onTimeStatus: 'On time',
  loadingFlights: 'Loading flights…',
} as const;

type EnKey = keyof typeof EN;

function stripTodoPrefix(s: string): string {
  return s.startsWith(ZH_TODO) ? s.slice(ZH_TODO.length) : s;
}

function interpolateTemplate(template: string, names: readonly string[], args: unknown[]): string {
  let out = template;
  names.forEach((name, i) => {
    out = out.split(`{${name}}`).join(String(args[i] ?? ''));
  });
  return out;
}

/** `{hint || 'fallback'}` templates in locale JSON. */
function buildRouteNoFlights(template: string): (hint: string) => string {
  const m = template.match(/^(.*)\{hint \|\| '((?:\\'|[^'])*)'\}(.*)$/);
  if (!m) return (hint: string) => interpolateTemplate(template, ['hint'], [hint]);
  const [, pre, fallback, post] = m;
  const fb = fallback.replace(/\\'/g, "'");
  return (hint: string) => `${pre}${hint || fb}${post}`;
}

/** `{pro ? '…' : ''}`-style templates in locale JSON (theme picker a11y). */
function buildThemeA11y(
  template: string,
): (name: string, pro: boolean, locked: boolean, selected: boolean) => string {
  const suffix = (param: string) => {
    const re = new RegExp(`\\{${param} \\? '((?:\\\\'|[^'])*)' : ''\\}`);
    return template.match(re)?.[1]?.replace(/\\'/g, "'") ?? '';
  };
  const proS = suffix('pro');
  const lockedS = suffix('locked');
  const selectedS = suffix('selected');
  const base = template
    .replace(/\{pro \? '((?:\\'|[^'])*)' : ''\}/g, '')
    .replace(/\{locked \? '((?:\\'|[^'])*)' : ''\}/g, '')
    .replace(/\{selected \? '((?:\\'|[^'])*)' : ''\}/g, '');
  return (name: string, pro: boolean, locked: boolean, selected: boolean) => {
    let s = base.replace('{name}', name);
    if (pro) s += proS;
    if (locked) s += lockedS;
    if (selected) s += selectedS;
    return s;
  };
}

/** Typed EN param names — runtime fn.toString() names are minified in production bundles. */
const EN_FN_PARAMS = enFnParams as unknown as Record<EnKey, readonly string[] | undefined>;

/** Branch on truthy param — JSON uses "whenTruthy | whenFalsy" templates. */
const BRANCH_PARAM: Partial<Record<EnKey, string>> = {
  arrivesLocal: 'city',
  numDepartedArrives: 'city',
  enRoutePct: 'remain',
  refreshA11y: 'pro',
  routeHintSearching: 'hint',
  landedWelcomeTo: 'flag',
  togetherInviteMessage: 'name',
};

const POST_TRIM_KEYS = new Set<EnKey>(['landedIn', 'landedInBelt']);

/** ZH-only fallbacks for keys missing from zh_translations.json. */
const ZH_FN_OVERRIDES: Partial<Record<EnKey, unknown>> = {
  localRate: (rate: string, local: string, dest: string) => `1 ${local} = ${rate} ${dest}`,
  entitledCompensation: (amount: number) => `您可能有权获得 €${amount} 的赔偿`,
  avgMinLateWhenDelayed: (n: number) => `延误时平均晚点 ${n} 分钟`,
  checkMyClaim: '查看我的索赔 →',
  eu261DepartureNote: 'EU261 适用于从欧盟机场出发的航班',
  airlineCompensationPolicy: '请向航空公司查询赔偿政策',
  openFlightCompensationInfo: '打开航班查看赔偿信息 →',
  refreshA11y: (label: string, pro: boolean) =>
    `刷新频率：${label}${pro ? '，Pro' : ''}`,
  landedWelcomeTo: (city: string, flag: string) =>
    `已降落 · 欢迎来到 ${city}${flag ? ` ${flag}` : ''}`,
  routeHintSearching: (hint: string) =>
    hint ? `航线 · 正在搜索 · ${hint}...` : '航线 · 正在搜索...',
  globalResults: (n: number, q: string) => `全球 · ${q}：${n}个结果`,
  routeResults: (hint: string, n: number) => `航线 · ${hint} · ${n}个航班`,
};

function buildLocaleFromJson(
  src: typeof EN,
  raw: Record<string, string>,
  options?: { stripPrefix?: string; overrides?: Partial<Record<EnKey, unknown>> },
): typeof EN {
  const { stripPrefix = '', overrides = {} } = options ?? {};
  const out: Record<string, unknown> = {};

  for (const key of Object.keys(src) as EnKey[]) {
    if (key in overrides) {
      out[key] = overrides[key];
      continue;
    }

    const enVal = src[key];
    let str = raw[key] ?? (typeof enVal === 'string' ? enVal : '');
    if (typeof __DEV__ !== 'undefined' && __DEV__ && !(key in raw) && !str && typeof enVal !== 'function') {
      console.warn(`[i18n] missing translation key: ${key}`);
    }
    if (stripPrefix && str.startsWith(stripPrefix)) str = str.slice(stripPrefix.length);

    if (typeof enVal === 'function') {
      const names = EN_FN_PARAMS[key];
      if (!names?.length) {
        out[key] = enVal;
        continue;
      }

      if (!str) {
        out[key] = enVal;
        continue;
      }

      const branch = BRANCH_PARAM[key];
      if (branch && str.includes(' | ')) {
        const [whenTruthy, whenFalsy] = str.split(' | ');
        const idx = names.indexOf(branch);
        out[key] = (...args: unknown[]) => {
          const pick = idx >= 0 && args[idx] ? whenTruthy : whenFalsy;
          return interpolateTemplate(pick, names, args);
        };
        continue;
      }

      if (POST_TRIM_KEYS.has(key)) {
        out[key] = (...args: unknown[]) => {
          let s = interpolateTemplate(str, names, args);
          if (key === 'landedInBelt') s = s.replace(/\s+·/, ' ·');
          return s.replace(/\s{2,}/g, ' ').trim();
        };
        continue;
      }

      if (key === 'routeNoFlights' && str.includes('{hint ||')) {
        out[key] = buildRouteNoFlights(str);
        continue;
      }

      if (key === 'themeA11y' && str.includes('{pro ?')) {
        out[key] = buildThemeA11y(str);
        continue;
      }

      out[key] = (...args: unknown[]) => interpolateTemplate(str, names, args);
    } else {
      out[key] = str;
    }
  }

  return out as typeof EN;
}

function withTodoPrefix(src: typeof EN, prefix: string): typeof EN {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(src) as EnKey[]) {
    const val = src[key];
    if (typeof val === 'function') {
      out[key] = (...args: never[]) =>
        `${prefix}${(val as (...a: never[]) => string)(...args)}`;
    } else {
      out[key] = `${prefix}${val}`;
    }
  }
  return out as typeof EN;
}

const ZH = buildLocaleFromJson(EN, zhTranslations as Record<string, string>, {
  stripPrefix: ZH_TODO,
  overrides: ZH_FN_OVERRIDES,
});
const DE = buildLocaleFromJson(EN, deTranslations as Record<string, string>);
const RU = buildLocaleFromJson(EN, ruTranslations as Record<string, string>);
const JA = buildLocaleFromJson(EN, jaTranslations as Record<string, string>);
const KO = buildLocaleFromJson(EN, koTranslations as Record<string, string>);
const VI = buildLocaleFromJson(EN, viTranslations as Record<string, string>);
const TH = buildLocaleFromJson(EN, thTranslations as Record<string, string>);

const NL_STRINGS: Record<string, string> = {
  addWidgetSheetTitle: 'Widget op startscherm',
  addWidgetSheetBody: 'Houd je startscherm ingedrukt → tik op + → zoek WaiAir → voeg WaiAir Flight widget toe',
  addWidgetSheetIosOnly: 'Widgets op het startscherm zijn beschikbaar op iPhone.',
  addWidgetSheetBeforeTitle: 'Voordat de widget vluchtinfo toont:',
  addWidgetSheetStep1: 'Open WaiAir',
  addWidgetSheetStep2: 'Zoek je vlucht',
  addWidgetSheetStep3: 'Tik op het 🔔 bel-icoon bij de vlucht',
  addWidgetSheetStep4: 'De widget toont nu live updates',
  turbulenceForecast: '🌪️ Turbulentieverwachting',
  turbulenceSmooth: 'Rustig',
  turbulenceLight: 'Licht',
  turbulenceModerate: 'Matig',
  turbulenceSevere: 'Ernstig',
  turbulenceOver: 'Boven {region}',
  turbulenceRegionLine: 'Boven {region} · {start}–{end}',
  turbulenceAlertBody: '⚠️ {severity} turbulentie verwacht boven {region} op vlucht {num} · {start}–{end}\nOverweeg op tijd te gaan zitten',
  surpriseWelcome: '🎁 Verrassings-welkom',
  surpriseWelcomeSub: 'We vertellen je wanneer je vertrekt — precies op tijd voor hun aankomst',
  surpriseWelcomeActive: 'Verrassings-welkom actief ✨',
  surpriseLeaveCountdown: 'Vertrek over {mins} min · rond {clock}',
  surpriseEnterName: 'Voeg eerst toe wie je ophaalt — dan personaliseren we de verrassing',
  surpriseEnabled: 'Verrassings-welkom aan ✨',
  surpriseDisabled: 'Verrassings-welkom uit',
  surpriseT2hTitle: '🎁 {name}s vlucht is op tijd',
  surpriseT2hBody: 'Plan rond {clock} te vertrekken voor een perfect welkomstmoment',
  surpriseT45Title: '🎁 Vertrek over 45 minuten',
  surpriseT45Body: 'Je bent er net wanneer {name} de aankomsthal binnenloopt ✨',
  surpriseLeaveTitle: '🎁 Tijd om te gaan!',
  surpriseLeaveBody: 'Vertrek nu — precies wanneer {name} aankomt 🌟',
  surpriseLandedTitle: '✈️ {name} is geland!',
  surpriseLandedBody: 'Naar aankomst — bagage ~{bagMin} min · Maak je klaar voor het moment 🎁',
  startFlyTogether: '👥 Fly Together',
  togetherCreatedTitle: 'Je groep is klaar',
  togetherGroupNamePlaceholder: 'Groepsnaam (optioneel)',
  togetherCreateAction: 'Groep aanmaken',
  togetherCodeLabel: 'Groepscode: {code}',
  togetherCopyLink: 'Link kopiëren',
  togetherOpenGroup: 'Groep openen',
  togetherInviteMessage: 'Doe mee met onze Fly Together-groep "{name}" op WaiAir 👥\n{link} | Doe mee met onze Fly Together-groep op WaiAir 👥\n{link}',
  togetherJoinTitle: 'Meedoen met Fly Together',
  togetherCodePlaceholder: 'ABC123',
  togetherNamePlaceholder: 'Je naam',
  togetherJoinAction: 'Meedoen',
  togetherJoinFailed: 'Kon niet deelnemen aan deze groep',
  togetherInvalidCode: 'Voer een geldige groepscode in (ABC123)',
  togetherLiveTitle: '👥 {name}',
  togetherLiveTitleDefault: '👥 Fly Together',
  togetherYou: '(jij)',
  togetherLanded: 'Geland',
  togetherDelayed: 'Vertraagd',
  togetherInAir: 'In de lucht',
  togetherScheduled: 'Gepland',
  togetherEta: 'ETA {time}',
  togetherMapWebFallback: 'Live kaart beschikbaar in de iOS/Android-app',
  togetherAllArrivingToday: 'Iedereen komt vandaag aan op {dest}',
  togetherMeetAt: '📍 Ontmoet bij {place}',
  togetherEveryoneHere: 'Iedereen is er',
  togetherNotifyTitle: '👥 Fly Together',
  togetherNotifyLanded: '👥 {name} is geland op {dest}\n{others}',
  togetherOthersEnRoute: '{names} zijn nog onderweg',
  togetherNotifyDelayed: '⚠️ {name} heeft {min} min vertraging\nOverweeg op de luchthaven te wachten',
  togetherNotifyAllLanded: '✅ Iedereen is geland!\n{last} was als laatste — {gapMin} min na {first}',
  togetherStartFailed: 'Kon Fly Together-groep niet aanmaken',
  togetherEnterName: 'Voer je naam in voor de groep',
  gateRaceLandsAt: '{num} landt  Gate {gate}  · {term}    {time}',
  gateRaceWalkTo: 'Loop naar  Gate {gate} · {term}    {walk}',
  gateRaceBoardsAt: '{num} boarding              {time}',
  gateRaceOnlyMinClose: '⚠️ Nog {min} min — het wordt spannend!',
  gateRaceGotTime: 'Je hebt tijd',
  gateRaceClose: 'Het wordt spannend',
  gateRaceRunNotify: 'Ren! Meld gate-personeel',
  gateRaceNotifyLandingTitle: '⚡ Gate Race!',
  gateRaceNotifyLandingBody: 'Je hebt {min} min\nLoop naar Gate {gate} · {term} — ga nu!',
  gateRaceNotifyDelayTitle: '⚠️ Aansluiting in gevaar',
  gateRaceNotifyDelayBody: '⚠️ {inn} vertraagd — je aansluiting {out} loopt gevaar · Nog {min} min\nVraag cabinepersoneel om gate-hulp',
  gateRaceConnectionMissedTitle: '❌ Aansluiting gemist',
  gateRaceConnectionMissedBody: 'Vraag airline-personeel om omboeking\nJe rechten: EU261 kan van toepassing zijn',
  gateRaceLiveRemain: 'Nog {min} min tot boarding · blijf lopen',
  stillEnoughTime: 'Je hebt tijd',
  hurryUp: 'Het wordt spannend',
  runNow: 'Ren! Meld gate-personeel',
};
const NL = buildLocaleFromJson(EN, NL_STRINGS);

const DICT: Record<Locale, typeof EN> = {
  en: EN,
  nl: NL,
  zh: ZH,
  th: TH,
  de: DE,
  ru: RU,
  ja: JA,
  ko: KO,
  vi: VI,
};

let locale: Locale = 'en';

export function setLocale(next: Locale) {
  locale = next;
}

export function getLocale(): Locale {
  return locale;
}

export function t(): typeof EN {
  return DICT[locale] || EN;
}

/** Display label for a FIDS / tracked-flight status. */
export function flightStatusLabel(status: string): string {
  const copy = t();
  switch (status) {
    case 'boarding': return copy.boardingNow;
    case 'en-route': return copy.enRoute;
    case 'scheduled': return copy.scheduled;
    case 'delayed': return copy.delayed;
    case 'landed': return copy.landed;
    case 'cancelled': return copy.cancelled;
    case 'unknown': return copy.unknown;
    default: return copy.scheduled;
  }
}

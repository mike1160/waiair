/** Lightweight i18n catalog — swap locale later without rewriting UI. */

export type Locale = 'en' | 'nl';

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
  searchHint: 'Try a different flight number, airline or city',
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
  rateApp: 'Rate WaiAir',
  contact: 'Contact support',
  followUs: 'Follow us',
  widget: 'Home screen widget',
  enabled: 'Enabled',
  disabled: 'Disabled',
  english: 'English',
  dutch: 'Nederlands',
} as const;

const DICT: Record<Locale, typeof EN> = { en: EN, nl: EN };

let locale: Locale = 'en';

export function setLocale(next: Locale) {
  locale = next;
}

export function t(): typeof EN {
  return DICT[locale] || EN;
}

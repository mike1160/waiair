/**
 * The travel assistant on the home screen: where the "Your flight is in X days" card used to be, it now shows
 * what is useful in the phase the next flight is in (lib/flightPhase.ts) — a briefing weeks out, check-in and
 * packing in the last week, gate and weather on the day, the stopover, the flight, the arrival.
 *
 * No network in here: flight data, weather, exchange rate, the Gmail status and the hotel suggestion come in as
 * props, and a piece that is missing is simply not shown — never an empty state or an error. The only storage it
 * touches is its own: the passport date in the briefing, and "No, ignore" on a hotel suggestion.
 */
import { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatInTimeZone } from 'date-fns-tz';
import { STATUS_PILL_TONES, resolveStatusPillTone } from '../lib/statusPill';
import { useSquareStyles } from '../lib/modeContext';
import { getLocale, t } from '../lib/i18n';
import { dateFnsLocale } from '../lib/dateLocale';
import { timezoneForIata } from '../lib/airportTz';
import { formatAirportClock } from '../lib/flightTimes';
import { homeRelativeDayOffset, type HomeNowFlight } from '../lib/homeNow';
import type { ModuleId } from '../lib/modules';
import type { WeatherSnapshot } from '../lib/destinationServices';
import { formatSyncMoment, type GmailSyncStatus } from '../lib/gmailSyncStatus';
import { defaultPassportCode, visaTextForPassport } from '../lib/visaByPassport';
import { klookQuickActionUrl } from '../lib/destinationQuickLinks';
import { aviasalesSearchHomeUrl } from '../lib/aviasales';
import {
  DAY_MS,
  checkinOpensMs,
  checkinUrlFor,
  departureMs,
  formatDuration,
  formatFxLine,
  hotelDismissKey,
  packingTip,
  type FlightPhase,
  type HotelCandidate,
} from '../lib/flightPhase';

/** The passport date the briefing remembers; one per device, not per flight. */
const PASSPORT_KEY = 'hub:passport:validUntil';
/** How long "Hotel added to your trip" stays before the line goes. */
const LINKED_NOTE_MS = 4_000;

type Colors = { text: string; muted: string; accent: string; card: string; border: string; bg: string };

export type HubFlight = HomeNowFlight & {
  id: string;
  number: string;
  trackKey?: string;
  airline?: string;
  airlineCode?: string;
  origin: string;
  destination: string;
  destCity?: string;
  originCity?: string;
};

export type HubStopover = { city: string; nextNumber: string; msLeft: number; depGate?: string };
export type HubFx = { from: string; to: string; rate: number };

type Props = {
  flight: HubFlight;
  phase: FlightPhase;
  now: number;
  colors: Colors;
  hour12?: boolean;
  /** Latitude of the destination, for the packing tip. */
  destLat?: number | null;
  /** The card's own status, so the hub and the card above it never disagree. */
  status?: { label: string; tone: string } | null;
  /** Weather at the departure airport; `landingTemp` is the forecast for the departure time. */
  originWeather?: WeatherSnapshot | null;
  /** Weather at the destination; `landingTemp` is the forecast for the arrival time. */
  destWeather?: WeatherSnapshot | null;
  fx?: HubFx | null;
  stopover?: HubStopover | null;
  gmailStatus?: GmailSyncStatus | null;
  /** One waiting hotel near the arrival day (lib/flightPhase.ts hotelSuggestionFor), or nothing. */
  hotel?: HotelCandidate | null;
  onOpenModule: (id: ModuleId) => void;
  onGmailScan?: () => void;
  onShareTrip?: () => void;
  onLinkHotel?: (messageId: string) => void;
};

function cityOf(f: HubFlight, which: 'origin' | 'dest'): string {
  return which === 'dest' ? (f.destCity || f.destination) : (f.originCity || f.origin);
}

function round(n: number): string {
  return String(Math.round(n));
}

export default function FlightAssistantHub(props: Props) {
  const {
    flight: f, phase, now, colors: c, hour12 = false, destLat, status, originWeather, destWeather, fx,
    stopover, gmailStatus, hotel, onOpenModule, onGmailScan, onShareTrip, onLinkHotel,
  } = props;
  const styles = useSquareStyles(baseStyles);
  const copy = t();
  const locale = getLocale();
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [hotelHidden, setHotelHidden] = useState(true);
  const [hotelLinkedAt, setHotelLinkedAt] = useState<number | null>(null);
  const flightId = f.trackKey || f.id;

  // A hotel the user said no to stays hidden for this flight; until the answer is read, nothing shows.
  useEffect(() => {
    let alive = true;
    setHotelHidden(true);
    AsyncStorage.getItem(hotelDismissKey(flightId))
      .then(v => { if (alive) setHotelHidden(v === '1'); })
      .catch(() => { if (alive) setHotelHidden(false); });
    return () => { alive = false; };
  }, [flightId]);

  useEffect(() => {
    if (hotelLinkedAt == null) return undefined;
    const id = setTimeout(() => setHotelLinkedAt(null), LINKED_NOTE_MS);
    return () => clearTimeout(id);
  }, [hotelLinkedAt]);

  const dep = departureMs(f);
  const calendarDays = dep == null ? null : homeRelativeDayOffset(dep, now, f.origin, f.originCountry);
  const destCity = cityOf(f, 'dest');
  const originCity = cityOf(f, 'origin');

  /** "Tue 20 Oct 21:40" at the departure airport — check-in opens on the airport's clock, not the phone's. */
  const atOrigin = (ms: number): string => {
    try {
      return formatInTimeZone(ms, timezoneForIata(f.origin, f.originCountry), hour12 ? 'EEE d MMM h:mm a' : 'EEE d MMM HH:mm', {
        locale: dateFnsLocale(locale),
      });
    } catch {
      return '';
    }
  };

  const gmailLine = (() => {
    if (!onGmailScan) return '';
    if (!gmailStatus) return copy.hubGmailNeverScanned;
    const when = copy.hubGmailStatus(formatSyncMoment(gmailStatus.ms, locale));
    return `${when} · ${gmailStatus.found > 0 ? copy.hubGmailFound(gmailStatus.found) : copy.hubGmailNothingNew}`;
  })();

  const checkinUrl = checkinUrlFor(f.airlineCode);
  const checkinLine = (): { text: string; url: string | null } | null => {
    if (checkinUrl) return { text: copy.hubCheckinOnline, url: checkinUrl };
    return f.airline ? { text: copy.hubCheckinWith(f.airline), url: null } : null;
  };

  const tip = dep == null ? null : packingTip(destLat, new Date(dep).getUTCMonth());
  const destClock = formatAirportClock(new Date(now).toISOString(), f.destination, hour12, f.destCountry);
  // Only offered when it can actually be linked: "Hotel added" must never show for a link that did not happen.
  const showHotel = !!hotel && !!onLinkHotel && !hotelHidden && (phase === 'PRACTICAL' || phase === 'FINAL');

  // ── What each phase says ────────────────────────────────────────────────────────────────────────
  let title = '';
  let sub = '';
  let onPressTitle: (() => void) | undefined;
  const rows: { key: string; text: string; onPress?: () => void; strong?: boolean }[] = [];
  const addRow = (key: string, text: string | null | undefined, onPress?: () => void) => {
    if (text) rows.push({ key, text, onPress });
  };
  const openUrl = (url: string) => { void Linking.openURL(url).catch(() => {}); };

  switch (phase) {
    case 'PREP': {
      title = calendarDays != null && calendarDays > 0 ? copy.hubPrep(calendarDays) : copy.hubPrepTap;
      sub = calendarDays != null && calendarDays > 0 ? copy.hubPrepTap : '';
      onPressTitle = () => setBriefingOpen(true);
      break;
    }
    case 'PRACTICAL': {
      const opens = checkinOpensMs(f);
      const days = opens == null ? null : Math.max(1, Math.ceil((opens - now) / DAY_MS));
      title = days != null ? copy.hubPractical(days) : copy.hubPrepTap;
      break;
    }
    case 'FINAL': {
      const opens = checkinOpensMs(f);
      title = opens != null && now >= opens ? copy.hubCheckinNow : opens != null ? copy.hubFinal(atOrigin(opens)) : copy.hubCheckinNow;
      const ci = checkinLine();
      if (ci) addRow('checkin', ci.text, ci.url ? () => openUrl(ci.url as string) : undefined);
      if (destWeather?.landingTemp != null) addRow('weather', copy.hubWeatherLand(round(destWeather.landingTemp), destCity));
      if (tip === 'sunscreen') addRow('pack', copy.hubPackSunscreen);
      if (tip === 'coat') addRow('pack', copy.hubPackCoat);
      break;
    }
    case 'EVE': {
      title = calendarDays === 1 ? copy.hubEve : calendarDays === 2 ? copy.hubEveDayAfter : copy.hubEveInDays(Math.max(1, calendarDays ?? 1));
      addRow('gate', f.gate ? copy.hubGate(f.gate) : copy.hubGateTbd);
      if (originWeather?.landingTemp != null) addRow('weather', copy.hubWeatherLeave(round(originWeather.landingTemp), originCity));
      if (onShareTrip) addRow('share', copy.hubShareTrip, onShareTrip);
      const ci = checkinLine();
      if (ci) addRow('checkin', ci.text, ci.url ? () => openUrl(ci.url as string) : undefined);
      break;
    }
    case 'DEPARTURE': {
      title = copy.hubDeparture(destCity);
      addRow('gate', f.gate ? copy.hubGate(f.gate) : copy.hubGateTbd);
      if (originWeather) addRow('weather', copy.hubWeatherNow(round(originWeather.temp), originCity));
      if (destClock) addRow('clock', copy.hubLocalTime(destCity, destClock));
      break;
    }
    case 'STOPOVER': {
      title = copy.hubStopover(stopover?.city || originCity);
      if (stopover) addRow('left', copy.hubStopoverLeft(formatDuration(stopover.msLeft), stopover.nextNumber));
      const gate = stopover?.depGate || f.gate;
      addRow('gate', gate ? copy.hubGate(gate) : copy.hubGateTbd);
      addRow('food', copy.hubStopoverFood);
      addRow('lounge', copy.hubLounges, () => onOpenModule('lounge'));
      break;
    }
    case 'INFLIGHT': {
      title = copy.hubInflight;
      if (destClock) addRow('clock', copy.hubLocalTime(destCity, destClock));
      if (destWeather?.landingTemp != null) addRow('weather', copy.hubWeatherLand(round(destWeather.landingTemp), destCity));
      addRow('belt', copy.hubBeltAfterLanding);
      if (onShareTrip) addRow('pickup', copy.hubPickup, onShareTrip);
      break;
    }
    case 'ARRIVED': {
      title = copy.hubArrived(destCity);
      if (f.baggage) addRow('belt', copy.hubBelt(f.baggage));
      if (destWeather) addRow('weather', copy.hubWeatherNow(round(destWeather.temp), destCity));
      addRow('transport', copy.hubTransportCity, () => onOpenModule('transport'));
      const fxLine = fx ? formatFxLine(fx) : null;
      if (fxLine) addRow('fx', fxLine);
      break;
    }
    case 'COMPLETED':
    default:
      break;
  }

  // ── A finished trip: one quiet line and one small link, nothing more ──────────────────────────────
  if (phase === 'COMPLETED') {
    return (
      <View style={[styles.quiet, { borderColor: c.border }]}>
        <Text style={[styles.quietTxt, { color: c.muted }]}>{copy.hubCompleted}</Text>
        <Pressable onPress={() => openUrl(aviasalesSearchHomeUrl())} hitSlop={8} accessibilityRole="link">
          <Text style={[styles.quietLink, { color: c.accent }]}>{copy.affiliateNewTripLink}</Text>
        </Pressable>
        {gmailLine ? (
          <Pressable onPress={onGmailScan} hitSlop={6} accessibilityRole="button">
            <Text style={[styles.gmail, { color: c.muted }]} numberOfLines={1}>{gmailLine}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const Title = (
    <>
      <Text style={[styles.kicker, { color: c.accent }]}>{copy.homeNowKicker}</Text>
      <Text style={[styles.title, { color: c.text }]}>{title}</Text>
      {sub ? <Text style={[styles.sub, { color: c.muted }]}>{sub}</Text> : null}
    </>
  );

  return (
    <View style={[styles.card, { backgroundColor: c.card, borderColor: c.border }]}>
      {onPressTitle ? (
        <Pressable onPress={onPressTitle} accessibilityRole="button" accessibilityLabel={title}>{Title}</Pressable>
      ) : (
        <View>{Title}</View>
      )}

      {phase === 'DEPARTURE' && status?.label ? (
        // Departure day: the status is the one thing that matters, so it is big — in the card's own tone colour.
        <Text
          style={[styles.statusBig, { color: STATUS_PILL_TONES[resolveStatusPillTone(status.tone)].fg }]}
          accessibilityRole="header"
        >
          {status.label}
        </Text>
      ) : null}

      {rows.length ? (
        <View style={styles.rows}>
          {rows.map(r => (r.onPress ? (
            <Pressable key={r.key} onPress={r.onPress} hitSlop={6} accessibilityRole="button" style={styles.row}>
              <Text style={[styles.rowTxt, { color: c.accent }]}>{r.text}</Text>
            </Pressable>
          ) : (
            <View key={r.key} style={styles.row}>
              <Text style={[styles.rowTxt, { color: c.text }]}>{r.text}</Text>
            </View>
          )))}
        </View>
      ) : null}

      {showHotel && hotel ? (
        <View style={[styles.hotel, { borderColor: c.border }]}>
          <Text style={[styles.rowTxt, { color: c.text }]}>{copy.hubHotelSuggest(hotel.title)}</Text>
          <View style={styles.hotelBtns}>
            <Pressable
              onPress={() => { onLinkHotel?.(hotel.messageId); setHotelLinkedAt(Date.now()); setHotelHidden(true); }}
              style={[styles.hotelBtn, { borderColor: c.accent }]}
              accessibilityRole="button"
            >
              <Text style={[styles.hotelBtnTxt, { color: c.accent }]}>{copy.hubHotelLink}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setHotelHidden(true);
                void AsyncStorage.setItem(hotelDismissKey(flightId), '1').catch(() => {});
              }}
              style={[styles.hotelBtn, { borderColor: c.border }]}
              accessibilityRole="button"
            >
              <Text style={[styles.hotelBtnTxt, { color: c.muted }]}>{copy.hubHotelDismiss}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {hotelLinkedAt != null ? (
        <Text style={[styles.rowTxt, { color: c.accent }]}>{copy.hubHotelLinked}</Text>
      ) : null}

      {phase === 'PRACTICAL' ? (
        <Pressable onPress={() => openUrl(klookQuickActionUrl(destCity, f.destination))} hitSlop={6} accessibilityRole="link">
          <Text style={[styles.subtle, { color: c.muted }]}>{copy.hubExcursion(destCity)}</Text>
        </Pressable>
      ) : null}

      {gmailLine ? (
        <Pressable onPress={onGmailScan} hitSlop={6} accessibilityRole="button">
          <Text style={[styles.gmail, { color: c.muted }]} numberOfLines={1}>{gmailLine}</Text>
        </Pressable>
      ) : null}

      <Briefing
        visible={briefingOpen}
        onClose={() => setBriefingOpen(false)}
        flight={f}
        colors={c}
        fx={fx}
        gmailLine={gmailLine}
        onGmailScan={onGmailScan ? () => { setBriefingOpen(false); onGmailScan(); } : undefined}
      />
    </View>
  );
}

/** PREP: a short briefing weeks before the trip — passport, visa, exchange rate, travel emails. */
function Briefing({
  visible, onClose, flight: f, colors: c, fx, gmailLine, onGmailScan,
}: {
  visible: boolean;
  onClose: () => void;
  flight: HubFlight;
  colors: Colors;
  fx?: HubFx | null;
  gmailLine: string;
  onGmailScan?: () => void;
}) {
  const styles = useSquareStyles(baseStyles);
  const copy = t();
  const [passport, setPassport] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    if (!visible) return;
    AsyncStorage.getItem(PASSPORT_KEY)
      .then(v => { const s = String(v || ''); setPassport(s); setSaved(s); })
      .catch(() => {});
  }, [visible]);

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(passport.trim());
  const visa = f.destCountry ? visaTextForPassport(f.destCountry, defaultPassportCode(), '') : '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={copy.close} />
      <View style={[styles.sheet, { backgroundColor: c.bg, borderColor: c.border }]}>
        <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
          <Text style={[styles.sheetTitle, { color: c.text }]}>{copy.hubBriefingTitle}</Text>

          <Text style={[styles.label, { color: c.muted }]}>{copy.hubPassportLabel}</Text>
          <View style={styles.passportRow}>
            <TextInput
              value={passport}
              onChangeText={setPassport}
              placeholder={copy.hubPassportPlaceholder}
              placeholderTextColor={c.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="numbers-and-punctuation"
              style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
              accessibilityLabel={copy.hubPassportLabel}
            />
            <Pressable
              onPress={() => {
                const v = passport.trim();
                void AsyncStorage.setItem(PASSPORT_KEY, v).catch(() => {});
                setSaved(v);
              }}
              disabled={!valid || passport.trim() === saved}
              style={[styles.saveBtn, { borderColor: c.accent, opacity: valid && passport.trim() !== saved ? 1 : 0.4 }]}
              accessibilityRole="button"
            >
              <Text style={[styles.hotelBtnTxt, { color: c.accent }]}>{copy.hubPassportSave}</Text>
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: c.muted }]}>{copy.hubPassportHint}</Text>

          {visa ? (
            <>
              <Text style={[styles.label, { color: c.muted }]}>{copy.hubVisaTitle}</Text>
              <Text style={[styles.rowTxt, { color: c.text }]}>{visa}</Text>
            </>
          ) : null}

          {fx ? (
            <>
              <Text style={[styles.label, { color: c.muted }]}>{copy.hubFxTitle}</Text>
              <Text style={[styles.rowTxt, { color: c.text }]}>{formatFxLine(fx)}</Text>
            </>
          ) : null}

          {gmailLine ? (
            <>
              <Text style={[styles.label, { color: c.muted }]}>{copy.hubGmailTitle}</Text>
              <Pressable onPress={onGmailScan} accessibilityRole="button">
                <Text style={[styles.rowTxt, { color: c.accent }]}>{gmailLine}</Text>
              </Pressable>
            </>
          ) : null}

          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button">
            <Text style={[styles.hotelBtnTxt, { color: c.muted }]}>{copy.close}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const baseStyles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { fontSize: 20, fontWeight: '700', lineHeight: 26, marginTop: 2 },
  sub: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  statusBig: { fontSize: 28, fontWeight: 'bold' },
  rows: { gap: 6 },
  row: { paddingVertical: 2 },
  rowTxt: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  subtle: { fontSize: 12, fontWeight: '500' },
  gmail: { fontSize: 12, fontWeight: '500' },
  hotel: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 8 },
  hotelBtns: { flexDirection: 'row', gap: 8 },
  hotelBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12 },
  hotelBtnTxt: { fontSize: 14, fontWeight: '600' },
  quiet: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 4, alignItems: 'flex-start' },
  quietTxt: { fontSize: 13, fontWeight: '500' },
  quietLink: { fontSize: 13, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, maxHeight: '80%' },
  sheetBody: { padding: 20, gap: 8, paddingBottom: 36 },
  sheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginTop: 10 },
  passportRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15 },
  saveBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  hint: { fontSize: 12, lineHeight: 17 },
  closeBtn: { alignSelf: 'center', paddingVertical: 12, marginTop: 8 },
});

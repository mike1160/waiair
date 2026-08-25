import { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'phosphor-react-native';
import AirlineLogo, { AIRLINE_LOGO_SIZE } from './AirlineLogo';
import MilesWallet from './components/MilesWallet';
import QuickShareRow from './components/QuickShareRow';
import { AIRLINE_MILES } from './components/MilesUpgradeCard';
import { lookupAircraft } from './constants/aircraftInfo';
import { airportRecByIata } from './lib/airportsDb';
import type { BoardingPassInfo } from './lib/bcbp';
import {
  calculateCO2,
  cabinClassFromCompartment,
  estimatedAwardMiles,
  OFFSET_URLS,
} from './lib/carbonFootprint';
import { haversineKm } from './lib/eu261';
import {
  estimateCruiseAltFt,
  formatPassportDuration,
  formatPassportKm,
  loadPassportEntries,
  type PassportEntry,
} from './lib/flightPassport';
import { isoInAirportTzToUtcMs } from './lib/localFlightTime';
import { t } from './lib/i18n';
import { getMembership, type MilesMembership } from './lib/milesStorage';

const NAVY = '#0D1B2E';
const GOLD = '#C9A84C';
const CREAM = '#F5F0E8';
const MUTED = '#8896B0';
const CARD = 'rgba(255,255,255,0.06)';
const BORDER = 'rgba(255,255,255,0.08)';

export type MyFlightInput = {
  number: string;
  airline: string;
  airlineCode: string;
  origin: string;
  originCity: string;
  originCountry: string;
  destination: string;
  destCity: string;
  destCountry: string;
  aircraft: string;
  altitudeFt?: number;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  actualDeparture?: string;
  actualArrival?: string;
  departureTime?: string;
  arrivalTime?: string;
  scheduledTime?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  flight: MyFlightInput;
  originIata: string;
  destIata: string;
  originCity: string;
  destCity: string;
  boardingPass?: BoardingPassInfo | null;
};

function fmtInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

function distanceKmFor(flight: MyFlightInput, originIata: string, destIata: string, passport?: PassportEntry | null): number {
  if (passport?.distanceKm && passport.distanceKm > 0) return passport.distanceKm;
  const o = airportRecByIata(originIata || flight.origin);
  const d = airportRecByIata(destIata || flight.destination);
  if (o && d) return Math.round(haversineKm(o.lat, o.lon, d.lat, d.lon));
  return 0;
}

function durationMsFor(flight: MyFlightInput, originIata: string, destIata: string, passport?: PassportEntry | null): number {
  if (passport?.durationMs && passport.durationMs > 0) return passport.durationMs;
  const dep = flight.actualDeparture || flight.departureTime || flight.scheduledDeparture || flight.scheduledTime || '';
  const arr = flight.actualArrival || flight.arrivalTime || flight.scheduledArrival || '';
  const a = isoInAirportTzToUtcMs(dep, originIata, flight.originCountry);
  const b = isoInAirportTzToUtcMs(arr, destIata, flight.destCountry);
  if (a == null || b == null || b <= a) return 0;
  return b - a;
}

export default function MyFlightScreen({
  visible,
  onClose,
  flight,
  originIata,
  destIata,
  originCity,
  destCity,
  boardingPass,
}: Props) {
  const copy = t();
  const [shareBusy, setShareBusy] = useState(false);
  const code = String(flight.airlineCode || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  const miles = AIRLINE_MILES[code];
  const [membership, setMembership] = useState<MilesMembership | null>(null);
  const [passport, setPassport] = useState<PassportEntry | null>(null);

  useEffect(() => {
    if (!visible) return;
    getMembership(code).then(setMembership).catch(() => setMembership(null));
    const slug = String(flight.number || '').replace(/\s+/g, '').toUpperCase();
    loadPassportEntries()
      .then(list => setPassport(list.find(e => e.flightNumber === slug) || null))
      .catch(() => setPassport(null));
  }, [visible, code, flight.number]);

  const km = useMemo(
    () => distanceKmFor(flight, originIata, destIata, passport),
    [flight, originIata, destIata, passport],
  );
  const durMs = useMemo(
    () => durationMsFor(flight, originIata, destIata, passport),
    [flight, originIata, destIata, passport],
  );
  const cabin = cabinClassFromCompartment(boardingPass?.compartment);
  const milesEst = estimatedAwardMiles(km, cabin);
  const co2 = calculateCO2(km);
  const ac = lookupAircraft(flight.aircraft);
  const aircraftLabel = ac?.name || flight.aircraft || '—';
  const altFt = flight.altitudeFt || passport?.altitudeFt || estimateCruiseAltFt(km);
  const countries = [flight.originCountry, flight.destCountry]
    .map(c => String(c || '').toUpperCase())
    .filter((c, i, arr) => c.length === 2 && arr.indexOf(c) === i);

  const routeLine = `${flight.number} · ${originCity || originIata} → ${destCity || destIata}`;
  const shareMsg = [
    routeLine,
    km > 0 ? `${copy.myFlightDistance}: ${formatPassportKm(km)} km` : '',
    durMs > 0 ? `${copy.myFlightTime}: ${formatPassportDuration(durMs)}` : '',
    km > 0 ? copy.myFlightCo2This(fmtInt(co2.kg)) : '',
    milesEst > 0 && membership ? copy.myFlightEstimatedMiles(fmtInt(milesEst)) : '',
  ].filter(Boolean).join('\n');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={st.root}>
        <View style={st.head}>
          <Text style={st.headTitle}>{copy.myFlight}</Text>
          <TouchableOpacity onPress={onClose} style={st.close} accessibilityLabel={copy.importClose}>
            <X size={16} color={GOLD} weight="bold" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false}>
          <View style={st.hero}>
            <AirlineLogo iata={code} name={flight.airline} size={AIRLINE_LOGO_SIZE} />
            <View style={{ flex: 1 }}>
              <Text style={st.flightNo}>{flight.number}</Text>
              <Text style={st.route}>{routeLine}</Text>
            </View>
          </View>

          <Text style={st.section}>{copy.myFlightMilesHeader}</Text>
          <View style={st.card}>
            {membership ? (
              <>
                <Text style={st.program}>{membership.program}</Text>
                <View style={st.rowBetween}>
                  <Text style={st.number}>
                    {membership.memberNumber.length <= 6
                      ? `${membership.memberNumber.slice(0, 2)}***${membership.memberNumber.slice(-1)}`
                      : `${membership.memberNumber.slice(0, 4)}***${membership.memberNumber.slice(-2)}`}
                  </Text>
                  <View style={st.tier}>
                    <Text style={st.tierTxt}>{membership.tier.toUpperCase()}</Text>
                  </View>
                </View>
                {km > 0 ? (
                  <Text style={st.est}>{copy.myFlightEstimatedMiles(fmtInt(milesEst))}</Text>
                ) : null}
                {miles ? (
                  <TouchableOpacity onPress={() => { void Linking.openURL(miles.milesUrl); }}>
                    <Text style={st.link}>{copy.myFlightViewAccount}</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : miles ? (
              <>
                <Text style={st.hint}>{copy.myFlightSaveFf}</Text>
                <MilesWallet airlineCode={code} program={miles.program} milesUrl={miles.milesUrl} />
              </>
            ) : (
              <Text style={st.hint}>{copy.myFlightSaveFf}</Text>
            )}
          </View>

          {miles?.upgradeUrl ? (
            <>
              <Text style={st.section}>{copy.myFlightUpgradeHeader}</Text>
              <View style={[st.card, st.goldCard]}>
                <Text style={st.goldTitle}>{copy.myFlightBidAvailable}</Text>
                <Text style={st.hint}>{flight.airline} · {miles.program}</Text>
                <TouchableOpacity onPress={() => { void Linking.openURL(miles.upgradeUrl); }}>
                  <Text style={st.link}>{copy.myFlightOpenUpgrade}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}

          {km > 0 ? (
            <>
              <Text style={st.section}>{copy.myFlightCarbonHeader}</Text>
              <View style={st.card}>
                <Text style={st.co2}>{copy.myFlightCo2This(fmtInt(co2.kg))}</Text>
                <Text style={st.equiv}>{copy.myFlightDriving(fmtInt(co2.carKm))}</Text>
                <Text style={st.equiv}>{copy.myFlightEnergyDays(fmtInt(co2.energyDays))}</Text>
                <TouchableOpacity style={st.offsetBtn} onPress={() => { void Linking.openURL(OFFSET_URLS.mossyEarth); }}>
                  <Text style={st.offsetTxt}>{copy.myFlightOffsetMossy}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.offsetBtn} onPress={() => { void Linking.openURL(OFFSET_URLS.goldStandard); }}>
                  <Text style={st.offsetTxt}>{copy.myFlightOffsetGold}</Text>
                </TouchableOpacity>
                <Text style={st.disclaimer}>{copy.myFlightCarbonDisclaimer}</Text>
              </View>
            </>
          ) : null}

          <Text style={st.section}>{copy.myFlightStatsHeader}</Text>
          <View style={st.card}>
            {km > 0 ? <Text style={st.stat}>📍 {copy.myFlightDistance}: {formatPassportKm(km)} km</Text> : null}
            {durMs > 0 ? <Text style={st.stat}>⏱ {copy.myFlightTime}: {formatPassportDuration(durMs)}</Text> : null}
            <Text style={st.stat}>✈️ {copy.myFlightAircraft}: {aircraftLabel}</Text>
            {altFt ? <Text style={st.stat}>🏔 {copy.myFlightAltitude}: ~{fmtInt(altFt)} ft</Text> : null}
            {countries.length ? (
              <Text style={st.stat}>🌍 {copy.myFlightCountries}: {countries.join(' · ')}</Text>
            ) : null}
          </View>

          <Text style={st.shareLbl}>{copy.myFlightShareStats}</Text>
          <QuickShareRow
            mode="text"
            message={shareMsg}
            busy={shareBusy}
            onBusy={setShareBusy}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: NAVY, paddingTop: Platform.OS === 'ios' ? 56 : 24 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  headTitle: { color: CREAM, fontSize: 18, fontWeight: '800' },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#12233C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 18, paddingBottom: 40 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  flightNo: { color: CREAM, fontSize: 16, fontWeight: '800' },
  route: { color: MUTED, fontSize: 13, fontWeight: '600', marginTop: 4 },
  section: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 6,
  },
  card: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  goldCard: {
    borderColor: 'rgba(201,168,76,0.45)',
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  goldTitle: { color: GOLD, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  program: { color: GOLD, fontSize: 13, fontWeight: '800', marginBottom: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  number: { color: CREAM, fontSize: 16, fontWeight: '700', letterSpacing: 0.6, flex: 1 },
  tier: { backgroundColor: GOLD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tierTxt: { color: NAVY, fontSize: 10, fontWeight: '800' },
  est: { color: CREAM, fontSize: 14, fontWeight: '700', marginTop: 10 },
  hint: { color: MUTED, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  link: { color: GOLD, fontSize: 13, fontWeight: '800', marginTop: 12 },
  co2: { color: CREAM, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  equiv: { color: MUTED, fontSize: 13, fontWeight: '600', marginTop: 4 },
  offsetBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.4)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  offsetTxt: { color: GOLD, fontSize: 13, fontWeight: '800' },
  disclaimer: { color: MUTED, fontSize: 11, fontWeight: '600', marginTop: 12, lineHeight: 16 },
  stat: { color: CREAM, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  shareLbl: { color: GOLD, fontSize: 12, fontWeight: '800', marginBottom: 8 },
});

/**
 * Hotel/transfer overview — everything saved in the trip-extras sheet (hotel, car rental, transfer),
 * shown on the flight detail page under "Hotel & Transfer" right after Opslaan.
 * Each card shows every saved field in full, the "Geïmporteerd uit Gmail" label when it came from Gmail,
 * and an edit button that reopens the sheet on that tab.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bed, Car, PencilSimple, Van } from 'phosphor-react-native';
import { CarRentalLogo, rentalBrandFor } from './CarRentalLogoRow';
import { haptics } from './lib/haptics';
import { t } from './lib/i18n';
import { callPhone, openMapsQuery, type TripExtras, type TripExtrasSource } from './lib/tripExtras';

export type TripExtrasTab = 'hotel' | 'car' | 'transfer';

type Theme = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
  card: string;
};

/** "2026-09-18T14:00" → "2026-09-18 14:00"; other text unchanged. */
function when(v?: string): string {
  return String(v || '').replace(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}).*$/, '$1 $2');
}

function Row({ label, value, theme }: { label: string; value?: string; theme: Theme }) {
  if (!value) return null;
  return (
    <View style={st.row}>
      <Text style={[st.rowLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[st.rowValue, { color: theme.text }]} selectable>{value}</Text>
    </View>
  );
}

function Card({
  kicker,
  title,
  icon,
  source,
  theme,
  onEdit,
  children,
}: {
  kicker: string;
  title?: string;
  icon: React.ReactNode;
  source?: TripExtrasSource;
  theme: Theme;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  const copy = t();
  return (
    <View style={[st.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={st.head}>
        {icon}
        <View style={{ flex: 1 }}>
          <Text style={[st.kicker, { color: theme.accent }]}>{kicker}</Text>
          {title ? <Text style={[st.title, { color: theme.text }]}>{title}</Text> : null}
          {source === 'gmail' ? <Text style={[st.gmail, { color: theme.accent, borderColor: theme.accent }]}>{copy.importedFromGmail}</Text> : null}
        </View>
        <Pressable
          onPress={() => { haptics.light(); onEdit(); }}
          hitSlop={8}
          style={[st.edit, { borderColor: theme.border }]}
          accessibilityRole="button"
          accessibilityLabel={`${copy.tripExtrasEdit} ${kicker}`}
        >
          <PencilSimple size={14} color={theme.accent} weight="bold" />
          <Text style={[st.editTxt, { color: theme.accent }]}>{copy.tripExtrasEdit}</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

export default function TripExtrasOverview({
  extras,
  theme,
  onEdit,
}: {
  extras?: TripExtras | null;
  theme: Theme;
  onEdit: (tab: TripExtrasTab) => void;
}) {
  const copy = t();
  // The sheet pre-fills hotel check-in (arrival date) and transfer pickup (airport code); saving another tab
  // stores those too. Only show an item the user actually filled in.
  const rawHotel = extras?.hotel;
  const hotel = rawHotel && (rawHotel.name || rawHotel.address || rawHotel.confirmationRef) ? rawHotel : undefined;
  const car = extras?.carRental;
  const rawTransfer = extras?.transfer;
  const transfer = rawTransfer && (
    rawTransfer.provider || rawTransfer.dropoffLocation || rawTransfer.pickupTime || rawTransfer.confirmationRef
    || rawTransfer.driverName || rawTransfer.driverPhone || rawTransfer.vehicleDescription
  ) ? rawTransfer : undefined;
  if (!hotel && !car && !transfer) return null;
  const brand = rentalBrandFor(car?.company);
  const hotelQuery = [hotel?.name, hotel?.address].filter(Boolean).join(', ');

  return (
    <View style={st.wrap}>
      {hotel ? (
        <Card
          kicker={copy.tripExtrasYourHotel}
          title={hotel.name}
          icon={<Bed size={20} color={theme.accent} />}
          source={hotel.source}
          theme={theme}
          onEdit={() => onEdit('hotel')}
        >
          <Row theme={theme} label={copy.tripExtrasAddress} value={hotel.address} />
          <Row theme={theme} label={copy.tripExtrasCheckIn} value={when(hotel.checkIn)} />
          <Row theme={theme} label={copy.tripExtrasCheckOut} value={when(hotel.checkOut)} />
          <Row theme={theme} label={copy.tripExtrasConfRef} value={hotel.confirmationRef} />
          {hotelQuery ? (
            <Pressable style={[st.action, { backgroundColor: theme.accent }]} onPress={() => { void openMapsQuery(hotelQuery); }} accessibilityRole="button">
              <Text style={st.actionTxt}>{copy.tripExtrasNavigate}</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {car ? (
        <Card
          kicker={copy.tripExtrasYourCar}
          title={car.company}
          icon={brand ? <CarRentalLogo brand={brand} size="sm" /> : <Car size={20} color={theme.accent} />}
          source={car.source}
          theme={theme}
          onEdit={() => onEdit('car')}
        >
          <Row theme={theme} label={copy.tripExtrasPickupLoc} value={car.pickupLocation} />
          <Row theme={theme} label={copy.tripExtrasPickupTime} value={when(car.pickupTime)} />
          <Row theme={theme} label={copy.tripExtrasDropoffLoc} value={car.dropoffLocation} />
          <Row theme={theme} label={copy.tripExtrasDropoffTime} value={when(car.dropoffTime)} />
          <Row theme={theme} label={copy.tripExtrasConfRef} value={car.confirmationRef} />
          {car.pickupLocation ? (
            <Pressable style={[st.action, { backgroundColor: theme.accent }]} onPress={() => { void openMapsQuery(car.pickupLocation || ''); }} accessibilityRole="button">
              <Text style={st.actionTxt}>{copy.tripExtrasNavPickup}</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}

      {transfer ? (
        <Card
          kicker={copy.tripExtrasYourTransfer}
          title={transfer.provider}
          icon={<Van size={20} color={theme.accent} />}
          source={transfer.source}
          theme={theme}
          onEdit={() => onEdit('transfer')}
        >
          <Row theme={theme} label={copy.tripExtrasPickupLoc} value={transfer.pickupLocation} />
          <Row theme={theme} label={copy.tripExtrasDropoffLoc} value={transfer.dropoffLocation} />
          <Row theme={theme} label={copy.tripExtrasPickupTime} value={when(transfer.pickupTime)} />
          <Row theme={theme} label={copy.tripExtrasDriver} value={transfer.driverName} />
          <Row theme={theme} label={copy.tripExtrasDriverPhone} value={transfer.driverPhone} />
          <Row theme={theme} label={copy.tripExtrasVehicle} value={transfer.vehicleDescription} />
          <Row theme={theme} label={copy.tripExtrasConfRef} value={transfer.confirmationRef} />
          {transfer.driverPhone ? (
            <Pressable style={[st.action, { backgroundColor: theme.accent }]} onPress={() => { void callPhone(transfer.driverPhone); }} accessibilityRole="button">
              <Text style={st.actionTxt}>{copy.tripExtrasCallDriver}</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: 10, marginTop: 10, marginBottom: 6 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 4 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 16, fontWeight: '800', marginTop: 2 },
  gmail: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '800',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  editTxt: { fontSize: 12, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  rowLabel: { width: 112, fontSize: 12, fontWeight: '600', lineHeight: 18 },
  rowValue: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  action: { alignSelf: 'flex-start', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12, marginTop: 6 },
  actionTxt: { color: '#0D1B2E', fontSize: 12, fontWeight: '800' },
});

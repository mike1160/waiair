/**
 * Car rental logos — huurauto tab only. Hardcoded rental companies (no API): a horizontal row of cards with
 * the brand wordmark in its brand colour, the company name and a "Boek nu" button that opens the site in the browser.
 * The wordmarks are drawn in code, so no image assets or network calls are needed.
 */
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { haptics } from './lib/haptics';
import { t } from './lib/i18n';

const GOLD = '#C9A84C';
const NAVY = '#0D1B2E';
const FIELD = '#12233C';
const CREAM = '#F5F0E8';

type RentalBrand = {
  name: string;
  url: string;
  /** Brand colour (logo background). */
  bg: string;
  /** Wordmark colour, chosen for contrast on `bg`. */
  fg: string;
  /** Wordmark text as the brand prints it. */
  mark: string;
  markStyle?: TextStyle;
  /** Optional accent bar under the wordmark (Europcar yellow). */
  accent?: string;
};

export const CAR_RENTAL_BRANDS: readonly RentalBrand[] = [
  // International
  { name: 'Hertz', url: 'https://www.hertz.com', bg: '#FFD700', fg: '#000000', mark: 'Hertz', markStyle: { fontStyle: 'italic', fontWeight: '900', letterSpacing: -0.5 } },
  { name: 'Avis', url: 'https://www.avis.com', bg: '#CC0000', fg: '#FFFFFF', mark: 'AVIS', markStyle: { fontWeight: '900', letterSpacing: 1.5 } },
  { name: 'Budget', url: 'https://www.budget.com', bg: '#E31837', fg: '#FFFFFF', mark: 'Budget', markStyle: { fontWeight: '800' } },
  { name: 'Sixt', url: 'https://www.sixt.com', bg: '#FF6600', fg: '#000000', mark: 'SIXT', markStyle: { fontWeight: '900', letterSpacing: 1 } },
  { name: 'Europcar', url: 'https://www.europcar.com', bg: '#00843D', fg: '#FFFFFF', mark: 'Europcar', markStyle: { fontWeight: '800', fontSize: 13 }, accent: '#FFE500' },
  { name: 'Enterprise', url: 'https://www.enterprise.com', bg: '#006747', fg: '#FFFFFF', mark: 'Enterprise', markStyle: { fontWeight: '800', fontSize: 12 } },
  // Asia / Thailand
  // www.thairentacar.com does not answer over HTTPS; the bare domain does.
  { name: 'Thai Rent A Car', url: 'https://thairentacar.com', bg: '#E31837', fg: '#FFFFFF', mark: 'Thai Rent A Car', markStyle: { fontWeight: '800', fontSize: 11 } },
  { name: 'Drive Car Rental', url: 'https://www.drivecarrental.com', bg: '#1A73E8', fg: '#FFFFFF', mark: 'DRIVE', markStyle: { fontWeight: '900', letterSpacing: 1 } },
  { name: 'ASAP Car Rental', url: 'https://www.asapcarrental.com', bg: '#FF6600', fg: '#FFFFFF', mark: 'ASAP', markStyle: { fontWeight: '900', letterSpacing: 1 } },
  { name: 'Bizcar', url: 'https://www.bizcarrental.com/en/', bg: '#000000', fg: '#FFFFFF', mark: 'Bizcar', markStyle: { fontWeight: '800' } },
  { name: 'Chic Car Rent', url: 'https://www.chiccarrent.com', bg: '#FF69B4', fg: '#FFFFFF', mark: 'Chic', markStyle: { fontWeight: '900', fontStyle: 'italic' } },
];

export function rentalBrandFor(company?: string): RentalBrand | undefined {
  const c = String(company || '').trim().toLowerCase();
  if (!c) return undefined;
  return CAR_RENTAL_BRANDS.find(b => c === b.name.toLowerCase() || c.startsWith(`${b.name.toLowerCase()} `));
}

/** One brand wordmark tile; also used on the saved car rental overview card. */
export function CarRentalLogo({ brand, size = 'md' }: { brand: RentalBrand; size?: 'sm' | 'md' }) {
  const small = size === 'sm';
  return (
    <View style={[st.logo, small && st.logoSm, { backgroundColor: brand.bg }]}>
      <Text
        style={[st.mark, small && st.markSm, { color: brand.fg }, brand.markStyle, small && brand.markStyle?.fontSize ? { fontSize: 10 } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {brand.mark}
      </Text>
      {brand.accent ? <View style={[st.accent, small && st.accentSm, { backgroundColor: brand.accent }]} /> : null}
    </View>
  );
}

function openBrand(brand: RentalBrand) {
  haptics.light();
  Linking.openURL(brand.url).catch(() => {});
}

/** Car rental logos: scrollable card row; the saved company (if any) is outlined in gold. */
export default function CarRentalLogoRow({ company }: { company?: string }) {
  const copy = t();
  const selected = rentalBrandFor(company);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.row} keyboardShouldPersistTaps="handled">
      {CAR_RENTAL_BRANDS.map(brand => (
        <Pressable
          key={brand.name}
          onPress={() => openBrand(brand)}
          style={({ pressed }) => [st.card, selected?.name === brand.name && st.cardOn, pressed && { opacity: 0.85 }]}
          accessibilityRole="link"
          accessibilityLabel={`${brand.name}, ${copy.tripExtrasBookNow}`}
        >
          <CarRentalLogo brand={brand} />
          <Text style={st.name} numberOfLines={2}>{brand.name}</Text>
          <View style={st.book}>
            <Text style={st.bookTxt}>{copy.tripExtrasBookNow}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  row: { gap: 10, paddingBottom: 12 },
  card: {
    width: 112,
    backgroundColor: FIELD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    padding: 10,
    alignItems: 'center',
    gap: 8,
  },
  cardOn: { borderColor: GOLD, borderWidth: 2 },
  logo: { width: 92, height: 44, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, overflow: 'hidden' },
  logoSm: { width: 56, height: 28, borderRadius: 7, paddingHorizontal: 4 },
  mark: { fontSize: 16 },
  markSm: { fontSize: 12 },
  accent: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4 },
  accentSm: { height: 3 },
  name: { color: CREAM, fontSize: 12, fontWeight: '700', textAlign: 'center', minHeight: 32, lineHeight: 16 },
  book: { alignSelf: 'stretch', backgroundColor: GOLD, borderRadius: 10, paddingVertical: 7, alignItems: 'center' },
  bookTxt: { color: NAVY, fontSize: 12, fontWeight: '800' },
});

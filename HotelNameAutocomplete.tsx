/**
 * Hotel autocomplete — hotel name field in the trip-extras sheet with Google Places suggestions while typing.
 * Picking a suggestion fills the hotel name and its full address (lib/hotelPlaces.ts → proxy).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MapPin } from 'phosphor-react-native';
import { haptics } from './lib/haptics';
import {
  HOTEL_AUTOCOMPLETE_MIN_CHARS,
  hotelDetails,
  newPlacesSession,
  suggestHotels,
  type HotelSuggestion,
} from './lib/hotelPlaces';
import { useMode } from './lib/modeContext';
import { tripExtrasPalette, type TripExtrasPalette } from './lib/tripExtrasPalette';

/** Follows the active theme like the hotel & transfer sheet it sits in (lib/tripExtrasPalette.ts). */
function useThemedStyles() {
  const { C } = useMode();
  return useMemo(() => {
    const p = tripExtrasPalette(C);
    return { p, st: makeStyles(p) };
  }, [C]);
}
const DEBOUNCE_MS = 300;

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Called with the Places name + formatted address after a suggestion is picked. */
  onPick: (place: { name: string; address: string }) => void;
  /** Destination airport IATA, used to bias suggestions toward the arrival city. */
  iata?: string;
};

export default function HotelNameAutocomplete({ label, value, onChange, onPick, iata }: Props) {
  const { st, p } = useThemedStyles();
  const [focused, setFocused] = useState(false);
  const [hits, setHits] = useState<HotelSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const session = useRef(newPlacesSession());
  /** The text a pick wrote into the field — no new lookup for it. */
  const pickedText = useRef<string | null>(null);

  useEffect(() => {
    const q = value.trim();
    if (!focused || q.length < HOTEL_AUTOCOMPLETE_MIN_CHARS || pickedText.current === value) {
      setHits([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      suggestHotels(q, { iata, session: session.current, signal: ctrl.signal })
        .then(list => { if (!ctrl.signal.aborted) setHits(list); })
        .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [value, focused, iata]);

  const pick = async (hit: HotelSuggestion) => {
    haptics.light();
    setHits([]);
    pickedText.current = hit.name;
    onChange(hit.name);
    const place = await hotelDetails(hit.placeId, session.current);
    // A new typing session starts after every pick (Google session pricing).
    session.current = newPlacesSession();
    const name = place?.name || hit.name;
    pickedText.current = name;
    onPick({ name, address: place?.address || hit.secondary });
    haptics.success();
  };

  const showList = focused && hits.length > 0;

  return (
    <View style={st.field}>
      <Text style={st.label}>{label}</Text>
      <View>
        <TextInput
          value={value}
          onChangeText={v => { pickedText.current = null; onChange(v); }}
          onFocus={() => setFocused(true)}
          // Delay so a tap on a suggestion lands before the list closes.
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          placeholderTextColor={p.muted}
          style={st.input}
          autoCorrect={false}
          accessibilityLabel={label}
        />
        {loading ? <ActivityIndicator size="small" color={p.accent} style={st.spinner} /> : null}
      </View>
      {showList ? (
        <View style={st.list} accessibilityRole="list">
          {hits.map((hit, i) => (
            <Pressable
              key={hit.placeId}
              onPress={() => { void pick(hit); }}
              style={({ pressed }) => [st.row, i > 0 && st.rowBorder, pressed && st.rowPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${hit.name}, ${hit.secondary}`}
            >
              <MapPin size={16} color={p.accent} weight="fill" />
              <View style={{ flex: 1 }}>
                <Text style={st.name} numberOfLines={1}>{hit.name}</Text>
                {hit.secondary ? <Text style={st.secondary} numberOfLines={1}>{hit.secondary}</Text> : null}
              </View>
            </Pressable>
          ))}
          {/* Google Places policy: predictions shown without a Google map need the attribution. */}
          <Text style={st.attribution}>powered by Google</Text>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(p: TripExtrasPalette) {
  return StyleSheet.create({
    field: { marginBottom: 10 },
    label: { color: p.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
    input: {
      backgroundColor: p.field,
      borderWidth: 1,
      borderColor: p.line,
      borderRadius: 12,
      color: p.text,
      fontSize: 15,
      fontWeight: '600',
      paddingHorizontal: 12,
      paddingRight: 36,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    },
    spinner: { position: 'absolute', right: 12, top: 0, bottom: 0 },
    list: {
      marginTop: 6,
      backgroundColor: p.field,
      borderWidth: 1,
      borderColor: p.line,
      borderRadius: 12,
      overflow: 'hidden',
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(136,150,176,0.35)' },
    rowPressed: { backgroundColor: p.tint },
    name: { color: p.text, fontSize: 14, fontWeight: '700' },
    secondary: { color: p.muted, fontSize: 12, marginTop: 2 },
    attribution: { color: p.muted, fontSize: 10, textAlign: 'right', paddingHorizontal: 12, paddingBottom: 6, paddingTop: 2 },
  });
}

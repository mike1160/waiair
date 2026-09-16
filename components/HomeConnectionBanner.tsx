import { StyleSheet, Text, View } from 'react-native';
import { useColorScheme } from 'react-native';
import { bannerCopy, type ConnectionCheck } from '../lib/connectionCheck';
import { PALETTE_TOKENS } from '../lib/themeTokens';

export default function HomeConnectionBanner({
  connection,
}: {
  connection: ConnectionCheck | null;
}) {
  const scheme = useColorScheme();
  if (!connection) return null;
  const pal = scheme === 'light' ? PALETTE_TOKENS.light : PALETTE_TOKENS.dark;
  const { tone, text } = bannerCopy(connection);
  const bg = tone === 'green' ? pal.statusGreen : tone === 'orange' ? pal.statusAmber : pal.statusRed;
  return (
    <View style={[styles.wrap, { backgroundColor: bg }]} accessibilityRole="text" accessibilityLabel={text}>
      <Text style={styles.txt}>{text}</Text>
    </View>
  );
}

export function HomeConnectionBanners({
  connections,
}: {
  connections: ConnectionCheck[];
}) {
  if (!connections.length) return null;
  return (
    <View style={styles.stack}>
      {connections.map(c => (
        <HomeConnectionBanner
          key={`${c.incoming.number}>${c.outgoing.number}`}
          connection={c}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8, marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
  wrap: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  txt: { color: '#fff', fontWeight: '800', fontSize: 13, textAlign: 'center' },
});

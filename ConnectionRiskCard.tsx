import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Theme } from './constants/theme';
import {
  filterAtRiskConnections,
  inboundDelayMin,
  layoverRemainMin,
  outgoingDepartureClock,
  type TightConnectionLike,
} from './lib/connectionRisk';
import { airlineClaimLink } from './lib/eu261';
import { t } from './lib/i18n';
import { getPrefs } from './lib/prefs';
import { runWhileAppActive } from './lib/appActivity';

function flightSlug(number: string): string {
  return String(number || '').replace(/\s+/g, '').toUpperCase();
}

function openRebooking(airlineCode?: string) {
  const link = airlineClaimLink(airlineCode);
  if (!link?.url) return;
  void Linking.openURL(link.url);
}

export default function ConnectionRiskCard({
  connections,
}: {
  connections: TightConnectionLike[];
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!connections.length) return;
    return runWhileAppActive(() => {
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    });
  }, [connections.length]);

  const atRisk = useMemo(
    () => filterAtRiskConnections(connections, now),
    [connections, now],
  );

  if (!atRisk.length) return null;

  const copy = t();
  const hour12 = getPrefs().timeFormat === '12h';

  return (
    <View style={styles.stack}>
      {atRisk.map(c => {
        const delay = inboundDelayMin(c);
        const remain = Math.round(layoverRemainMin(c));
        const depTime = outgoingDepartureClock(c, hour12);
        const gate = String(c.outgoing.gate || '').trim();
        const airlineCode = c.outgoing.airlineCode || c.incoming.airlineCode;
        const canRebook = !!airlineClaimLink(airlineCode)?.url;

        return (
          <View key={c.key} style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.headerAccent} />
              <Text style={styles.header}>{copy.connectionAtRiskTitle}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>{copy.connectionInboundLabel}</Text>
              <View style={styles.row}>
                <Text style={styles.flightNum}>{flightSlug(c.incoming.number)}</Text>
                <Text style={[styles.delay, delay > 0 && styles.delayBad]}>
                  {delay > 0 ? copy.connectionInboundDelay(delay) : copy.onTime}
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>{copy.connectionLayoverLabel}</Text>
              <Text style={styles.layover}>{copy.connectionLayoverRemaining(remain)}</Text>
              <Text style={styles.hub}>{copy.connectionAtHub(c.hub)}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>{copy.connectionOutboundLabel}</Text>
              <Text style={styles.flightNum}>{flightSlug(c.outgoing.number)}</Text>
              <Text style={styles.meta}>
                {copy.connectionDeparts(depTime)}
                {gate ? ` · ${copy.gate(gate)}` : ''}
              </Text>
            </View>

            <Pressable
              style={[styles.rebookBtn, !canRebook && styles.rebookBtnDisabled]}
              onPress={() => openRebooking(airlineCode)}
              disabled={!canRebook}
              accessibilityRole="button"
              accessibilityLabel={copy.rebookingOptions}
            >
              <Text style={styles.rebookTxt}>{copy.rebookingOptions}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 10 },
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: Theme.cardPadding,
    backgroundColor: Theme.card,
    borderRadius: Theme.cardRadius,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    gap: 12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: Theme.statusRed,
  },
  header: { color: Theme.statusRed, fontSize: 15, fontWeight: '800' },
  section: { gap: 2 },
  label: { color: Theme.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  flightNum: { color: Theme.text, fontSize: 17, fontWeight: '800' },
  delay: { color: Theme.textMuted, fontSize: 13, fontWeight: '600' },
  delayBad: { color: Theme.statusRed },
  layover: { color: Theme.statusAmber, fontSize: 16, fontWeight: '700' },
  hub: { color: Theme.textMuted, fontSize: 12, fontWeight: '500' },
  meta: { color: Theme.text, fontSize: 13, fontWeight: '600', marginTop: 2 },
  rebookBtn: {
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    alignItems: 'center',
  },
  rebookBtnDisabled: { opacity: 0.45 },
  rebookTxt: { color: Theme.statusRed, fontSize: 14, fontWeight: '800' },
});

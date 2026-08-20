import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { runWhileAppActive } from '../lib/appActivity';
import { compactTerminal } from '../GateBadge';
import type { GateRacePair } from '../lib/gateRace';
import {
  connectionGapMin,
  connectionMarginMin,
  connectionRemainMin,
  isIncomingLanded,
  shouldNotifyGateRaceMissed,
} from '../lib/gateRace';
import { resolveArrivalIso, resolveDepartureIso } from '../lib/flightTimes';
import {
  raceBand,
  RACE_COLOR,
  walkLabel,
} from '../lib/gateWalk';
import { getTerminalWalkTime, hasTerminalChange } from '../lib/terminalWalkTimes';
import { t } from '../lib/i18n';

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
  card: string;
  list: string;
};

function termDisplay(raw?: string): string {
  const c = compactTerminal(raw);
  return c || (raw?.trim() ? raw.trim() : '—');
}

export default function GateRaceConnectionCard({
  pair,
  formatTime,
  theme,
  onOpenGateRace,
}: {
  pair: GateRacePair;
  formatTime: (iso: string, iata?: string) => string;
  theme: ThemeBits;
  onOpenGateRace?: () => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    return runWhileAppActive(() => {
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    });
  }, []);

  const landed = isIncomingLanded(pair, now);
  const gapMin = connectionGapMin(pair);
  const remainMin = landed ? connectionRemainMin(pair, now) : gapMin;
  const band = raceBand(remainMin);
  const color = RACE_COLOR[band];
  const missed = shouldNotifyGateRaceMissed(pair, now);
  const margin = connectionMarginMin(pair, now);

  const arrDisplay = formatTime(resolveArrivalIso(pair.incoming), pair.hub);
  const depDisplay = formatTime(resolveDepartureIso(pair.outgoing), pair.hub);

  const terminalWalk = hasTerminalChange(pair.fromTerminal, pair.toTerminal)
    ? getTerminalWalkTime(pair.hub, pair.fromTerminal, pair.toTerminal)
    : null;
  const terminalChangeLine = terminalWalk && terminalWalk.minutes > 0
    ? t().terminalChangeAllow(
      termDisplay(pair.fromTerminal),
      termDisplay(pair.toTerminal),
      terminalWalk.minutes,
    )
    : null;

  const statusLine = missed
    ? t().gateRaceConnectionMissedTitle
    : band === 'orange'
      ? t().gateRaceOnlyMinClose(Math.round(remainMin))
      : band === 'green'
        ? `🟢 ${t().gateRaceGotTime}`
        : `🔴 ${t().gateRaceRunNotify}`;

  const body = (
    <View style={[st.card, { backgroundColor: theme.list, borderColor: color }]}>
      <Text style={[st.section, { color: theme.muted }]}>{t().connection}</Text>
      <Text style={[st.title, { color: theme.text }]}>⚡ {t().gateRace}</Text>
      <View style={st.divider} />
      <Text style={[st.line, { color: theme.text }]}>
        {t().gateRaceLandsAt(
          pair.incoming.number,
          pair.fromGate,
          termDisplay(pair.fromTerminal),
          arrDisplay,
        )}
      </Text>
      <Text style={[st.line, { color: theme.text }]}>
        {t().gateRaceWalkTo(pair.toGate, termDisplay(pair.toTerminal), walkLabel(pair.walk))}
      </Text>
      {terminalChangeLine ? (
        <Text style={[st.terminalChange, { color: theme.secondary }]}>
          {terminalChangeLine}
          {terminalWalk?.notes ? ` · ${terminalWalk.notes}` : ''}
        </Text>
      ) : null}
      <Text style={[st.line, { color: theme.text }]}>
        {t().gateRaceBoardsAt(pair.outgoing.number, depDisplay)}
      </Text>
      <View style={st.divider} />
      <Text style={[st.status, { color: missed ? RACE_COLOR.red : color }]}>
        {missed ? t().gateRaceConnectionMissedBody : statusLine}
      </Text>
      {landed && margin >= 10 ? (
        <Text style={[st.live, { color: theme.secondary }]}>
          {t().gateRaceLiveRemain(Math.round(remainMin))}
        </Text>
      ) : null}
    </View>
  );

  if (!onOpenGateRace) return body;

  return (
    <TouchableOpacity
      onPress={onOpenGateRace}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t().openGateRace}
    >
      {body}
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    marginTop: 12,
    marginBottom: 4,
  },
  section: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148,163,184,0.35)',
    marginVertical: 10,
  },
  line: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 20,
    marginBottom: 4,
  },
  terminalChange: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 6,
  },
  status: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  live: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
});

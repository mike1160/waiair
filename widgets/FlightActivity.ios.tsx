import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  background,
  font,
  foregroundStyle,
  monospacedDigit,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export type FlightActivityProps = {
  flightNumber: string;
  origin: string;
  destination: string;
  status: string;
  statusLabel: string;
  phase: string; // upcoming | boarding | departed | landed | cancelled | other
  boardEpochMs: number;
  gate?: string;
  minutesUntil?: number;
};

const BG = '#0f1117';
const WHITE = '#FFFFFF';
const MUTED = '#94A3B8';
const BOARDING = '#22c55e';
const DELAYED = '#f59e0b';
const CANCELLED = '#ef4444';
const ON_TIME = '#3b82f6';

function statusColor(phase: string, status: string, statusLabel: string): string {
  const blob = `${phase} ${status} ${statusLabel}`.toLowerCase();
  if (phase === 'cancelled' || blob.includes('cancel')) return CANCELLED;
  if (phase === 'boarding' || blob.includes('board')) return BOARDING;
  if (blob.includes('delay')) return DELAYED;
  return ON_TIME;
}

function gateCode(gate?: string): string {
  const raw = String(gate || '').trim();
  if (!raw || /^(—|-|–|n\/?a|tba|tbd|null|undefined|\.+)$/i.test(raw)) return '';
  const code = raw.replace(/^gates?\s*:?\s*/i, '').trim();
  return code && !/^(—|-|–)$/.test(code) ? code : '';
}

function minutesLabel(props: FlightActivityProps, nowMs: number): string {
  if (props.minutesUntil != null && Number.isFinite(props.minutesUntil)) {
    const m = Math.max(0, Math.round(props.minutesUntil));
    return `${m}m`;
  }
  const target = Number(props.boardEpochMs) || 0;
  if (target > nowMs) {
    return `${Math.max(0, Math.round((target - nowMs) / 60000))}m`;
  }
  return '';
}

const FlightActivityLayout = (props: FlightActivityProps, _env: LiveActivityEnvironment) => {
  'widget';
  const accent = statusColor(props.phase, props.status, props.statusLabel);
  const gate = gateCode(props.gate);
  const nowMs = Date.now();
  const targetMs = Number(props.boardEpochMs) || 0;
  const hasTimer = targetMs > nowMs;
  const now = new Date(nowMs);
  const boardDate = new Date(targetMs);
  const mins = minutesLabel(props, nowMs);
  const statusTxt = String(props.status || props.statusLabel || '').trim();
  const flight = String(props.flightNumber || '').trim();
  const origin = String(props.origin || '').trim();
  const dest = String(props.destination || '').trim();
  const route = origin && dest ? `${origin} → ${dest}` : origin || dest;
  const countdownTxt = hasTimer ? mins : (props.statusLabel || statusTxt || mins);

  const Countdown = ({ size }: { size: number }) => {
    if (hasTimer) {
      return (
        <Text
          timerInterval={{ lower: now, upper: boardDate }}
          countsDown
          modifiers={[
            font({ weight: 'semibold', size }),
            foregroundStyle(accent),
            monospacedDigit(),
          ]}
        >
          {mins}
        </Text>
      );
    }
    if (!countdownTxt) return null;
    return (
      <Text modifiers={[font({ weight: 'semibold', size }), foregroundStyle(accent), monospacedDigit()]}>
        {countdownTxt}
      </Text>
    );
  };

  const Dot = () => (
    <Image systemName="circle.fill" color={accent} />
  );

  return {
    banner: (
      <HStack
        modifiers={[
          background(BG),
          padding({ leading: 10, trailing: 10, top: 6, bottom: 6 }),
        ]}
      >
        {flight ? (
          <Text modifiers={[font({ weight: 'bold', size: 14 }), foregroundStyle(WHITE)]}>
            {flight}
          </Text>
        ) : null}
        {statusTxt ? (
          <Text modifiers={[font({ weight: 'semibold', size: 12 }), foregroundStyle(accent)]}>
            {statusTxt}
          </Text>
        ) : null}
        {gate ? (
          <Text modifiers={[font({ weight: 'semibold', size: 12 }), foregroundStyle(WHITE)]}>
            {gate}
          </Text>
        ) : null}
        <Spacer />
        <Countdown size={13} />
      </HStack>
    ),
    bannerSmall: (
      <HStack modifiers={[background(BG), padding({ horizontal: 8, vertical: 4 })]}>
        {flight ? (
          <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle(WHITE)]}>
            {flight}
          </Text>
        ) : null}
        <Spacer />
        <Countdown size={12} />
      </HStack>
    ),
    compactLeading: (
      <HStack>
        {flight ? (
          <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle(WHITE)]}>
            {flight}
          </Text>
        ) : null}
      </HStack>
    ),
    compactTrailing: <Countdown size={12} />,
    minimal: <Dot />,
    expandedLeading: (
      <VStack modifiers={[padding({ leading: 6, trailing: 4, top: 2, bottom: 2 })]}>
        {flight ? (
          <Text modifiers={[font({ weight: 'bold', size: 13 }), foregroundStyle(WHITE)]}>
            {flight}
          </Text>
        ) : null}
        <Dot />
      </VStack>
    ),
    expandedCenter: route ? (
      <Text modifiers={[font({ weight: 'medium', size: 12 }), foregroundStyle(MUTED)]}>
        {route}
      </Text>
    ) : (
      <Dot />
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ leading: 4, trailing: 6, top: 2, bottom: 2 })]}>
        <Countdown size={14} />
      </VStack>
    ),
    expandedBottom: (
      <HStack modifiers={[padding({ leading: 8, trailing: 8, top: 2, bottom: 4 })]}>
        {statusTxt ? (
          <Text modifiers={[font({ weight: 'semibold', size: 11 }), foregroundStyle(accent)]}>
            {statusTxt}
          </Text>
        ) : null}
        {gate ? (
          <Text modifiers={[font({ weight: 'semibold', size: 11 }), foregroundStyle(WHITE)]}>
            {gate}
          </Text>
        ) : null}
        <Spacer />
        <Countdown size={11} />
      </HStack>
    ),
  };
};

export default createLiveActivity<FlightActivityProps>('FlightActivity', FlightActivityLayout);

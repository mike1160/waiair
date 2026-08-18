import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type FlightHomeWidgetProps = {
  hasFlight: boolean;
  flightNumber: string;
  airline: string;
  origin: string;
  destination: string;
  statusBadge: string;
  timeLabel: string;
  countdown: string;
  gate: string;
  terminal: string;
  delayMinutes: number;
  showDelayBanner: boolean;
  emptyMessage: string;
  hasFlight2: boolean;
  flightNumber2: string;
  airline2: string;
  origin2: string;
  destination2: string;
  statusBadge2: string;
  timeLabel2: string;
  gate2: string;
  terminal2: string;
};

const NAVY = '#0B1F3A';
const GOLD = '#C9A84C';
const MUTED = '#94a3b8';
const WHITE = '#ffffff';
const DELAY_BG = '#f59e0b';
const GREEN = '#22c55e';

function statusColor(badge: string): string {
  const b = badge.toLowerCase();
  if (b.includes('last call')) return '#FF3B30';
  if (b.includes('gate closing')) return '#FF9500';
  if (b.includes('board')) return GREEN;
  if (b.includes('delay')) return DELAY_BG;
  if (b.includes('cancel')) return '#ef4444';
  if (b.includes('land')) return '#a78bfa';
  return GOLD;
}

function gateLine(gate: string, terminal: string): string {
  const g = gate ? `Gate ${gate}` : '';
  const t = terminal ? (terminal.startsWith('T') ? terminal : `T${terminal}`) : '';
  return [g, t].filter(Boolean).join(' · ');
}

const FlightHomeWidgetLayout = (
  props: FlightHomeWidgetProps,
  environment: WidgetEnvironment,
) => {
  'widget';
  const isDark = environment.colorScheme === 'dark';
  const bg = isDark ? '#0A0F1E' : NAVY;
  const isMedium = environment.widgetFamily === 'systemMedium';
  const badgeColor = statusColor(props.statusBadge);

  if (!props.hasFlight) {
    return (
      <VStack
        alignment="leading"
        spacing={6}
        modifiers={[
          containerBackground(bg, 'widget'),
          padding({ all: isMedium ? 16 : 14 }),
        ]}
      >
        <Text modifiers={[font({ weight: 'bold', size: 13 }), foregroundStyle(GOLD)]}>
          ✈️ WaiAir
        </Text>
        <Text modifiers={[font({ weight: 'semibold', size: 14 }), foregroundStyle(WHITE)]}>
          {props.emptyMessage || 'No tracked flights'}
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(MUTED)]}>
          Track a flight in the app
        </Text>
      </VStack>
    );
  }

  if (!isMedium) {
    return (
      <VStack
        alignment="leading"
        spacing={4}
        modifiers={[
          containerBackground(bg, 'widget'),
          padding({ all: 14 }),
        ]}
      >
        <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle(GOLD)]}>
          ✈️ WaiAir
        </Text>
        <HStack>
          <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(WHITE)]}>
            {props.flightNumber}
          </Text>
          <Spacer />
          <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(GOLD)]}>
            {props.timeLabel}
          </Text>
        </HStack>
        {props.airline ? (
          <Text modifiers={[font({ size: 11 }), foregroundStyle(MUTED)]}>
            {props.airline}
          </Text>
        ) : null}
        <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle(badgeColor)]}>
          {props.statusBadge}
        </Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(MUTED)]}>
          {gateLine(props.gate, props.terminal) || `${props.origin} → ${props.destination}`}
        </Text>
        {props.countdown ? (
          <Text modifiers={[font({ weight: 'semibold', size: 12 }), foregroundStyle(WHITE)]}>
            {props.countdown}
          </Text>
        ) : null}
      </VStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={8}
      modifiers={[
        containerBackground(bg, 'widget'),
        padding({ all: 16 }),
      ]}
    >
      <HStack>
        <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(WHITE)]}>
          {props.flightNumber}{props.airline ? ` · ${props.airline}` : ''} {props.origin}→{props.destination}
        </Text>
        <Spacer />
        <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(GOLD)]}>
          {props.timeLabel}
        </Text>
      </HStack>
      <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle(badgeColor)]}>
        {props.statusBadge}{gateLine(props.gate, props.terminal) ? ` · ${gateLine(props.gate, props.terminal)}` : ''}
      </Text>
      {props.hasFlight2 ? (
        <>
          <HStack>
            <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(WHITE)]}>
              {props.flightNumber2}{props.airline2 ? ` · ${props.airline2}` : ''} {props.origin2}→{props.destination2}
            </Text>
            <Spacer />
            <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(GOLD)]}>
              {props.timeLabel2}
            </Text>
          </HStack>
          <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle(statusColor(props.statusBadge2))]}>
            {props.statusBadge2}{gateLine(props.gate2, props.terminal2) ? ` · ${gateLine(props.gate2, props.terminal2)}` : ''}
          </Text>
        </>
      ) : (
        <Text modifiers={[font({ size: 12 }), foregroundStyle(MUTED)]}>
          {props.countdown}
        </Text>
      )}
    </VStack>
  );
};

export default createWidget<FlightHomeWidgetProps>('FlightHomeWidget', FlightHomeWidgetLayout);

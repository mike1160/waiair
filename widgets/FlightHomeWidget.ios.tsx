import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
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
const GOLD = '#E8C872';
const MUTED = '#B8C5D6';
const WHITE = '#ffffff';
const DELAY_BG = '#FFB020';
const GREEN = '#34D399';

function statusColor(badge: string): string {
  const b = badge.toLowerCase();
  if (b.includes('last call')) return '#FF453A';
  if (b.includes('gate closing')) return '#FF9F0A';
  if (b.includes('board')) return GREEN;
  if (b.includes('delay')) return DELAY_BG;
  if (b.includes('cancel')) return '#FF6961';
  if (b.includes('land')) return '#C4B5FD';
  return GOLD;
}

function gateLine(gate: string, terminal: string): string {
  const g = gate ? `Gate ${gate}` : '';
  const t = terminal ? (terminal.startsWith('T') ? terminal : `T${terminal}`) : '';
  return [g, t].filter(Boolean).join(' · ');
}

type WidgetSize = 'small' | 'medium' | 'large';

function widgetSize(environment: WidgetEnvironment): WidgetSize {
  if (environment.widgetFamily === 'systemLarge') return 'large';
  if (environment.widgetFamily === 'systemMedium') return 'medium';
  return 'small';
}

function padForSize(size: WidgetSize): number {
  if (size === 'large') return 18;
  if (size === 'medium') return 16;
  return 12;
}

const brandFont = [font({ textStyle: 'caption', weight: 'bold' }), foregroundStyle(GOLD)];
const flightFont = [
  font({ textStyle: 'headline', weight: 'bold' }),
  foregroundStyle(WHITE),
  monospacedDigit(),
  lineLimit(1),
  minimumScaleFactor(0.75),
];
const timeFont = [
  font({ textStyle: 'headline', weight: 'bold' }),
  foregroundStyle(GOLD),
  monospacedDigit(),
  lineLimit(1),
  minimumScaleFactor(0.75),
];
const gateFont = [
  font({ textStyle: 'subheadline', weight: 'semibold' }),
  foregroundStyle(WHITE),
  lineLimit(1),
  minimumScaleFactor(0.8),
];
const statusFont = (color: string) => [
  font({ textStyle: 'subheadline', weight: 'semibold' }),
  foregroundStyle(color),
  minimumScaleFactor(0.7),
];
const secondaryFont = [
  font({ textStyle: 'footnote' }),
  foregroundStyle(MUTED),
  lineLimit(1),
  minimumScaleFactor(0.8),
];
const countdownFont = [
  font({ textStyle: 'callout', weight: 'semibold' }),
  foregroundStyle(WHITE),
  lineLimit(2),
  minimumScaleFactor(0.8),
];
const emptyTitleFont = [
  font({ textStyle: 'headline', weight: 'semibold' }),
  foregroundStyle(WHITE),
  lineLimit(2),
];
const routeFont = [
  font({ textStyle: 'body', weight: 'medium' }),
  foregroundStyle(WHITE),
  lineLimit(1),
  minimumScaleFactor(0.8),
];

function EmptyState({ bg, size, message }: { bg: string; size: WidgetSize; message: string }) {
  return (
    <VStack
      alignment="leading"
      spacing={size === 'small' ? 4 : 6}
      modifiers={[containerBackground(bg, 'widget'), padding({ all: padForSize(size) })]}
    >
      <Text modifiers={brandFont}>✈️ WaiAir</Text>
      <Text modifiers={emptyTitleFont}>{message || 'No tracked flights'}</Text>
      <Text modifiers={secondaryFont}>Track a flight in the app</Text>
    </VStack>
  );
}

function PrimaryFlightBlock({ flight, compact }: { flight: FlightHomeWidgetProps; compact: boolean }) {
  const badgeColor = statusColor(flight.statusBadge);
  const gate = gateLine(flight.gate, flight.terminal);
  return (
    <VStack alignment="leading" spacing={compact ? 3 : 6}>
      <HStack>
        <Text modifiers={flightFont}>{flight.flightNumber}</Text>
        <Spacer />
        <Text modifiers={timeFont}>{flight.timeLabel}</Text>
      </HStack>
      {gate ? (
        <Text modifiers={gateFont}>{gate}</Text>
      ) : (
        <Text modifiers={routeFont}>{flight.origin} → {flight.destination}</Text>
      )}
      <Text modifiers={statusFont(badgeColor)}>{flight.statusBadge}</Text>
      {!compact && flight.airline ? (
        <Text modifiers={secondaryFont}>{flight.airline}</Text>
      ) : null}
      {flight.countdown ? (
        <Text modifiers={countdownFont}>{flight.countdown}</Text>
      ) : null}
    </VStack>
  );
}

function SecondaryFlightBlock({ flight }: { flight: FlightHomeWidgetProps }) {
  const badgeColor = statusColor(flight.statusBadge2);
  const gate = gateLine(flight.gate2, flight.terminal2);
  return (
    <VStack alignment="leading" spacing={4}>
      <HStack>
        <Text modifiers={flightFont}>{flight.flightNumber2}</Text>
        <Spacer />
        <Text modifiers={timeFont}>{flight.timeLabel2}</Text>
      </HStack>
      {gate ? (
        <Text modifiers={gateFont}>{gate}</Text>
      ) : (
        <Text modifiers={routeFont}>{flight.origin2} → {flight.destination2}</Text>
      )}
      <Text modifiers={statusFont(badgeColor)}>{flight.statusBadge2}</Text>
    </VStack>
  );
}

const FlightHomeWidgetLayout = (
  props: FlightHomeWidgetProps,
  environment: WidgetEnvironment,
) => {
  'widget';
  console.warn('[Widget] render props', JSON.stringify(props));
  const isDark = environment.colorScheme === 'dark';
  const bg = isDark ? '#0A0F1E' : NAVY;
  const size = widgetSize(environment);

  if (!props.hasFlight) {
    return <EmptyState bg={bg} size={size} message={props.emptyMessage} />;
  }

  if (size === 'small') {
    return (
      <VStack
        alignment="leading"
        spacing={4}
        modifiers={[containerBackground(bg, 'widget'), padding({ all: padForSize(size) })]}
      >
        <Text modifiers={brandFont}>✈️ WaiAir</Text>
        <PrimaryFlightBlock flight={props} compact />
      </VStack>
    );
  }

  if (size === 'medium') {
    return (
      <VStack
        alignment="leading"
        spacing={6}
        modifiers={[containerBackground(bg, 'widget'), padding({ all: padForSize(size) })]}
      >
        <PrimaryFlightBlock flight={props} compact={false} />
        {props.hasFlight2 ? <SecondaryFlightBlock flight={props} /> : null}
      </VStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={10}
      modifiers={[containerBackground(bg, 'widget'), padding({ all: padForSize(size) })]}
    >
      <Text modifiers={brandFont}>✈️ WaiAir</Text>
      <PrimaryFlightBlock flight={props} compact={false} />
      {props.hasFlight2 ? (
        <>
          <Text modifiers={secondaryFont}>Next flight</Text>
          <SecondaryFlightBlock flight={props} />
        </>
      ) : props.airline ? (
        <Text modifiers={secondaryFont}>{props.airline} · {props.origin} → {props.destination}</Text>
      ) : null}
    </VStack>
  );
};

export default createWidget<FlightHomeWidgetProps>('FlightHomeWidget', FlightHomeWidgetLayout);

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
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  gate: string;
  status: string;
  statusLabel: string;
  seat: string;
  baggageBelt: string;
  countdown: string;
  weatherLine: string;
  emptyTitle: string;
  emptySubtitle: string;
  hasFlight2: boolean;
  flightNumber2: string;
  origin2: string;
  destination2: string;
  departureTime2: string;
  arrivalTime2: string;
  gate2: string;
  status2: string;
  statusLabel2: string;
  seat2: string;
  countdown2: string;
};

const BG = '#0F1117';
const YELLOW = '#F5C518';
const MUTED = '#888888';
const WHITE = '#FFFFFF';
const GREEN = '#00C853';
const AMBER = '#FF9800';
const RED = '#F44336';

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

function statusDotColor(status: string, label: string): string {
  const blob = `${status} ${label}`.toLowerCase();
  if (blob.includes('cancel')) return RED;
  if (blob.includes('delay')) return AMBER;
  if (blob.includes('board') || blob.includes('on time') || blob.includes('scheduled')) return GREEN;
  if (blob.includes('land')) return GREEN;
  return YELLOW;
}

function gateLabel(gate: string): string {
  const raw = String(gate || '').trim();
  if (!raw || /^(—|-|–|n\/?a|tba|tbd)$/i.test(raw)) return '';
  const code = raw.replace(/^gates?\s*:?\s*/i, '').trim();
  return code ? `Gate ${code}` : '';
}

const brandFont = [font({ textStyle: 'caption', weight: 'bold' }), foregroundStyle(YELLOW)];
const flightFont = [
  font({ textStyle: 'headline', weight: 'bold' }),
  foregroundStyle(WHITE),
  monospacedDigit(),
  lineLimit(1),
  minimumScaleFactor(0.75),
];
const routeFont = [
  font({ textStyle: 'body', weight: 'semibold' }),
  foregroundStyle(WHITE),
  lineLimit(1),
  minimumScaleFactor(0.8),
];
const timeHeroFont = [
  font({ textStyle: 'title2', weight: 'bold' }),
  foregroundStyle(WHITE),
  monospacedDigit(),
  lineLimit(1),
];
const metaFont = [
  font({ textStyle: 'footnote', weight: 'medium' }),
  foregroundStyle(MUTED),
  lineLimit(2),
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
const sectionLabelFont = [
  font({ textStyle: 'caption', weight: 'bold' }),
  foregroundStyle(YELLOW),
  lineLimit(1),
];
const dotFont = (color: string) => [
  font({ textStyle: 'body', weight: 'bold' }),
  foregroundStyle(color),
];

function EmptyState({ size, title, subtitle }: { size: WidgetSize; title: string; subtitle: string }) {
  return (
    <VStack
      alignment="leading"
      spacing={size === 'small' ? 6 : 8}
      modifiers={[containerBackground(BG, 'widget'), padding({ all: padForSize(size) })]}
    >
      <Text modifiers={brandFont}>✈ WaiAir</Text>
      <Text modifiers={emptyTitleFont}>{title}</Text>
      {subtitle ? <Text modifiers={metaFont}>{subtitle}</Text> : null}
    </VStack>
  );
}

function SmallFlightView(props: FlightHomeWidgetProps) {
  const dot = statusDotColor(props.status, props.statusLabel);
  const gate = gateLabel(props.gate);
  return (
    <VStack alignment="leading" spacing={4}>
      <Text modifiers={flightFont}>✈ {props.flightNumber}</Text>
      <Text modifiers={routeFont}>{props.origin} → {props.destination}</Text>
      <Text modifiers={timeHeroFont}>{props.departureTime || props.arrivalTime}</Text>
      <HStack>
        {gate ? <Text modifiers={routeFont}>{gate}</Text> : <Spacer />}
        <Spacer />
        <Text modifiers={dotFont(dot)}> ●</Text>
      </HStack>
    </VStack>
  );
}

function MediumFlightView(props: FlightHomeWidgetProps) {
  const routeTimes = `${props.origin}→${props.destination}  ${props.departureTime}→${props.arrivalTime}`;
  const metaParts = [
    gateLabel(props.gate),
    props.statusLabel,
    props.seat ? `Seat ${props.seat}` : '',
  ].filter(Boolean);
  return (
    <VStack alignment="leading" spacing={6}>
      <Text modifiers={flightFont}>✈ {props.flightNumber}  {routeTimes}</Text>
      {metaParts.length ? <Text modifiers={metaFont}>{metaParts.join(' · ')}</Text> : null}
      {props.countdown ? <Text modifiers={countdownFont}>{props.countdown}</Text> : null}
    </VStack>
  );
}

function ArrivingBlock(props: FlightHomeWidgetProps) {
  const metaParts = [
    gateLabel(props.gate2),
    props.statusLabel2,
    props.seat2 ? `Seat ${props.seat2}` : '',
  ].filter(Boolean);
  return (
    <VStack alignment="leading" spacing={4}>
      <Text modifiers={sectionLabelFont}>ARRIVING</Text>
      <Text modifiers={flightFont}>
        ✈ {props.flightNumber2}  {props.origin2}→{props.destination2}  {props.arrivalTime2}
      </Text>
      {metaParts.length ? <Text modifiers={metaFont}>{metaParts.join(' · ')}</Text> : null}
      {props.countdown2 ? <Text modifiers={countdownFont}>{props.countdown2}</Text> : null}
    </VStack>
  );
}

const FlightHomeWidgetLayout = (
  props: FlightHomeWidgetProps,
  environment: WidgetEnvironment,
) => {
  'widget';
  const size = widgetSize(environment);

  if (!props.hasFlight) {
    const title = props.emptyTitle || (size === 'medium' ? 'Tap to add your flight' : 'Track a flight');
    const subtitle = props.emptySubtitle || '';
    return <EmptyState size={size} title={title} subtitle={subtitle} />;
  }

  if (size === 'small') {
    return (
      <VStack
        alignment="leading"
        spacing={4}
        modifiers={[containerBackground(BG, 'widget'), padding({ all: padForSize(size) })]}
      >
        <SmallFlightView {...props} />
      </VStack>
    );
  }

  if (size === 'medium') {
    return (
      <VStack
        alignment="leading"
        spacing={6}
        modifiers={[containerBackground(BG, 'widget'), padding({ all: padForSize(size) })]}
      >
        <MediumFlightView {...props} />
      </VStack>
    );
  }

  return (
    <VStack
      alignment="leading"
      spacing={10}
      modifiers={[containerBackground(BG, 'widget'), padding({ all: padForSize(size) })]}
    >
      <Text modifiers={brandFont}>✈ WaiAir</Text>
      <MediumFlightView {...props} />
      {props.weatherLine ? <Text modifiers={metaFont}>{props.weatherLine}</Text> : null}
      {props.baggageBelt ? (
        <Text modifiers={countdownFont}>Baggage belt {props.baggageBelt}</Text>
      ) : null}
      {props.hasFlight2 ? <ArrivingBlock {...props} /> : null}
    </VStack>
  );
};

export default createWidget<FlightHomeWidgetProps>('FlightHomeWidget', FlightHomeWidgetLayout);

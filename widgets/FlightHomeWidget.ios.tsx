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
  origin: string;
  destination: string;
  statusBadge: string;
  timeLabel: string;
  countdown: string;
  gate: string;
  delayMinutes: number;
  showDelayBanner: boolean;
  emptyMessage: string;
};

const NAVY = '#0B1F3A';
const GOLD = '#C9A84C';
const MUTED = '#94a3b8';
const WHITE = '#ffffff';
const DELAY_BG = '#f59e0b';

function statusColor(badge: string): string {
  const b = badge.toLowerCase();
  if (b.includes('board')) return '#22c55e';
  if (b.includes('delay')) return DELAY_BG;
  if (b.includes('cancel')) return '#ef4444';
  if (b.includes('land')) return '#a78bfa';
  return GOLD;
}

const FlightHomeWidgetLayout = (
  props: FlightHomeWidgetProps,
  environment: WidgetEnvironment,
) => {
  'widget';
  const isDark = environment.colorScheme === 'dark';
  const bg = isDark ? '#0A0F1E' : NAVY;
  const route = `${props.origin || '—'} → ${props.destination || '—'}`;
  const badgeColor = statusColor(props.statusBadge);
  const isMedium = environment.widgetFamily === 'systemMedium';

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
          WaiAir
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
    // systemSmall 2×2
    return (
      <VStack
        alignment="leading"
        spacing={4}
        modifiers={[
          containerBackground(bg, 'widget'),
          padding({ all: 14 }),
        ]}
      >
        <HStack>
          <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(WHITE)]}>
            {props.flightNumber}
          </Text>
          <Spacer />
          <Text modifiers={[font({ weight: 'bold', size: 10 }), foregroundStyle(badgeColor)]}>
            {props.statusBadge}
          </Text>
        </HStack>
        <Text modifiers={[font({ weight: 'semibold', size: 12 }), foregroundStyle(MUTED)]}>
          {route}
        </Text>
        <Spacer />
        <Text modifiers={[font({ weight: 'bold', size: 20 }), foregroundStyle(GOLD)]}>
          {props.timeLabel}
        </Text>
      </VStack>
    );
  }

  // systemMedium 4×2
  return (
    <VStack
      alignment="leading"
      spacing={6}
      modifiers={[
        containerBackground(bg, 'widget'),
        padding({ all: 16 }),
      ]}
    >
      <HStack>
        <Text modifiers={[font({ weight: 'bold', size: 18 }), foregroundStyle(WHITE)]}>
          {props.flightNumber}
        </Text>
        <Spacer />
        <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle(badgeColor)]}>
          {props.statusBadge}
        </Text>
      </HStack>

      <HStack>
        <Text modifiers={[font({ weight: 'semibold', size: 14 }), foregroundStyle(MUTED)]}>
          {route}
        </Text>
        <Spacer />
        <Text modifiers={[font({ weight: 'bold', size: 18 }), foregroundStyle(GOLD)]}>
          {props.timeLabel}
        </Text>
      </HStack>

      <HStack>
        <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle(WHITE)]}>
          {props.countdown}
        </Text>
        <Spacer />
        {props.gate ? (
          <Text modifiers={[font({ weight: 'bold', size: 13 }), foregroundStyle(GOLD)]}>
            Gate {props.gate}
          </Text>
        ) : null}
      </HStack>

      {props.showDelayBanner ? (
        <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle(DELAY_BG)]}>
          Delayed +{props.delayMinutes}m
        </Text>
      ) : null}
    </VStack>
  );
};

export default createWidget<FlightHomeWidgetProps>('FlightHomeWidget', FlightHomeWidgetLayout);

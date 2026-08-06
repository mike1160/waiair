import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
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
};

const FlightActivityLayout = (props: FlightActivityProps, env: LiveActivityEnvironment) => {
  'widget';
  const accent = env.colorScheme === 'dark' ? '#A8905A' : '#0B1F3A';
  const green = '#22c55e';
  const labelColor =
    props.phase === 'boarding' ? green :
    props.phase === 'departed' ? '#94a3b8' :
    props.phase === 'landed' ? '#a78bfa' :
    accent;

  const route = `${props.origin} → ${props.destination}`;
  const boardDate = new Date(props.boardEpochMs);
  const now = new Date();

  const Countdown = ({ size, width }: { size: number; width: number }) => {
    if (props.phase === 'upcoming' && props.boardEpochMs > Date.now()) {
      return (
        <Text
          timerInterval={{ lower: now, upper: boardDate }}
          countsDown
          modifiers={[
            font({ weight: 'bold', size }),
            foregroundStyle(accent),
            monospacedDigit(),
          ]}
        />
      );
    }
    return (
      <Text modifiers={[font({ weight: 'bold', size }), foregroundStyle(labelColor)]}>
        {props.statusLabel}
      </Text>
    );
  };

  return {
    banner: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <HStack>
          <Text modifiers={[font({ weight: 'bold', size: 18 }), foregroundStyle(accent)]}>
            {props.flightNumber}
          </Text>
          <Spacer />
          <Text modifiers={[font({ weight: 'semibold', size: 13 }), foregroundStyle(labelColor)]}>
            {props.status}
          </Text>
        </HStack>
        <Text modifiers={[font({ size: 14 }), foregroundStyle('#64748b')]}>{route}</Text>
        <HStack>
          <Text modifiers={[font({ weight: 'semibold', size: 15 }), foregroundStyle(labelColor)]}>
            {props.phase === 'upcoming' ? 'Boards in' : props.statusLabel}
          </Text>
          {props.phase === 'upcoming' ? (
            <>
              <Spacer />
              <Countdown size={15} width={72} />
            </>
          ) : null}
        </HStack>
      </VStack>
    ),
    compactLeading: <Image systemName="airplane" color={accent} />,
    compactTrailing: (
      props.phase === 'upcoming' ? (
        <Text
          timerInterval={{ lower: now, upper: boardDate }}
          countsDown
          modifiers={[font({ size: 14, weight: 'bold' }), monospacedDigit(), foregroundStyle(accent)]}
        />
      ) : (
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(labelColor)]}>
          {props.phase === 'boarding' ? 'NOW' : props.phase === 'departed' ? 'OUT' : props.status.slice(0, 6)}
        </Text>
      )
    ),
    minimal: <Image systemName="airplane" color={accent} />,
    expandedLeading: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Image systemName="airplane.departure" color={accent} />
        <Text modifiers={[font({ size: 11 }), foregroundStyle(accent)]}>{props.flightNumber}</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Countdown size={18} width={80} />
      </VStack>
    ),
    expandedBottom: (
      <VStack modifiers={[padding({ all: 10 })]}>
        <Text modifiers={[font({ weight: 'bold', size: 14 }), foregroundStyle(accent)]}>{route}</Text>
        <Text modifiers={[font({ size: 13 }), foregroundStyle(labelColor)]}>{props.statusLabel}</Text>
      </VStack>
    ),
  };
};

export default createLiveActivity<FlightActivityProps>('FlightActivity', FlightActivityLayout);

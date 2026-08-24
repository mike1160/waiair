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
  depClock: string;
  arrClock: string;
  terminal: string;
  depStatus: string;
  arrStatus: string;
  gateDepartureLabel: string;
  airlineIata: string;
  airlineLogoUri: string;
  airlineInitials: string;
  airlineLogoColor: string;
  status: string;
  statusLabel: string;
  phase: string;
  boardEpochMs: number;
  gate: string;
  minutesUntil: number;
  seat: string;
};

const BG = '#0F1117';
const YELLOW = '#F5C518';
const GREEN = '#00C853';
const AMBER = '#FF9800';
const RED = '#F44336';
const MUTED = '#888888';
const WHITE = '#FFFFFF';

function statusTextColor(phase: string, status: string, statusLabel: string): string {
  const blob = `${phase} ${status} ${statusLabel}`.toLowerCase();
  if (phase === 'cancelled' || blob.includes('cancel')) return RED;
  if (blob.includes('delay')) return AMBER;
  if (phase === 'boarding' || blob.includes('board')) return GREEN;
  if (blob.includes('on time') || phase === 'upcoming' || blob.includes('scheduled')) return GREEN;
  return WHITE;
}

function gateCode(gate: string): string {
  const raw = String(gate || '').trim();
  if (!raw || /^(—|-|–|n\/?a|tba|tbd|null|\.+)$/i.test(raw)) return '';
  const code = raw.replace(/^gates?\s*:?\s*/i, '').trim();
  return code && !/^(—|-|–)$/.test(code) ? code : '';
}

function minutesLabel(props: FlightActivityProps, nowMs: number): string {
  if (Number.isFinite(props.minutesUntil)) {
    const m = Math.max(0, Math.round(props.minutesUntil));
    return `${m}m`;
  }
  const target = Number(props.boardEpochMs) || 0;
  if (target > nowMs) {
    return `${Math.max(0, Math.round((target - nowMs) / 60000))}m`;
  }
  return '';
}

function terminalStatusLine(terminal: string, status: string): string {
  const term = String(terminal || '').trim();
  const st = String(status || '').trim();
  if (term && st) return `${term} · ${st}`;
  return term || st;
}

const FlightActivityLayout = (props: FlightActivityProps, _env: LiveActivityEnvironment) => {
  'widget';
  const statusColor = statusTextColor(props.phase, props.status, props.statusLabel);
  const gate = gateCode(props.gate);
  const nowMs = Date.now();
  const targetMs = Number(props.boardEpochMs) || 0;
  const hasTimer = targetMs > nowMs;
  const now = new Date(nowMs);
  const boardDate = new Date(targetMs);
  const mins = minutesLabel(props, nowMs);
  const countdownTxt = hasTimer ? mins : (props.statusLabel || props.status || mins);
  const flight = String(props.flightNumber || '').trim();
  const origin = String(props.origin || '').trim();
  const dest = String(props.destination || '').trim();
  const depClock = String(props.depClock || '').trim();
  const arrClock = String(props.arrClock || '').trim();
  const terminal = String(props.terminal || '').trim();
  const depStatus = String(props.depStatus || props.status || '').trim();
  const arrStatus = String(props.arrStatus || depStatus).trim();
  const gateDepartureLabel = String(props.gateDepartureLabel || props.statusLabel || '').trim();
  const row3Left = terminalStatusLine(terminal, depStatus);
  const expandedBottomMeta = [depStatus, terminal].filter(Boolean).join(' · ');
  const airlineIata = String(props.airlineIata || '').trim();
  const airlineLogoUri = String(props.airlineLogoUri || '').trim();
  const airlineInitials = String(props.airlineInitials || airlineIata.slice(0, 2)).trim();
  const airlineLogoColor = String(props.airlineLogoColor || '#0A1628').trim();

  const AirlineLogoMark = ({ size }: { size: number }) => {
    if (airlineLogoUri) {
      return (
        <Image
          uiImage={airlineLogoUri}
          size={size}
          modifiers={[background('#FFFFFF'), padding({ horizontal: 2, vertical: 2 })]}
        />
      );
    }
    if (!airlineInitials) return <Text modifiers={[font({ size: 1 })]}> </Text>;
    return (
      <Text
        modifiers={[
          font({ weight: 'bold', size: Math.max(8, Math.round(size * 0.38)) }),
          foregroundStyle(WHITE),
          background(airlineLogoColor),
          padding({ horizontal: 4, vertical: 2 }),
        ]}
      >
        {airlineInitials}
      </Text>
    );
  };

  const Countdown = ({ size, color = YELLOW }: { size: number; color?: string }) => {
    if (hasTimer) {
      return (
        <Text
          timerInterval={{ lower: now, upper: boardDate }}
          countsDown
          modifiers={[
            font({ weight: 'bold', size }),
            foregroundStyle(color),
            monospacedDigit(),
          ]}
        >
          {mins}
        </Text>
      );
    }
    if (!countdownTxt) return <Text modifiers={[font({ size: 1 })]}> </Text>;
    return (
      <Text modifiers={[font({ weight: 'bold', size }), foregroundStyle(color), monospacedDigit()]}>
        {countdownTxt}
      </Text>
    );
  };

  const AirplaneIcon = ({ size = 12, color = YELLOW }: { size?: number; color?: string }) => (
    <Image systemName="airplane" color={color} />
  );

  const GateBadge = ({ code }: { code: string }) => (
    <Text
      modifiers={[
        font({ weight: 'bold', size: 12 }),
        foregroundStyle('#000000'),
        background(YELLOW),
        padding({ horizontal: 6, vertical: 2 }),
      ]}
    >
      {code}
    </Text>
  );

  const Dot = () => (
    <Image systemName="circle.fill" color={statusColor} />
  );

  return {
    banner: (
      <VStack
        modifiers={[
          background(BG),
          padding({ leading: 12, trailing: 12, top: 8, bottom: 8 }),
        ]}
      >
        <HStack>
          <HStack>
            <AirlineLogoMark size={24} />
            {flight ? (
              <Text modifiers={[font({ weight: 'bold', size: 14 }), foregroundStyle(WHITE)]}>
                {flight}
              </Text>
            ) : (
              <Text modifiers={[font({ size: 1 })]}> </Text>
            )}
          </HStack>
          <Spacer />
          <Text modifiers={[font({ weight: 'medium', size: 10 }), foregroundStyle(MUTED)]}>
            WAIAIR
          </Text>
        </HStack>

        <HStack modifiers={[padding({ top: 4 })]}>
          {origin ? (
            <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(WHITE)]}>
              {origin}
            </Text>
          ) : (
            <Text modifiers={[font({ size: 1 })]}> </Text>
          )}
          {depClock ? (
            <Text modifiers={[font({ weight: 'bold', size: 20 }), foregroundStyle(YELLOW), monospacedDigit()]}>
              {depClock}
            </Text>
          ) : (
            <Text modifiers={[font({ size: 1 })]}> </Text>
          )}
          <Spacer />
          <AirplaneIcon />
          <Spacer />
          {arrClock ? (
            <Text modifiers={[font({ weight: 'bold', size: 20 }), foregroundStyle(YELLOW), monospacedDigit()]}>
              {arrClock}
            </Text>
          ) : (
            <Text modifiers={[font({ size: 1 })]}> </Text>
          )}
          {dest ? (
            <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(WHITE)]}>
              {dest}
            </Text>
          ) : (
            <Text modifiers={[font({ size: 1 })]}> </Text>
          )}
        </HStack>

        <HStack modifiers={[padding({ top: 3 })]}>
          {row3Left ? (
            <Text modifiers={[font({ weight: 'semibold', size: 11 }), foregroundStyle(statusColor)]}>
              {row3Left}
            </Text>
          ) : (
            <Text modifiers={[font({ size: 1 })]}> </Text>
          )}
          <Spacer />
          {arrStatus ? (
            <Text modifiers={[font({ weight: 'semibold', size: 11 }), foregroundStyle(statusColor)]}>
              {arrStatus}
            </Text>
          ) : (
            <Text modifiers={[font({ size: 1 })]}> </Text>
          )}
        </HStack>

        <HStack modifiers={[padding({ top: 4 })]}>
          {gateDepartureLabel ? (
            <Text modifiers={[font({ weight: 'semibold', size: 12 }), foregroundStyle(GREEN)]}>
              {gateDepartureLabel}
            </Text>
          ) : (
            <Text modifiers={[font({ size: 1 })]}> </Text>
          )}
          <Spacer />
          {gate ? <GateBadge code={gate} /> : <Text modifiers={[font({ size: 1 })]}> </Text>}
        </HStack>
      </VStack>
    ),
    bannerSmall: (
      <HStack modifiers={[background(BG), padding({ horizontal: 8, vertical: 4 })]}>
        {flight ? (
          <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle(WHITE)]}>
            {flight}
          </Text>
        ) : (
          <Text modifiers={[font({ size: 1 })]}> </Text>
        )}
        <Spacer />
        <Countdown size={12} />
      </HStack>
    ),
    compactLeading: (
      <HStack modifiers={[background(BG), padding({ horizontal: 6, vertical: 4 })]}>
        {flight ? (
          <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle(WHITE)]}>
            {flight}
          </Text>
        ) : (
          <Text modifiers={[font({ size: 1 })]}> </Text>
        )}
      </HStack>
    ),
    compactTrailing: <Countdown size={12} />,
    minimal: <Dot />,
    expandedLeading: (
      <HStack modifiers={[background(BG), padding({ leading: 6, trailing: 4, top: 2, bottom: 2 })]}>
        <AirlineLogoMark size={16} />
        <VStack>
          {origin ? (
            <Text modifiers={[font({ weight: 'bold', size: 13 }), foregroundStyle(WHITE)]}>
              {origin}
            </Text>
          ) : (
            <Text modifiers={[font({ size: 1 })]}> </Text>
          )}
          {depClock ? (
            <Text modifiers={[font({ weight: 'bold', size: 15 }), foregroundStyle(YELLOW), monospacedDigit()]}>
              {depClock}
            </Text>
          ) : (
            <Text modifiers={[font({ size: 1 })]}> </Text>
          )}
        </VStack>
      </HStack>
    ),
    expandedCenter: (
      <HStack modifiers={[background(BG), padding({ horizontal: 4, vertical: 2 })]}>
        <AirplaneIcon size={14} />
      </HStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[background(BG), padding({ leading: 4, trailing: 6, top: 2, bottom: 2 })]}>
        {arrClock ? (
          <Text modifiers={[font({ weight: 'bold', size: 15 }), foregroundStyle(YELLOW), monospacedDigit()]}>
            {arrClock}
          </Text>
        ) : (
          <Text modifiers={[font({ size: 1 })]}> </Text>
        )}
        {dest ? (
          <Text modifiers={[font({ weight: 'bold', size: 13 }), foregroundStyle(WHITE)]}>
            {dest}
          </Text>
        ) : (
          <Text modifiers={[font({ size: 1 })]}> </Text>
        )}
      </VStack>
    ),
    expandedBottom: (
      <HStack modifiers={[background(BG), padding({ leading: 8, trailing: 8, top: 2, bottom: 4 })]}>
        {expandedBottomMeta ? (
          <Text modifiers={[font({ weight: 'semibold', size: 11 }), foregroundStyle(statusColor)]}>
            {expandedBottomMeta}
          </Text>
        ) : (
          <Text modifiers={[font({ size: 1 })]}> </Text>
        )}
        {gate ? <GateBadge code={gate} /> : <Text modifiers={[font({ size: 1 })]}> </Text>}
        <Spacer />
        <Countdown size={11} />
      </HStack>
    ),
  };
};

export default createLiveActivity<FlightActivityProps>('FlightActivity', FlightActivityLayout);

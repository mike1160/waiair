/** Android / web stub — Live Activities are iOS-only */

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
  /**
   * Reasoning layer, all optional. The native widget ignores fields it does not declare, so these are safe
   * to send before the Swift side reads them (see widgets/FlightActivity.ios.tsx and the iOS extension).
   */
  leaveAtLabel?: string;
  transportLabel?: string;
  hotelLabel?: string;
};

const noopActivity = {
  update: async (_props: FlightActivityProps) => {},
  end: async (_policy?: string, _props?: FlightActivityProps) => {},
};

const FlightActivity = {
  start(_props: FlightActivityProps, _url?: string) {
    return noopActivity;
  },
  getInstances() {
    return [] as typeof noopActivity[];
  },
};

export default FlightActivity;

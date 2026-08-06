/** Android / web stub — Live Activities are iOS-only */

export type FlightActivityProps = {
  flightNumber: string;
  origin: string;
  destination: string;
  status: string;
  statusLabel: string;
  phase: string;
  boardEpochMs: number;
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

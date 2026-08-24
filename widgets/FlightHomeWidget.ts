/** Android / web stub — home screen widgets are iOS-only via expo-widgets. */

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

const FlightHomeWidget = {
  updateSnapshot(_props: FlightHomeWidgetProps) {},
  updateTimeline(_entries: { date: Date; props: FlightHomeWidgetProps }[]) {},
  reload() {},
  getTimeline: async () => [] as { date: Date; props: FlightHomeWidgetProps }[],
};

export default FlightHomeWidget;

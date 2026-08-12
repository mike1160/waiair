/** Android / web stub — home screen widgets are iOS-only via expo-widgets */

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

const FlightHomeWidget = {
  updateSnapshot(_props: FlightHomeWidgetProps) {},
  updateTimeline(_entries: { date: Date; props: FlightHomeWidgetProps }[]) {},
  reload() {},
  getTimeline: async () => [] as { date: Date; props: FlightHomeWidgetProps }[],
};

export default FlightHomeWidget;

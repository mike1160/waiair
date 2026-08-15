/** Android / web stub — home screen widgets are iOS-only via expo-widgets.
 *  Android app widgets can be added later (e.g. react-native-android-widget) without changing callers.
 */

export type FlightHomeWidgetProps = {
  hasFlight: boolean;
  flightNumber: string;
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
  origin2: string;
  destination2: string;
  statusBadge2: string;
  timeLabel2: string;
  gate2: string;
  terminal2: string;
};

const FlightHomeWidget = {
  updateSnapshot(_props: FlightHomeWidgetProps) {},
  updateTimeline(_entries: { date: Date; props: FlightHomeWidgetProps }[]) {},
  reload() {},
  getTimeline: async () => [] as { date: Date; props: FlightHomeWidgetProps }[],
};

export default FlightHomeWidget;

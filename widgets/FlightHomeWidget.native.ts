import { Platform } from 'react-native';
import FlightHomeWidgetStub, { type FlightHomeWidgetProps } from './FlightHomeWidget';

export type { FlightHomeWidgetProps };

const FlightHomeWidget = Platform.OS === 'ios'
  ? (require('./FlightHomeWidget.ios') as typeof import('./FlightHomeWidget.ios')).default
  : FlightHomeWidgetStub;

export default FlightHomeWidget;

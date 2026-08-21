import { type DetailCardTheme } from './lib/detailCardStyles';

export function shouldShowTravelInsuranceBanner(_durationMs?: number | null): boolean {
  return false;
}

export default function TravelInsuranceBanner(_props: {
  durationMs?: number | null;
  theme: DetailCardTheme;
  embedded?: boolean;
}) {
  return null;
}

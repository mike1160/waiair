import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { detailCardBg, detailCardStyles as st, type DetailCardTheme } from './lib/detailCardStyles';
import { getJetlagInfo } from './lib/jetlag';
import { t } from './lib/i18n';

export default function JetlagTipsCard({
  originIata,
  destIata,
  originCountry,
  destCountry,
  theme,
}: {
  originIata?: string;
  destIata?: string;
  originCountry?: string;
  destCountry?: string;
  theme: DetailCardTheme;
}) {
  const info = useMemo(
    () => getJetlagInfo(originIata, destIata, originCountry, destCountry),
    [originIata, destIata, originCountry, destCountry],
  );

  if (!info) return null;

  const tips = info.eastbound
    ? [t().jetlagEastTip1, t().jetlagEastTip2, t().jetlagEastTip3]
    : [t().jetlagWestTip1, t().jetlagWestTip2, t().jetlagWestTip3];

  const diffLabel = info.diffHours > 0 ? `+${info.diffHours}h` : `${info.diffHours}h`;

  return (
    <View style={[st.card, { backgroundColor: detailCardBg(theme) }]}>
      <Text style={[st.title, { color: theme.text }]}>
        {`😴 ${t().jetlagTipsTitle}`}
      </Text>
      <Text style={[st.sub, { color: theme.secondary }]}>
        {`${info.originLabel} → ${info.destLabel}`}
      </Text>
      <Text style={[st.sub, { color: theme.muted }]}>
        {t().jetlagTimeDiff(diffLabel)}
      </Text>
      {tips.map((tip, i) => (
        <Text key={i} style={[st.tip, { color: theme.text }]}>
          {`• ${tip}`}
        </Text>
      ))}
    </View>
  );
}

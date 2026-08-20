import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { TILE_CREAM, TILE_GOLD, TILE_NAVY } from './lib/affiliateBrands';

export default function AffiliatePanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={st.card}>
      <View style={st.head}>
        {icon}
        <Text style={st.title} numberOfLines={1}>{title}</Text>
      </View>
      <View style={st.body}>{children}</View>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: TILE_NAVY,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(201, 168, 76, 0.45)',
    overflow: 'hidden',
    marginTop: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  title: {
    flex: 1,
    color: TILE_CREAM,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  body: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 8,
  },
});

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { detailCardBg, detailCardStyles as st, type DetailCardTheme } from './lib/detailCardStyles';
import { mealForAirline, shouldShowMealInfo } from './lib/airlineMeals';
import { t } from './lib/i18n';

export default function MealInfoCard({
  airlineCode,
  durationMs,
  theme,
}: {
  airlineCode?: string;
  durationMs?: number | null;
  theme: DetailCardTheme;
}) {
  if (!shouldShowMealInfo(durationMs, airlineCode)) return null;
  const meal = mealForAirline(airlineCode);
  if (!meal) return null;

  return (
    <View style={[st.card, styles.card, { backgroundColor: detailCardBg(theme) }]}>
      <Text style={[st.title, { color: theme.text }]}>{`🍽️ ${t().mealOnboard}`}</Text>
      <Text style={[st.body, { color: theme.secondary }]}>{meal.description}</Text>
      <Pressable
        onPress={() => { void Linking.openURL(meal.menuUrl); }}
        accessibilityRole="link"
        accessibilityLabel={t().viewMenu}
        style={styles.link}
      >
        <Text style={styles.linkTxt}>{t().viewMenu}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(245,158,11,0.22)' },
  link: { marginTop: 10, alignSelf: 'flex-start' },
  linkTxt: { color: '#f59e0b', fontSize: 13, fontWeight: '800' },
});

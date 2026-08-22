import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Theme } from './constants/theme';

type Props = {
  sectionId: string;
  title?: string;
  onView: (sectionId: string) => void;
  children: ReactNode;
};

export default function DetailCardSection({ sectionId, title, onView, children }: Props) {
  const seen = useRef(false);

  useEffect(() => {
    if (seen.current) return;
    seen.current = true;
    onView(sectionId);
  }, [sectionId, onView]);

  return (
    <View style={styles.wrap}>
      <View style={styles.separator} />
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Theme.gap },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Theme.gold,
    opacity: 0.45,
    marginBottom: 10,
  },
  title: {
    color: Theme.gold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
});

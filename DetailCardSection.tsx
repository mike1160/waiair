import { useEffect, useRef, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Theme } from './constants/theme';

type Props = {
  sectionId: string;
  title?: string;
  onView: (sectionId: string) => void;
  children: ReactNode;
  /** Gold hairline above the section. Off for nested cards that may render nothing. */
  divider?: boolean;
};

export default function DetailCardSection({
  sectionId,
  title,
  onView,
  children,
  divider = true,
}: Props) {
  const seen = useRef(false);

  useEffect(() => {
    if (seen.current) return;
    seen.current = true;
    onView(sectionId);
  }, [sectionId, onView]);

  if (children == null || children === false) return null;

  return (
    <View style={divider ? styles.wrap : styles.wrapFlush}>
      {divider ? <View style={styles.separator} /> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Theme.gap },
  wrapFlush: { marginTop: 0 },
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

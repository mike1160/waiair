import { useEffect, useRef, type ReactNode } from 'react';
import { View } from 'react-native';

type Props = {
  sectionId: string;
  onView: (sectionId: string) => void;
  children: ReactNode;
};

export default function DetailCardSection({ sectionId, onView, children }: Props) {
  const seen = useRef(false);

  useEffect(() => {
    if (seen.current) return;
    seen.current = true;
    onView(sectionId);
  }, [sectionId, onView]);

  return <View>{children}</View>;
}

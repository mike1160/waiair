import { Text } from 'react-native';

/** Highlight case-insensitive matches of `query` inside `text`. */
export function HighlightText({
  text,
  query,
  color,
  highlightColor,
  style,
  numberOfLines,
}: {
  text: string;
  query?: string;
  color: string;
  highlightColor: string;
  style?: any;
  numberOfLines?: number;
}) {
  const q = String(query || '').trim();
  if (!q) {
    return (
      <Text style={[style, { color }]} numberOfLines={numberOfLines} ellipsizeMode="tail">
        {text}
      </Text>
    );
  }
  const src = String(text || '');
  const lower = src.toLowerCase();
  const needle = q.toLowerCase();
  const parts: { str: string; hit: boolean }[] = [];
  let i = 0;
  while (i < src.length) {
    const at = lower.indexOf(needle, i);
    if (at < 0) {
      parts.push({ str: src.slice(i), hit: false });
      break;
    }
    if (at > i) parts.push({ str: src.slice(i, at), hit: false });
    parts.push({ str: src.slice(at, at + needle.length), hit: true });
    i = at + needle.length;
  }
  return (
    <Text style={[style, { color }]} numberOfLines={numberOfLines} ellipsizeMode="tail">
      {parts.map((p, idx) => (
        <Text
          key={idx}
          style={p.hit ? { color: highlightColor, fontWeight: '800', backgroundColor: `${highlightColor}22` } : undefined}
        >
          {p.str}
        </Text>
      ))}
    </Text>
  );
}

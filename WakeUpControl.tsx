import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Alarm, Lock } from 'phosphor-react-native';
import {
  clearWakeAlarm, ensureLongHaulWakeAlarm, loadWakeAlarms, setWakeAlarm, type WakeAlarm,
} from './lib/proStorage';
import { t } from './lib/i18n';

type Props = {
  flightKey: string;
  flightNumber: string;
  landAtIso: string;
  durationMs?: number | null;
  isPro: boolean;
  gold: string;
  text: string;
  secondary: string;
  list: string;
  onRequirePro: () => void;
  onToast: (msg: string) => void;
};

const OPTIONS: Array<30 | 45 | 60> = [30, 45, 60];

export default function WakeUpControl({
  flightKey, flightNumber, landAtIso, durationMs, isPro, gold, text, secondary, list,
  onRequirePro, onToast,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [alarm, setAlarm] = useState<WakeAlarm | null>(null);

  useEffect(() => {
    loadWakeAlarms().then((map) => setAlarm(map[flightKey] ?? null));
  }, [flightKey]);

  useEffect(() => {
    if (!isPro || !landAtIso) return;
    let cancelled = false;
    void ensureLongHaulWakeAlarm({
      flightKey,
      flightNumber,
      landAtIso,
      durationMs,
      isPro,
    }).then(({ alarm: next, shouldToast }) => {
      if (cancelled || !next) return;
      setAlarm(next);
      if (shouldToast) onToast(t().wakeUpAutoSet);
    });
    return () => { cancelled = true; };
  }, [flightKey, flightNumber, landAtIso, durationMs, isPro, onToast]);

  if (!landAtIso) return null;

  const start = () => {
    if (!isPro) {
      onRequirePro();
      return;
    }
    setOpen((v) => !v);
  };

  const pick = async (mins: 30 | 45 | 60) => {
    setBusy(true);
    try {
      const next = await setWakeAlarm({
        flightKey,
        flightNumber,
        landAtIso,
        minutesBefore: mins,
        source: 'manual',
      });
      if (!next) {
        onToast(t().landingTooSoon);
        return;
      }
      setAlarm(next);
      setOpen(false);
      onToast(t().wakeUpSet(mins));
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await clearWakeAlarm(flightKey);
      setAlarm(null);
      setOpen(false);
      onToast(t().wakeUpCleared);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: list, borderColor: gold }]}
        onPress={start}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t().setWakeAlarm}
      >
        <Alarm size={16} color={gold} />
        <Text style={[styles.btnTxt, { color: gold }]}>
          {alarm ? t().wakeUpBefore(alarm.minutesBefore) : t().setWakeAlarm}
        </Text>
        {!isPro ? (
          <View style={[styles.pro, { borderColor: gold }]}>
            <Lock size={11} color={gold} />
            <Text style={[styles.proTxt, { color: gold }]}>{t().pro}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
      {alarm?.source === 'auto' && alarm.minutesBefore === 45 ? (
        <Text style={[styles.autoTxt, { color: gold }]}>{t().wakeUpAutoSet}</Text>
      ) : null}

      {open && isPro ? (
        <View style={[styles.sheet, { backgroundColor: list }]}>
          <Text style={[styles.hint, { color: secondary }]}>{t().wakeMeBeforeLanding}</Text>
          <View style={styles.row}>
            {OPTIONS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.chip,
                  { borderColor: gold },
                  alarm?.minutesBefore === m && { backgroundColor: gold },
                ]}
                onPress={() => pick(m)}
                disabled={busy}
              >
                <Text style={[
                  styles.chipTxt,
                  { color: gold },
                  alarm?.minutesBefore === m && { color: '#0F1728' },
                ]}>
                  {t().min(m)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {busy ? <ActivityIndicator color={gold} style={{ marginTop: 8 }} /> : null}
          {alarm ? (
            <TouchableOpacity onPress={clear} hitSlop={8} style={{ marginTop: 10 }}>
              <Text style={{ color: secondary, fontSize: 12, fontWeight: '700' }}>{t().clearAlarm}</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={[styles.preview, { color: text }]}>
            {t().wakePreview(flightNumber)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, gap: 8 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  btnTxt: { flex: 1, fontSize: 14, fontWeight: '700' },
  autoTxt: { fontSize: 12, fontWeight: '700' },
  pro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proTxt: { fontSize: 10, fontWeight: '800' },
  sheet: { borderRadius: 14, padding: 12 },
  hint: { fontSize: 12, fontWeight: '600', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chipTxt: { fontSize: 13, fontWeight: '700' },
  preview: { fontSize: 11, marginTop: 10, opacity: 0.7 },
});

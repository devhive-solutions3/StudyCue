import React, { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../lib/firebase';
import GlassCard from './GlassCard';
import { colors, radii } from '../lib/theme';

const DISMISS_KEY = 'studycue.cloud_migration_bannerDismissed';

type Props = {
  onDataChanged?: () => void | Promise<void>;
};

export default function CloudMigrationCard({ onDataChanged }: Props) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const v = await AsyncStorage.getItem(DISMISS_KEY);
      if (!cancel && v !== '1' && auth.currentUser) setVisible(true);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const dismiss = useCallback(async () => {
    await AsyncStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }, []);

  const backup = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    setBusy(true);
    try {
      const { pushMirrorNow } = await import('../lib/sync');
      await pushMirrorNow(u);
      await AsyncStorage.setItem(DISMISS_KEY, '1');
      setVisible(false);
      await onDataChanged?.();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }, [onDataChanged]);

  const restore = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    setBusy(true);
    try {
      const { restoreCloudOverwrite } = await import('../lib/sync');
      await restoreCloudOverwrite(u);
      await onDataChanged?.();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }, [onDataChanged]);

  if (!visible || !auth.currentUser) return null;

  return (
    <GlassCard style={styles.card} tintColor="rgba(79,120,255,0.08)">
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Ionicons name="cloud-upload-outline" size={20} color={colors.indigo} />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.title}>Web and cloud backup</Text>
          <Text style={styles.sub}>
            Back up study data so the StudyCue web app can load it from the same Google account.
          </Text>
          {busy ? <ActivityIndicator style={styles.mt8} color={colors.indigo} /> : null}
          <View style={styles.btns}>
            <TouchableOpacity onPress={backup} disabled={busy} style={styles.primary}>
              <Text style={styles.primaryText}>Backup to cloud now</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={restore} disabled={busy} style={styles.secondary}>
              <Text style={styles.secondaryText}>Restore from cloud</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={dismiss} disabled={busy}>
              <Text style={styles.link}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    paddingVertical: 4,
  },
  flex1: { flex: 1 },
  mt8: { marginTop: 8 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(79,120,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 16, color: colors.ink },
  sub: {
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: colors.inkMuted,
  },
  btns: { marginTop: 12, gap: 10 },
  primary: {
    backgroundColor: colors.indigo,
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { color: colors.white, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  secondary: {
    borderWidth: 1,
    borderColor: 'rgba(16,33,59,0.15)',
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: colors.ink, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  link: {
    alignSelf: 'center',
    color: colors.inkMuted,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    marginTop: 4,
  },
});

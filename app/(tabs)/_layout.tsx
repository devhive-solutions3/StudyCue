import { Tabs, useRouter, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows } from '../../lib/theme';

export default function TabLayout() {
  const router = useRouter();
  const segments = useSegments();
  const cueSelected = segments.includes('chat');

  return (
    <View style={styles.shell}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.ink,
          tabBarInactiveTintColor: 'rgba(16,33,59,0.45)',
          tabBarStyle: {
            position: 'absolute',
            left: 18,
            right: 18,
            bottom: 20,
            height: 78,
            borderTopWidth: 0,
            paddingBottom: 10,
            paddingTop: 10,
            borderRadius: radii.xxl,
            backgroundColor: 'rgba(255,255,255,0.66)',
            ...shadows.soft,
          },
          tabBarBackground: () => <View style={styles.tabBarGlass} />,
          tabBarLabelStyle: {
            fontFamily: 'Inter_500Medium',
            fontSize: 11,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ color }) => <Ionicons name="calendar" size={24} color={color} />,
            tabBarItemStyle: styles.leftCenterItem,
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: 'Stats',
            tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={24} color={color} />,
            tabBarItemStyle: styles.rightCenterItem,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <Ionicons name="person-circle" size={24} color={color} />,
          }}
        />
      </Tabs>

      <View pointerEvents="box-none" style={styles.cueOverlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Cue"
          onPress={() => router.navigate('/(tabs)/chat')}
          style={styles.cueButtonWrap}>
          <View style={[styles.cueHalo, styles.cueHaloPurple]} />
          <View style={[styles.cueHalo, styles.cueHaloBlue]} />
          <View style={[styles.cueHalo, styles.cueHaloGreen]} />
          <View style={[styles.cueButton, cueSelected && styles.cueButtonSelected]}>
            <View style={styles.cueHighlight} />
            <Ionicons name="sparkles" size={28} color={colors.white} />
          </View>
          <Text style={styles.cueLabel}>Cue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  tabBarGlass: {
    flex: 1,
    borderRadius: radii.xxl,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
  },
  cueOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 44,
  },
  leftCenterItem: {
    marginRight: 20,
  },
  rightCenterItem: {
    marginLeft: 20,
  },
  cueButtonWrap: {
    width: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cueHalo: {
    position: 'absolute',
    borderRadius: 999,
  },
  cueHaloPurple: {
    top: 0,
    width: 72,
    height: 72,
    backgroundColor: 'rgba(124,98,255,0.14)',
  },
  cueHaloBlue: {
    top: 8,
    left: 10,
    width: 56,
    height: 56,
    backgroundColor: 'rgba(79,120,255,0.12)',
  },
  cueHaloGreen: {
    top: 12,
    right: 12,
    width: 44,
    height: 44,
    backgroundColor: 'rgba(52,211,153,0.10)',
  },
  cueButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,98,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.64)',
    shadowColor: colors.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  cueButtonSelected: {
    transform: [{ scale: 1.02 }],
  },
  cueHighlight: {
    position: 'absolute',
    top: 4,
    left: 11,
    right: 11,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  cueLabel: {
    marginTop: 8,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: colors.ink,
  },
});

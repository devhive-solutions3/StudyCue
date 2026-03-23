import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { colors, radii, shadows } from '../../lib/theme';

export default function TabLayout() {
  return (
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
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Cue',
          tabBarIcon: ({ color }) => (
            <View style={{
              top: -18,
              justifyContent: 'center',
              alignItems: 'center',
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: colors.purple,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.38)',
              shadowColor: colors.purple,
              shadowOffset: {
                width: 0,
                height: 12,
              },
              shadowOpacity: 0.28,
              shadowRadius: 22,
              elevation: 8,
            }}>
              <Ionicons name="sparkles" size={28} color="#FFFFFF" />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color }) => <Ionicons name="bar-chart" size={24} color={color} />,
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
  );
}

const styles = {
  tabBarGlass: {
    flex: 1,
    borderRadius: radii.xxl,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
  },
};

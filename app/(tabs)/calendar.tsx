import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../lib/firebase';
import { Calendar, ICalendarEventBase } from 'react-native-big-calendar';
import dayjs from 'dayjs';
import weekdayPlugin from 'dayjs/plugin/weekday';
import GlowBackground from '../../components/GlowBackground';
import { colors, radii } from '../../lib/theme';
import { AppSnapshot, loadUserAppSnapshot, type ClassItem } from '../../lib/user-app-data';

dayjs.extend(weekdayPlugin);

const EMPTY_SNAPSHOT: AppSnapshot = {
  localUserId: null,
  displayName: null,
  email: null,
  classes: [],
  tasks: [],
  sessions: [],
};

const mapWeekdayToNumber: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

// Generates recurring Date instances for weekly classes (next 6 months)
function generateRecurringEvents(classes: ClassItem[]): ICalendarEventBase[] {
  const events: ICalendarEventBase[] = [];
  const startRange = dayjs().subtract(1, 'month').startOf('month');
  const endRange = dayjs().add(6, 'month').endOf('month');

  classes.forEach((cls) => {
    const dayIndex = mapWeekdayToNumber[cls.weekday || ''];
    if (dayIndex !== undefined && cls.startTime && cls.endTime) {
      // Find the first occurrence of this weekday on or after startRange
      let current = startRange.startOf('week').add(dayIndex, 'day');
      if (current.isBefore(startRange)) {
        current = current.add(1, 'week');
      }

      while (current.isBefore(endRange)) {
        const [startH, startM] = cls.startTime.split(':');
        const [endH, endM] = cls.endTime.split(':');

        if (startH !== undefined && endH !== undefined) {
          const start = current.hour(Number(startH)).minute(Number(startM)).toDate();
          const end = current.hour(Number(endH)).minute(Number(endM)).toDate();

          events.push({
            title: cls.title + (cls.location ? `\n📍 ${cls.location}` : ''),
            start,
            end,
          });
        }
        current = current.add(1, 'week'); // Move to next week
      }
    }
  });
  return events;
}

export default function CalendarScreen() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(EMPTY_SNAPSHOT);
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('week');

  useEffect(() => {
    let isMounted = true;

    const loadSnapshot = async () => {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;
      try {
        const nextSnapshot = await loadUserAppSnapshot(firebaseUser);
        if (isMounted) {
          setSnapshot(nextSnapshot);
        }
      } catch (error) {
        console.error('Failed to load calendar data', error);
      }
    };

    // Poll to keep new AI-added AI schedule sync'd without manual refresh
    const interval = setInterval(loadSnapshot, 3000);
    loadSnapshot();

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const mappedEvents = useMemo(() => generateRecurringEvents(snapshot.classes), [snapshot.classes]);

  return (
    <GlowBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Calendar</Text>
          <View style={styles.switcher}>
            {(['month', 'week', 'day'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => setMode(m)}
                style={[styles.switchButton, mode === m && styles.switchButtonActive]}
              >
                <Text style={[styles.switchText, mode === m && styles.switchTextActive]}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.calendarContainer}>
          <Calendar
            events={mappedEvents}
            height={600}
            mode={mode}
            swipeEnabled={true}
            showTime={true}
            eventCellStyle={{
             backgroundColor: colors.purple,
             borderRadius: 12, // equivalent to sm
            }}
            theme={{
              palette: {
                primary: {
                  main: colors.purple,
                  contrastText: '#fff',
                },
              },
              typography: {
                fontFamily: 'Inter_400Regular',
                xs: { fontSize: 10 },
                sm: { fontSize: 12 },
                xl: { fontSize: 16 },
              },
            }}
          />
        </View>
      </SafeAreaView>
    </GlowBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
  },
  switcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  switchButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12 - 2,
  },
  switchButtonActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  switchText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: colors.inkMuted,
  },
  switchTextActive: {
    color: colors.purple,
    fontFamily: 'Inter_600SemiBold',
  },
  calendarContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
});

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../lib/firebase';
import { Calendar, ICalendarEventBase } from 'react-native-big-calendar';
import dayjs from 'dayjs';
import weekdayPlugin from 'dayjs/plugin/weekday';
import GlowBackground from '../../components/GlowBackground';
import GlassButton from '../../components/GlassButton';
import { colors, radii } from '../../lib/theme';
import {
  AppSnapshot,
  loadUserAppSnapshot,
  updateClassItem,
  deleteClassItem,
  addParsedClasses,
  type ClassItem,
} from '../../lib/user-app-data';

dayjs.extend(weekdayPlugin);

/* ─── Constants ─── */

const EMPTY_SNAPSHOT: AppSnapshot = {
  localUserId: null,
  displayName: null,
  email: null,
  classes: [],
  tasks: [],
  sessions: [],
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const mapWeekdayToNumber: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

const EVENT_TYPES = [
  { label: 'Class', value: 'class' },
  { label: 'Study', value: 'study' },
  { label: 'Quiz', value: 'quiz' },
  { label: 'Exam', value: 'exam' },
  { label: 'Deadline', value: 'deadline' },
  { label: 'Review', value: 'review' },
];

const RECURRENCE_OPTIONS = [
  { label: 'One-time', value: 'none' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

const EVENT_COLORS: Record<string, string> = {
  class: colors.purple,
  quiz: '#f59e0b',
  exam: colors.danger,
  deadline: colors.danger,
  study: colors.green,
  review: colors.indigo,
  test: '#f59e0b',
};

type CalendarEvent = ICalendarEventBase & {
  classId: number;
  eventType: string;
  recurrence: string;
  location: string | null;
  weekday: string | null;
  rawStartTime: string | null;
  rawEndTime: string | null;
  specificDate: string | null;
};

/* ─── Time helpers ─── */

function to24h(display: string): string {
  const cleaned = display.trim().toUpperCase();
  if (!cleaned.includes('AM') && !cleaned.includes('PM')) {
    const parts = cleaned.split(':');
    const h = parseInt(parts[0] || '0', 10);
    const m = parseInt(parts[1] || '0', 10);
    return `${String(Math.min(23, Math.max(0, h))).padStart(2, '0')}:${String(Math.min(59, Math.max(0, m))).padStart(2, '0')}`;
  }
  const isPM = cleaned.includes('PM');
  const timePart = cleaned.replace(/[APM\s]/g, '');
  const parts = timePart.split(':');
  let h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  if (isPM && h !== 12) h += 12;
  if (!isPM && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(Math.min(59, m)).padStart(2, '0')}`;
}

function to12h(time24: string): string {
  const parts = time24.split(':');
  let h = parseInt(parts[0] || '0', 10);
  const m = parseInt(parts[1] || '0', 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
}

/* ─── Event generation ─── */

function generateCalendarEvents(classes: ClassItem[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const startRange = dayjs().subtract(1, 'month').startOf('month');
  const endRange = dayjs().add(6, 'month').endOf('month');

  for (const cls of classes) {
    if (!cls.startTime || !cls.endTime) continue;

    const recurrence = cls.recurrence || 'weekly';
    const eventType = cls.eventType || 'class';
    const [startH, startM] = cls.startTime.split(':').map(Number);
    const [endH, endM] = cls.endTime.split(':').map(Number);
    if (isNaN(startH) || isNaN(endH)) continue;

    const pushEvent = (day: dayjs.Dayjs) => {
      events.push({
        title: cls.title + (cls.location ? `\n📍 ${cls.location}` : ''),
        start: day.hour(startH).minute(startM || 0).second(0).toDate(),
        end: day.hour(endH).minute(endM || 0).second(0).toDate(),
        classId: cls.id,
        eventType,
        recurrence,
        location: cls.location,
        weekday: cls.weekday,
        rawStartTime: cls.startTime,
        rawEndTime: cls.endTime,
        specificDate: cls.specificDate,
        children: null,
      });
    };

    if (recurrence === 'none') {
      // If specificDate is set, render exactly on that date
      if (cls.specificDate) {
        const target = dayjs(cls.specificDate);
        if (target.isValid() && target.isAfter(startRange) && target.isBefore(endRange)) {
          pushEvent(target);
        }
      } else {
        // Fallback: show in ±2 weeks around today on the matching weekday
        const days = (cls.weekday || '').split(',');
        for (const dayStr of days) {
          const dayIndex = mapWeekdayToNumber[dayStr.trim()];
          if (dayIndex === undefined) continue;
          const today = dayjs();
          let cursor = today.subtract(2, 'week').startOf('week').add(dayIndex, 'day');
          const limit = today.add(2, 'week');
          while (cursor.isBefore(limit)) {
            pushEvent(cursor);
            cursor = cursor.add(1, 'week');
          }
        }
      }
    } else if (recurrence === 'weekly') {
      const days = (cls.weekday || '').split(',');
      for (const dayStr of days) {
        const dayIndex = mapWeekdayToNumber[dayStr.trim()];
        if (dayIndex === undefined) continue;
        let current = startRange.startOf('week').add(dayIndex, 'day');
        if (current.isBefore(startRange)) current = current.add(1, 'week');
        while (current.isBefore(endRange)) {
          pushEvent(current);
          current = current.add(1, 'week');
        }
      }
    } else if (recurrence === 'monthly') {
      const days = (cls.weekday || '').split(',');
      for (const dayStr of days) {
        const dayIndex = mapWeekdayToNumber[dayStr.trim()];
        if (dayIndex === undefined) continue;
        const weekOfMonth = Math.ceil(dayjs().startOf('week').add(dayIndex, 'day').date() / 7);
        let monthCursor = startRange.startOf('month');
        while (monthCursor.isBefore(endRange)) {
          let firstWeekday = monthCursor.startOf('month');
          while (firstWeekday.day() !== dayIndex) firstWeekday = firstWeekday.add(1, 'day');
          const target = firstWeekday.add(weekOfMonth - 1, 'week');
          if (target.isAfter(startRange) && target.isBefore(endRange) && target.month() === monthCursor.month()) {
            pushEvent(target);
          }
          monthCursor = monthCursor.add(1, 'month');
        }
      }
    }
  }
  return events;
}

/* ─── Memoized Calendar ─── */

const MemoCalendar = React.memo(function MemoCalendar({
  events,
  mode,
  currentDate,
  onPressEvent,
}: {
  events: CalendarEvent[];
  mode: 'day' | 'week' | 'month';
  currentDate: Date;
  onPressEvent: (event: ICalendarEventBase) => void;
}) {
  const eventCellStyle = useCallback((event: ICalendarEventBase) => ({
    backgroundColor: EVENT_COLORS[(event as CalendarEvent).eventType] || colors.purple,
    borderRadius: 10,
  }), []);

  const theme = useMemo(() => ({
    palette: { primary: { main: colors.purple, contrastText: '#fff' } },
    typography: {
      fontFamily: 'Inter_400Regular',
      xs: { fontSize: 10 },
      sm: { fontSize: 12 },
      xl: { fontSize: 16 },
    },
  }), []);

  return (
    <Calendar
      events={events}
      height={600}
      mode={mode}
      date={currentDate}
      swipeEnabled={true}
      showTime={true}
      onPressEvent={onPressEvent}
      eventCellStyle={eventCellStyle}
      theme={theme}
    />
  );
});

/* ─── Main Screen ─── */

export default function CalendarScreen() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(EMPTY_SNAPSHOT);
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editRecurrence, setEditRecurrence] = useState('weekly');
  const [editEventType, setEditEventType] = useState('class');
  const [editWeekdays, setEditWeekdays] = useState<string[]>(['Monday']);
  const [editStartTime, setEditStartTime] = useState('9:00 AM');
  const [editEndTime, setEditEndTime] = useState('10:00 AM');
  const [editDate, setEditDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Add modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newEventType, setNewEventType] = useState('class');
  const [newRecurrence, setNewRecurrence] = useState('weekly');
  const [newWeekdays, setNewWeekdays] = useState<string[]>(['Monday']);
  const [newStartTime, setNewStartTime] = useState('9:00 AM');
  const [newEndTime, setNewEndTime] = useState('10:00 AM');
  const [newDate, setNewDate] = useState('');
  const [adding, setAdding] = useState(false);

  const refreshData = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    try {
      const nextSnapshot = await loadUserAppSnapshot(firebaseUser);
      setSnapshot(nextSnapshot);
    } catch (_) {}
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadSnapshot = async () => {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) return;
      try {
        const nextSnapshot = await loadUserAppSnapshot(firebaseUser);
        if (isMounted) setSnapshot(nextSnapshot);
      } catch (_) {}
    };
    const interval = setInterval(loadSnapshot, 5000);
    loadSnapshot();
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  const mappedEvents = useMemo(() => generateCalendarEvents(snapshot.classes), [snapshot.classes]);

  // Navigation
  const navigatePrev = useCallback(() => {
    setCurrentDate(prev => {
      const d = dayjs(prev);
      if (mode === 'month') return d.subtract(1, 'month').toDate();
      if (mode === 'week') return d.subtract(1, 'week').toDate();
      return d.subtract(1, 'day').toDate();
    });
  }, [mode]);

  const navigateNext = useCallback(() => {
    setCurrentDate(prev => {
      const d = dayjs(prev);
      if (mode === 'month') return d.add(1, 'month').toDate();
      if (mode === 'week') return d.add(1, 'week').toDate();
      return d.add(1, 'day').toDate();
    });
  }, [mode]);

  const navigateToday = useCallback(() => setCurrentDate(new Date()), []);

  const dateLabel = useMemo(() => {
    const d = dayjs(currentDate);
    if (mode === 'month') return d.format('MMMM YYYY');
    if (mode === 'week') {
      const start = d.startOf('week');
      const end = d.endOf('week');
      if (start.month() === end.month()) return `${start.format('MMM D')} – ${end.format('D, YYYY')}`;
      return `${start.format('MMM D')} – ${end.format('MMM D, YYYY')}`;
    }
    return d.format('ddd, MMM D YYYY');
  }, [currentDate, mode]);

  // ---- Edit ----
  const handleEventPress = useCallback((event: ICalendarEventBase) => {
    const e = event as CalendarEvent;
    setSelectedEvent(e);
    setEditTitle(e.title.split('\n')[0] || '');
    setEditLocation(e.location || '');
    setEditRecurrence(e.recurrence || 'weekly');
    setEditEventType(e.eventType || 'class');
    setEditWeekdays(e.weekday ? e.weekday.split(',') : ['Monday']);
    setEditStartTime(to12h(e.rawStartTime || '09:00'));
    setEditEndTime(to12h(e.rawEndTime || '10:00'));
    setEditDate(e.specificDate || '');
    setEditModalVisible(true);
  }, []);

  const handleSaveEvent = useCallback(async () => {
    if (!selectedEvent) return;
    setSaving(true);
    try {
      await updateClassItem(selectedEvent.classId, {
        title: editTitle.trim() || undefined,
        location: editLocation.trim() || undefined,
        recurrence: editRecurrence,
        eventType: editEventType,
        weekday: editWeekdays.length > 0 ? editWeekdays.join(',') : 'Monday',
        startTime: to24h(editStartTime),
        endTime: to24h(editEndTime),
        specificDate: editRecurrence === 'none' && editDate ? editDate : null,
      });
      await refreshData();
      setEditModalVisible(false);
    } catch (e) {
      console.error('Failed to update event', e);
    } finally {
      setSaving(false);
    }
  }, [selectedEvent, editTitle, editLocation, editRecurrence, editEventType, editWeekdays, editStartTime, editEndTime, editDate, refreshData]);

  const handleDeleteEvent = useCallback(() => {
    if (!selectedEvent) return;
    Alert.alert('Delete Event', `Remove "${editTitle}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteClassItem(selectedEvent.classId);
            await refreshData();
            setEditModalVisible(false);
          } catch (_) {}
        },
      },
    ]);
  }, [selectedEvent, editTitle, refreshData]);

  // ---- Add ----
  const handleOpenAddModal = useCallback(() => {
    const today = dayjs();
    setNewTitle('');
    setNewLocation('');
    setNewEventType('class');
    setNewRecurrence('weekly');
    setNewWeekdays([WEEKDAYS[today.day()]]);
    setNewStartTime('9:00 AM');
    setNewEndTime('10:00 AM');
    setNewDate(today.format('YYYY-MM-DD'));
    setAddModalVisible(true);
  }, []);

  const handleAddEvent = useCallback(async () => {
    if (!newTitle.trim()) {
      Alert.alert('Title required', 'Please enter a title for the event.');
      return;
    }
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    setAdding(true);
    try {
      const isOneTime = newRecurrence === 'none';
      const weekdaysToSave = isOneTime
        ? (newDate ? WEEKDAYS[dayjs(newDate).day()] : newWeekdays[0] || 'Monday')
        : (newWeekdays.length > 0 ? newWeekdays.join(',') : 'Monday');

      const entry = {
        title: newTitle.trim(),
        weekday: weekdaysToSave,
        startTime: to24h(newStartTime),
        endTime: to24h(newEndTime),
        location: newLocation.trim() || undefined,
        eventType: newEventType,
        recurrence: newRecurrence,
        specificDate: isOneTime ? (newDate || undefined) : undefined,
      };

      await addParsedClasses(firebaseUser, [entry]);
      await refreshData();
      setAddModalVisible(false);
    } catch (e) {
      console.error('Failed to add event', e);
    } finally {
      setAdding(false);
    }
  }, [newTitle, newWeekdays, newStartTime, newEndTime, newLocation, newEventType, newRecurrence, newDate, refreshData]);

  return (
    <GlowBackground>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>

        {/* ─── Header Row 1: Title + Switcher + Add ─── */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Calendar</Text>
          <View style={styles.headerRight}>
            <View style={styles.switcher}>
              {(['month', 'week', 'day'] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMode(m)}
                  style={[styles.switchBtn, mode === m && styles.switchBtnActive]}
                >
                  <Text style={[styles.switchText, mode === m && styles.switchTextActive]}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={handleOpenAddModal} style={styles.addBtn} activeOpacity={0.7}>
              <Ionicons name="add" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Header Row 2: Navigation ─── */}
        <View style={styles.navRow}>
          <TouchableOpacity onPress={navigatePrev} style={styles.navArrow} activeOpacity={0.6}>
            <Ionicons name="chevron-back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <TouchableOpacity onPress={navigateToday} activeOpacity={0.6}>
            <Text style={styles.navLabel}>{dateLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={navigateNext} style={styles.navArrow} activeOpacity={0.6}>
            <Ionicons name="chevron-forward" size={20} color={colors.ink} />
          </TouchableOpacity>
        </View>

        {/* ─── Legend ─── */}
        <View style={styles.legendRow}>
          {[
            { label: 'Class', color: colors.purple },
            { label: 'Quiz', color: '#f59e0b' },
            { label: 'Exam', color: colors.danger },
            { label: 'Study', color: colors.green },
          ].map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* ─── Calendar ─── */}
        <View style={styles.calendarContainer}>
          <MemoCalendar
            events={mappedEvents}
            mode={mode}
            currentDate={currentDate}
            onPressEvent={handleEventPress}
          />
        </View>
      </SafeAreaView>

      {/* ─── Edit Event Modal ─── */}
      <EventFormModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        modalTitle="Edit Event"
        icon="calendar-outline"
        eventType={editEventType}
        onChangeEventType={setEditEventType}
        eventTitle={editTitle}
        onChangeTitle={setEditTitle}
        location={editLocation}
        onChangeLocation={setEditLocation}
        weekdays={editWeekdays}
        onChangeWeekdays={setEditWeekdays}
        startTime={editStartTime}
        onChangeStartTime={setEditStartTime}
        endTime={editEndTime}
        onChangeEndTime={setEditEndTime}
        recurrence={editRecurrence}
        onChangeRecurrence={setEditRecurrence}
        date={editDate}
        onChangeDate={setEditDate}
        submitLabel="Save Changes"
        onSubmit={handleSaveEvent}
        loading={saving}
        onDelete={handleDeleteEvent}
      />

      {/* ─── Add Event Modal ─── */}
      <EventFormModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        modalTitle="Add Event"
        icon="add-circle-outline"
        eventType={newEventType}
        onChangeEventType={(v) => {
          setNewEventType(v);
          setNewRecurrence(v === 'class' ? 'weekly' : 'none');
        }}
        eventTitle={newTitle}
        onChangeTitle={setNewTitle}
        location={newLocation}
        onChangeLocation={setNewLocation}
        weekdays={newWeekdays}
        onChangeWeekdays={setNewWeekdays}
        startTime={newStartTime}
        onChangeStartTime={setNewStartTime}
        endTime={newEndTime}
        onChangeEndTime={setNewEndTime}
        recurrence={newRecurrence}
        onChangeRecurrence={setNewRecurrence}
        date={newDate}
        onChangeDate={setNewDate}
        submitLabel="Add to Calendar"
        onSubmit={handleAddEvent}
        loading={adding}
      />
    </GlowBackground>
  );
}

/* ─── Shared Event Form Modal ─── */

type EventFormModalProps = {
  visible: boolean;
  onClose: () => void;
  modalTitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  eventType: string;
  onChangeEventType: (v: string) => void;
  eventTitle: string;
  onChangeTitle: (v: string) => void;
  location: string;
  onChangeLocation: (v: string) => void;
  weekdays: string[];
  onChangeWeekdays: (v: string[]) => void;
  startTime: string;
  onChangeStartTime: (v: string) => void;
  endTime: string;
  onChangeEndTime: (v: string) => void;
  recurrence: string;
  onChangeRecurrence: (v: string) => void;
  date: string;
  onChangeDate: (v: string) => void;
  submitLabel: string;
  onSubmit: () => void;
  loading: boolean;
  onDelete?: () => void;
};

function EventFormModal(props: EventFormModalProps) {
  const {
    visible, onClose, modalTitle, icon,
    eventType, onChangeEventType,
    eventTitle, onChangeTitle,
    location, onChangeLocation,
    weekdays, onChangeWeekdays,
    startTime, onChangeStartTime,
    endTime, onChangeEndTime,
    recurrence, onChangeRecurrence,
    date, onChangeDate,
    submitLabel, onSubmit, loading, onDelete,
  } = props;

  const accent = EVENT_COLORS[eventType] || colors.purple;
  const isOneTime = recurrence === 'none';

  const toggleWeekday = useCallback((day: string) => {
    onChangeWeekdays(
      weekdays.includes(day)
        ? weekdays.filter(d => d !== day).length > 0 ? weekdays.filter(d => d !== day) : weekdays
        : [...weekdays, day]
    );
  }, [weekdays, onChangeWeekdays]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={fStyles.overlay} onPress={onClose}>
        <Pressable style={fStyles.sheet} onPress={(e) => e.stopPropagation()}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled">
            <View style={fStyles.handleBar} />

            {/* Header */}
            <View style={fStyles.header}>
              <View style={[fStyles.headerIcon, { backgroundColor: `${accent}1A` }]}>
                <Ionicons name={icon} size={22} color={accent} />
              </View>
              <Text style={fStyles.headerTitle}>{modalTitle}</Text>
              <TouchableOpacity onPress={onClose} style={fStyles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.inkMuted} />
              </TouchableOpacity>
            </View>

            {/* Type */}
            <Text style={fStyles.label}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={fStyles.chipRow}>
                {EVENT_TYPES.map((t) => {
                  const sel = eventType === t.value;
                  const c = EVENT_COLORS[t.value] || colors.purple;
                  return (
                    <TouchableOpacity
                      key={t.value}
                      onPress={() => onChangeEventType(t.value)}
                      activeOpacity={0.7}
                      style={[fStyles.chip, sel && { backgroundColor: c, borderColor: c }]}
                    >
                      <Text style={[fStyles.chipText, sel && fStyles.chipTextSel]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Title */}
            <Text style={fStyles.label}>Title</Text>
            <TextInput
              style={fStyles.input}
              value={eventTitle}
              onChangeText={onChangeTitle}
              placeholder="e.g. Math Chapter 5"
              placeholderTextColor="rgba(0,0,0,0.2)"
            />

            {/* Location */}
            <Text style={fStyles.label}>Location</Text>
            <TextInput
              style={fStyles.input}
              value={location}
              onChangeText={onChangeLocation}
              placeholder="Optional"
              placeholderTextColor="rgba(0,0,0,0.2)"
            />

            {/* Recurrence — placed before date/day so user's choice controls what shows */}
            <Text style={fStyles.label}>Recurrence</Text>
            <View style={fStyles.chipRow}>
              {RECURRENCE_OPTIONS.map((opt) => {
                const sel = recurrence === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => onChangeRecurrence(opt.value)}
                    activeOpacity={0.7}
                    style={[fStyles.chip, sel && fStyles.chipSelected]}
                  >
                    <Text style={[fStyles.chipText, sel && fStyles.chipTextSel]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Date (for one-time events) */}
            {isOneTime && (
              <>
                <Text style={fStyles.label}>Date</Text>
                <TextInput
                  style={fStyles.input}
                  value={date}
                  onChangeText={onChangeDate}
                  placeholder="YYYY-MM-DD (e.g. 2026-04-05)"
                  placeholderTextColor="rgba(0,0,0,0.2)"
                  keyboardType="numbers-and-punctuation"
                />
                {date ? (
                  <Text style={fStyles.dateHint}>
                    {dayjs(date).isValid() ? dayjs(date).format('dddd, MMMM D, YYYY') : 'Invalid date'}
                  </Text>
                ) : null}
              </>
            )}

            {/* Weekday (for recurring events — multi-select) */}
            {!isOneTime && (
              <>
                <Text style={fStyles.label}>Days</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={fStyles.chipRow}>
                    {WEEKDAYS.map((d, i) => {
                      const sel = weekdays.includes(d);
                      return (
                        <TouchableOpacity
                          key={d}
                          onPress={() => toggleWeekday(d)}
                          activeOpacity={0.7}
                          style={[fStyles.chip, sel && fStyles.chipSelected]}
                        >
                          <Text style={[fStyles.chipText, sel && fStyles.chipTextSel]}>{WEEKDAYS_SHORT[i]}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
                {weekdays.length > 1 && (
                  <Text style={fStyles.dateHint}>
                    Event will recur on these days
                  </Text>
                )}
              </>
            )}

            {/* Time */}
            <View style={fStyles.timeRow}>
              <View style={fStyles.timeField}>
                <Text style={fStyles.label}>Start Time</Text>
                <TextInput
                  style={fStyles.input}
                  value={startTime}
                  onChangeText={onChangeStartTime}
                  placeholder="9:00 AM"
                  placeholderTextColor="rgba(0,0,0,0.2)"
                  autoCapitalize="characters"
                />
              </View>
              <View style={fStyles.timeSep}>
                <Text style={fStyles.timeDash}>→</Text>
              </View>
              <View style={fStyles.timeField}>
                <Text style={fStyles.label}>End Time</Text>
                <TextInput
                  style={fStyles.input}
                  value={endTime}
                  onChangeText={onChangeEndTime}
                  placeholder="10:00 AM"
                  placeholderTextColor="rgba(0,0,0,0.2)"
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* Actions */}
            <View style={fStyles.actions}>
              <GlassButton label={submitLabel} onPress={onSubmit} loading={loading} />
              {onDelete ? (
                <TouchableOpacity onPress={onDelete} style={fStyles.deleteRow}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={fStyles.deleteText}>Delete Event</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={onClose} style={fStyles.cancelRow}>
                  <Text style={fStyles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ─── Styles ─── */

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const fStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.pageTop,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: SCREEN_HEIGHT * 0.84,
  },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.12)', alignSelf: 'center', marginTop: 12, marginBottom: 18 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  headerIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.ink },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontFamily: 'Inter_700Bold', color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    color: colors.ink,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  chipRow: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  chipSelected: { backgroundColor: colors.purple, borderColor: colors.purple },
  chipText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: colors.ink },
  chipTextSel: { color: colors.white },
  dateHint: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.inkMuted, marginTop: 6 },
  timeRow: { flexDirection: 'row', alignItems: 'flex-end' },
  timeField: { flex: 1 },
  timeSep: { paddingBottom: 14, paddingHorizontal: 6 },
  timeDash: { fontSize: 16, color: colors.inkMuted, fontFamily: 'Inter_500Medium' },
  actions: { marginTop: 24, marginBottom: 8 },
  deleteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, marginTop: 4 },
  deleteText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.danger },
  cancelRow: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  cancelText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.inkMuted },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: colors.ink, fontSize: 28, fontFamily: 'Inter_700Bold' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.purple,
    alignItems: 'center', justifyContent: 'center',
  },
  switcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16, padding: 2,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  switchBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  switchBtnActive: {
    backgroundColor: colors.white,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  switchText: { fontSize: 13, fontFamily: 'Inter_500Medium', color: colors.inkMuted },
  switchTextActive: { color: colors.purple, fontFamily: 'Inter_600SemiBold' },

  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  navArrow: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  navLabel: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: colors.ink,
  },

  legendRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 14,
    marginBottom: 6,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: 'Inter_500Medium', color: colors.inkMuted },

  calendarContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    overflow: 'hidden',
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    marginBottom: 110, // keep calendar above the floating tab bar
  },
});

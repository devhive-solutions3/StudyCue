import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();

  const handleCuePress = () => {
    // Navigate to Chat tab or show quick suggestion
    router.navigate('/(tabs)/chat');
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Good evening, Maria 👋</Text>
        <Text style={styles.date}>Wednesday, October 25</Text>
      </View>

      <TouchableOpacity style={styles.cueButton} onPress={handleCuePress}>
        <View style={styles.cueContent}>
          <Ionicons name="sparkles" size={24} color="#0f172a" />
          <Text style={styles.cueText}>What should I do now?</Text>
        </View>
        <Text style={styles.cueSubtext}>Tap to get a smart study suggestion</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Overview</Text>
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cardsRow}>
        <View style={styles.card}>
          <Ionicons name="book" size={24} color="#4ade80" />
          <Text style={styles.cardValue}>2</Text>
          <Text style={styles.cardLabel}>Classes Today</Text>
        </View>
        
        <View style={styles.card}>
          <Ionicons name="warning" size={24} color="#f59e0b" />
          <Text style={styles.cardValue}>Physics</Text>
          <Text style={styles.cardLabel}>Next Exam (Fri)</Text>
        </View>

        <View style={styles.card}>
          <Ionicons name="list" size={24} color="#10b981" />
          <Text style={styles.cardValue}>4</Text>
          <Text style={styles.cardLabel}>Pending Tasks</Text>
        </View>
      </ScrollView>

      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <View style={styles.activityBox}>
        <Text style={styles.activityText}>You completed 45 mins of Physics review.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 48,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  date: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 4,
  },
  cueButton: {
    backgroundColor: '#4ade80',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 32,
    elevation: 4,
    shadowColor: '#4ade80',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  cueContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cueText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginLeft: 12,
  },
  cueSubtext: {
    fontSize: 14,
    color: '#0f172a',
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 16,
  },
  cardsRow: {
    flexDirection: 'row',
    marginBottom: 32,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    width: 140,
    marginRight: 16,
    justifyContent: 'center',
  },
  cardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 12,
    marginBottom: 4,
  },
  cardLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  activityBox: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  activityText: {
    color: '#cbd5e1',
    fontSize: 16,
  },
});

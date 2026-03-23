import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Wait for auth listener to redirect
    } catch (e) {
      console.error('Logout error', e);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#f8fafc', fontSize: 24, marginBottom: 32 },
  logoutButton: { backgroundColor: '#ef4444', padding: 16, borderRadius: 8 },
  logoutText: { color: '#fff', fontWeight: 'bold' }
});

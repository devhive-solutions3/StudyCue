import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { onAuthStateChanged, User } from '@firebase/auth';
import { auth } from '../lib/firebase';
import { initDatabase } from '../lib/db';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

// Keep native splash visible until app is ready.
void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    const setupDB = async () => {
      try {
        await initDatabase();
        console.log('Database initialized successfully');
      } catch (e) {
        console.error('Failed to initialize local database:', e);
      }
    };

    setupDB();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setInitializing(false);
    });

    return unsubscribe;
  }, []);

  const appReady = !initializing && fontsLoaded;

  useEffect(() => {
    if (!appReady) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [appReady, user, segments, router]);

  useEffect(() => {
    if (!appReady) return;
    void SplashScreen.hideAsync().catch(() => {});
  }, [appReady]);

  if (!appReady) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        presentation: 'card',
        animationDuration: 220,
      }}
    />
  );
}

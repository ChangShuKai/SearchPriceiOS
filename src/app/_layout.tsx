import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { startBackgroundSync } from '@/lib/sync';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    startBackgroundSync();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="product/[barcode]"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 32,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}

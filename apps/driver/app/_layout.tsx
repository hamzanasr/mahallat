import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LanguageProvider } from "../context/LanguageContext";
import { DriverAuthProvider } from "../context/DriverAuthContext";
import { DriverProvider } from "../context/DriverContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <DriverAuthProvider>
          <DriverProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false, presentation: "modal" }} />
              <Stack.Screen name="task/[id]" options={{ headerShown: false }} />
            </Stack>
          </DriverProvider>
        </DriverAuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

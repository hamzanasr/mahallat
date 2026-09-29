import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LanguageProvider } from "../context/LanguageContext";
import { CustomerAuthProvider } from "../context/CustomerAuthContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <CustomerAuthProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="auth"
              options={{
                presentation: "modal",
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="terms"
              options={{
                presentation: "modal",
                headerShown: false,
              }}
            />
          </Stack>
        </CustomerAuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LanguageProvider } from "../context/LanguageContext";
import { CustomerAuthProvider } from "../context/CustomerAuthContext";
import { AddressProvider } from "../context/AddressContext";
import { CartProvider } from "../context/CartContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <CustomerAuthProvider>
          <AddressProvider>
            <CartProvider>
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
                <Stack.Screen
                  name="address/index"
                  options={{
                    presentation: "card",
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="address/new"
                  options={{
                    presentation: "card",
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="address/select"
                  options={{
                    presentation: "modal",
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="store/[id]"
                  options={{
                    presentation: "card",
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="cart"
                  options={{
                    presentation: "card",
                    headerShown: false,
                  }}
                />
              </Stack>
            </CartProvider>
          </AddressProvider>
        </CustomerAuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

import React from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from "react-native";
import { useLanguage } from "../../context/LanguageContext";

export interface LoadingStateProps {
  message?: string;
  style?: StyleProp<ViewStyle>;
}

export function LoadingState({ message, style }: LoadingStateProps) {
  const { t } = useLanguage();
  const displayMessage = message || t.customer?.ui?.loading || t.common.loading;

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size="large" color="#0284C7" />
      {displayMessage && <Text style={styles.message}>{displayMessage}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748B",
  },
});

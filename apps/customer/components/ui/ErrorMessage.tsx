import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./Button";
import { useLanguage } from "../../context/LanguageContext";

export interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  retryTitle?: string;
  style?: StyleProp<ViewStyle>;
}

export function ErrorMessage({
  message,
  onRetry,
  retryTitle,
  style,
}: ErrorMessageProps) {
  const { t, isRTL } = useLanguage();
  const retryText = retryTitle || t.customer?.ui?.retry || "إعادة المحاولة";

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.row,
          { flexDirection: isRTL ? "row-reverse" : "row" },
        ]}
      >
        <Ionicons name="alert-circle" size={24} color="#DC2626" />
        <Text
          style={[
            styles.messageText,
            { textAlign: isRTL ? "right" : "left" },
          ]}
        >
          {message}
        </Text>
      </View>
      {onRetry && (
        <Button
          title={retryText}
          onPress={onRetry}
          variant="outline"
          style={styles.retryButton}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
    padding: 16,
    marginVertical: 8,
  },
  row: {
    alignItems: "center",
    gap: 10,
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    color: "#991B1B",
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 12,
    alignSelf: "flex-end",
    borderColor: "#FCA5A5",
  },
});

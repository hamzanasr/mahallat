import React from "react";
import { View, Text, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "./Button";
import { useLanguage } from "../../context/LanguageContext";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  iconName?: keyof typeof Ionicons.glyphMap;
  actionTitle?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  title,
  description,
  icon,
  iconName = "cube-outline",
  actionTitle,
  onAction,
  style,
}: EmptyStateProps) {
  const { isRTL } = useLanguage();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconCircle}>
        {icon || <Ionicons name={iconName} size={40} color="#94A3B8" />}
      </View>
      <Text style={[styles.title, { textAlign: isRTL ? "right" : "left" }]}>
        {title}
      </Text>
      {description && (
        <Text style={[styles.description, { textAlign: "center" }]}>
          {description}
        </Text>
      )}
      {actionTitle && onAction && (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="outline"
          style={styles.actionButton}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 22,
    maxWidth: 300,
    marginBottom: 20,
    textAlign: "center",
  },
  actionButton: {
    minWidth: 140,
  },
});

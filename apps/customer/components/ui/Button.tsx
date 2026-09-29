import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
} from "react-native";
import { useLanguage } from "../../context/LanguageContext";

export interface ButtonProps {
  title?: string;
  children?: React.ReactNode;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function Button({
  title,
  children,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const { isRTL } = useLanguage();

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case "secondary":
        return styles.secondaryButton;
      case "outline":
        return styles.outlineButton;
      case "ghost":
        return styles.ghostButton;
      case "danger":
        return styles.dangerButton;
      case "primary":
      default:
        return styles.primaryButton;
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case "secondary":
        return styles.secondaryText;
      case "outline":
        return styles.outlineText;
      case "ghost":
        return styles.ghostText;
      case "danger":
        return styles.dangerText;
      case "primary":
      default:
        return styles.primaryText;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.baseButton,
        getVariantStyle(),
        disabled && styles.disabledButton,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" || variant === "danger" ? "#FFFFFF" : "#2563EB"}
        />
      ) : (
        <View
          style={[
            styles.contentContainer,
            { flexDirection: isRTL ? "row-reverse" : "row" },
          ]}
        >
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          {title ? (
            <Text
              style={[
                styles.baseText,
                getTextStyle(),
                disabled && styles.disabledText,
                textStyle,
              ]}
            >
              {title}
            </Text>
          ) : (
            children
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  baseButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  contentContainer: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  baseText: {
    fontSize: 15,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#0284C7", // الأزرق الأساسي
  },
  primaryText: {
    color: "#FFFFFF",
  },
  secondaryButton: {
    backgroundColor: "#F1F5F9",
  },
  secondaryText: {
    color: "#0F172A",
  },
  outlineButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  outlineText: {
    color: "#0F172A",
  },
  ghostButton: {
    backgroundColor: "transparent",
  },
  ghostText: {
    color: "#0284C7",
  },
  dangerButton: {
    backgroundColor: "#DC2626",
  },
  dangerText: {
    color: "#FFFFFF",
  },
  disabledButton: {
    backgroundColor: "#E2E8F0",
    borderColor: "#CBD5E1",
  },
  disabledText: {
    color: "#94A3B8",
  },
});

import React from "react";
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
} from "react-native";
import { useLanguage } from "../../context/LanguageContext";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

export function Input({
  label,
  error,
  helperText,
  containerStyle,
  inputStyle,
  style,
  ...rest
}: InputProps) {
  const { isRTL } = useLanguage();

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={[
            styles.label,
            { textAlign: isRTL ? "right" : "left" },
          ]}
        >
          {label}
        </Text>
      )}

      <TextInput
        style={[
          styles.input,
          { textAlign: isRTL ? "right" : "left" },
          error ? styles.inputError : null,
          inputStyle,
          style,
        ]}
        placeholderTextColor="#94A3B8"
        {...rest}
      />

      {error ? (
        <Text
          style={[
            styles.errorText,
            { textAlign: isRTL ? "right" : "left" },
          ]}
        >
          {error}
        </Text>
      ) : helperText ? (
        <Text
          style={[
            styles.helperText,
            { textAlign: isRTL ? "right" : "left" },
          ]}
        >
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0F172A",
    minHeight: 44,
  },
  inputError: {
    borderColor: "#EF4444",
  },
  errorText: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
});

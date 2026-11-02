import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ORANGE, useTheme } from './theme';

export function useStyles(factory) {
  const { c } = useTheme();
  return React.useMemo(() => StyleSheet.create(factory(c)), [c, factory]);
}

const base = (c) => ({
  btn: { backgroundColor: ORANGE, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  btn2: { backgroundColor: c.panel, borderWidth: 1, borderColor: c.line },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnText2: { color: c.text },
  disabled: { opacity: 0.5 },
  chip: { borderWidth: 1, borderColor: c.line, backgroundColor: c.panel, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  chipOn: { backgroundColor: ORANGE, borderColor: ORANGE },
  chipText: { color: c.text, fontWeight: '700', fontSize: 13 },
  panel: { backgroundColor: c.panel, borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 15 },
  thumb: { backgroundColor: c.soft, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});

export function Button({ label, icon, onPress, secondary, disabled, loading, style }) {
  const s = useStyles(base);
  const { c } = useTheme();
  const color = secondary ? c.text : '#fff';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={[s.btn, secondary && s.btn2, (disabled || loading) && s.disabled, style]}
    >
      {loading ? <ActivityIndicator color={color} /> : icon ? <Ionicons name={icon} size={18} color={color} /> : null}
      <Text style={[s.btnText, secondary && s.btnText2]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Chip({ label, on, onPress }) {
  const s = useStyles(base);
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: !!on }}>
      <Text style={[s.chipText, on && { color: '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Panel({ style, children }) {
  const s = useStyles(base);
  return <View style={[s.panel, style]}>{children}</View>;
}

export function CardImage({ uri, width, style }) {
  const s = useStyles(base);
  const height = Math.round(width * (88 / 63));
  return uri ? (
    <Image source={{ uri }} style={[s.thumb, { width, height }, style]} resizeMode="contain" />
  ) : (
    <View style={[s.thumb, { width, height }, style]}>
      <Text style={{ fontSize: width / 3 }}>🎴</Text>
    </View>
  );
}

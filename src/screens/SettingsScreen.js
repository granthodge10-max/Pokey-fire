import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Switch, Text, View } from 'react-native';
import { api, API_URL } from '../api';
import { ORANGE } from '../theme';
import { Button, Panel, useStyles } from '../ui';

const styles = (c) => ({
  page: { padding: 16, paddingBottom: 40, gap: 14 },
  h1: { color: c.text, fontSize: 24, fontWeight: '900' },
  h2: { color: c.text, fontSize: 17, fontWeight: '800', marginBottom: 6 },
  text: { color: c.text, fontSize: 15 },
  muted: { color: c.muted, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});

function confirm(title, message, onYes) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: 'OK', style: 'destructive', onPress: onYes }]);
}

export default function SettingsScreen({ name, dark, onToggleTheme, priv, onTogglePrivate, onClearCollection, onSignOut }) {
  const s = useStyles(styles);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.health().then(setHealth, (e) => setHealth({ error: e.message }));
  }, []);

  return (
    <ScrollView contentContainerStyle={s.page}>
      <Text style={s.h1}>Settings</Text>
      <Panel>
        <Text style={s.h2}>Profile</Text>
        <Text style={s.text}>@{name}</Text>
        <Text style={s.muted}>Your collection is saved on this device. Accounts and cloud sync are coming later.</Text>
      </Panel>
      <Panel style={{ gap: 12 }}>
        <View style={s.row}>
          <Text style={[s.text, { flex: 1 }]}>Dark mode</Text>
          <Switch value={dark} onValueChange={onToggleTheme} trackColor={{ true: ORANGE }} />
        </View>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.text}>Keep my collection private</Text>
            <Text style={s.muted}>Applies once public profiles launch.</Text>
          </View>
          <Switch value={priv} onValueChange={onTogglePrivate} trackColor={{ true: ORANGE }} />
        </View>
      </Panel>
      <Panel>
        <Text style={s.h2}>Server</Text>
        <Text style={s.muted}>{API_URL}</Text>
        <Text style={s.text}>
          {!health ? 'Checking…' : health.error ? `⚠ ${health.error}` : `✓ Connected · card recognition ${health.identify ? `on (${health.provider === 'xai' ? 'xAI Grok' : 'Claude'})` : 'off (no API key on server)'}`}
        </Text>
      </Panel>
      <Panel style={{ gap: 8 }}>
        <Text style={s.h2}>About prices</Text>
        <Text style={s.muted}>
          Values are TCGplayer market prices for ungraded Near Mint copies, via the TCGdex card database. Real sale prices vary with condition and grading.
        </Text>
        <Text style={s.muted}>Planned subscription: $2/week. Checkout is not connected; no charges occur.</Text>
      </Panel>
      <Button secondary icon="trash-outline" label="Clear collection" onPress={() => confirm('Clear collection?', 'This removes every card saved on this device.', onClearCollection)} />
      <Button secondary icon="log-out-outline" label="Sign out" onPress={() => confirm('Sign out?', 'Your collection stays saved on this device.', onSignOut)} />
      <Text style={[s.muted, { textAlign: 'center' }]}>Pokey Fire is not affiliated with Pokémon, Nintendo, Creatures or GAME FREAK.</Text>
    </ScrollView>
  );
}

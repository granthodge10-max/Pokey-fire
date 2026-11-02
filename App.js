import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { api } from './src/api';
import CardDetail from './src/CardDetail';
import { addToCollection, loadState, refreshPrices, saveState } from './src/collection';
import CollectionScreen from './src/screens/CollectionScreen';
import ScanScreen from './src/screens/ScanScreen';
import SearchScreen from './src/screens/SearchScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { ORANGE, palettes, ThemeContext } from './src/theme';
import { Button, Panel, useStyles } from './src/ui';

const TABS = [
  { key: 'collection', label: 'Collection', icon: 'albums' },
  { key: 'scan', label: 'Scan', icon: 'scan' },
  { key: 'search', label: 'Search', icon: 'search' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

const styles = (c) => ({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: c.line },
  brand: { fontSize: 22, fontWeight: '900', color: c.text },
  body: { flex: 1, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderColor: c.line, backgroundColor: c.bg },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2 },
  tabLabel: { fontSize: 11, fontWeight: '700' },
  toast: { position: 'absolute', left: 16, right: 16, bottom: 76, backgroundColor: c.text, borderRadius: 12, padding: 12, alignItems: 'center' },
  toastText: { color: c.bg, fontWeight: '700' },
  page: { padding: 16, gap: 14, maxWidth: 520, width: '100%', alignSelf: 'center' },
  hero: { backgroundColor: c.soft, borderWidth: 1, borderColor: c.line, borderRadius: 18, padding: 20, gap: 6 },
  h1: { fontSize: 30, fontWeight: '900', color: c.text },
  h2: { fontSize: 19, fontWeight: '800', color: c.text, marginBottom: 8 },
  muted: { fontSize: 13, color: c.muted, lineHeight: 19 },
  input: { borderWidth: 1, borderColor: c.line, backgroundColor: c.bg, color: c.text, padding: 12, borderRadius: 10, marginBottom: 10, fontSize: 16 },
});

function Welcome({ onStart }) {
  const s = useStyles(styles);
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const start = () => {
    const n = name.trim().replace(/^@/, '');
    if (n.length < 3) setError('Use at least 3 characters.');
    else onStart(n);
  };
  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <View style={s.hero}>
        <Text style={{ fontSize: 40 }}>🔥🎴</Text>
        <Text style={s.h1}>Scan it. Know what it’s worth.</Text>
        <Text style={s.muted}>Point your camera at a Pokémon card to identify it, see its market price and add it to your digital collection.</Text>
      </View>
      <Panel>
        <Text style={s.h2}>Get started</Text>
        <TextInput value={name} onChangeText={setName} onSubmitEditing={start} placeholder="Choose a username" placeholderTextColor="#999" autoCapitalize="none" style={s.input} />
        {error ? <Text style={[s.muted, { color: ORANGE, marginBottom: 8 }]}>{error}</Text> : null}
        <Button label="Enter Pokey Fire" onPress={start} />
        <Text style={[s.muted, { marginTop: 8 }]}>Your collection is stored on this device. Secure accounts are coming later.</Text>
      </Panel>
    </ScrollView>
  );
}

function Shell({ state, update }) {
  const s = useStyles(styles);
  const { c, dark } = React.useContext(ThemeContext);
  const [tab, setTab] = useState(state.items.length ? 'collection' : 'scan');
  const [detail, setDetail] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const add = useCallback(
    (card, variantKey) => {
      update((st) => ({ ...st, items: addToCollection(st.items, card, variantKey) }));
      notify(`Added ${card.name} to your collection`);
    },
    [update, notify],
  );

  const updateItem = (item) => {
    update((st) => ({ ...st, items: st.items.map((i) => (i.id === item.id ? item : i)) }));
    setDetail((d) => (d?.item ? { ...d, item } : d));
  };
  const removeItem = (item) => {
    update((st) => ({ ...st, items: st.items.filter((i) => i.id !== item.id) }));
    setDetail(null);
    notify(`Removed ${item.name}`);
  };

  async function refresh() {
    setRefreshing(true);
    try {
      const { items, failed } = await refreshPrices(state.items, api.card);
      update((st) => ({ ...st, items, lastRefresh: new Date().toISOString() }));
      notify(failed ? `Updated prices (${failed} couldn’t be reached)` : 'Prices updated');
    } catch (e) {
      notify(e.message);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={s.header}>
        <Text style={s.brand}>🔥 Pokey Fire</Text>
        <TouchableOpacity onPress={() => update((st) => ({ ...st, theme: dark ? 'light' : 'dark' }))} accessibilityLabel="Toggle dark mode">
          <Ionicons name={dark ? 'sunny-outline' : 'moon-outline'} size={22} color={c.text} />
        </TouchableOpacity>
      </View>
      <View style={s.body}>
        {tab === 'collection' && (
          <CollectionScreen
            name={state.name}
            items={state.items}
            lastRefresh={state.lastRefresh}
            refreshing={refreshing}
            onRefresh={refresh}
            onOpenItem={(item) => setDetail({ item, cardId: item.cardId })}
            onScan={() => setTab('scan')}
          />
        )}
        {tab === 'scan' && (
          <ScanScreen onAdd={add} onOpenCard={(card, finishHint) => setDetail({ card, finishHint })} onSearchInstead={() => setTab('search')} />
        )}
        {tab === 'search' && <SearchScreen onOpenCard={(cardId) => setDetail({ cardId })} />}
        {tab === 'settings' && (
          <SettingsScreen
            name={state.name}
            dark={dark}
            onToggleTheme={() => update((st) => ({ ...st, theme: dark ? 'light' : 'dark' }))}
            priv={!!state.priv}
            onTogglePrivate={(v) => update((st) => ({ ...st, priv: v }))}
            onClearCollection={() => update((st) => ({ ...st, items: [], lastRefresh: null }))}
            onSignOut={() => update((st) => ({ ...st, name: '' }))}
          />
        )}
      </View>
      {toast ? (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      ) : null}
      <View style={s.tabs}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={s.tab} onPress={() => setTab(t.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Ionicons name={on ? t.icon : `${t.icon}-outline`} size={22} color={on ? ORANGE : c.muted} />
              <Text style={[s.tabLabel, { color: on ? ORANGE : c.muted }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {detail ? (
        <CardDetail
          key={detail.item?.id || detail.cardId || detail.card?.id}
          {...detail}
          onAdd={(card, variantKey) => {
            add(card, variantKey);
            setDetail(null);
          }}
          onUpdateItem={updateItem}
          onRemoveItem={removeItem}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

export default function App() {
  const [state, setState] = useState(null);

  useEffect(() => {
    loadState().then((saved) => setState({ theme: 'light', name: '', items: [], priv: false, lastRefresh: null, ...saved }));
  }, []);
  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  const dark = state?.theme === 'dark';
  const theme = React.useMemo(() => ({ c: dark ? palettes.dark : palettes.light, dark }), [dark]);

  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={theme}>
        {!state ? (
          <View style={{ flex: 1, backgroundColor: theme.c.bg }} />
        ) : state.name ? (
          <Shell state={state} update={setState} />
        ) : (
          <SafeAreaView style={{ flex: 1, backgroundColor: theme.c.bg }}>
            <Welcome onStart={(name) => setState((st) => ({ ...st, name }))} />
          </SafeAreaView>
        )}
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}

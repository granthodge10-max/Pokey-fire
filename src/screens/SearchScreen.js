import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../api';
import { ORANGE, useTheme } from '../theme';
import { CardImage, useStyles } from '../ui';

const styles = (c) => ({
  wrap: { flex: 1 },
  head: { padding: 16, paddingBottom: 8, gap: 6 },
  h1: { color: c.text, fontSize: 24, fontWeight: '900' },
  muted: { color: c.muted, fontSize: 13, lineHeight: 19 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: c.line, backgroundColor: c.panel, borderRadius: 12, paddingHorizontal: 12, marginTop: 6 },
  input: { flex: 1, color: c.text, paddingVertical: 12, fontSize: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: c.line },
  name: { color: c.text, fontWeight: '800', fontSize: 15 },
  error: { color: c.bad, padding: 16 },
});

export default function SearchScreen({ onOpenCard, autoFocus }) {
  const s = useStyles(styles);
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Debounced search-as-you-type; ignore responses for stale queries.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.search(query);
        if (live) {
          setResults(r);
          setError(null);
        }
      } catch (e) {
        if (live) setError(e.message);
      } finally {
        if (live) setLoading(false);
      }
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Text style={s.h1}>Find a card</Text>
        <Text style={s.muted}>Search by name, and add the collector number to narrow it down, e.g. “Charizard 4” or “Pikachu ex 238/191”.</Text>
        <View style={s.inputRow}>
          <Ionicons name="search" size={18} color={c.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Card name and number"
            placeholderTextColor={c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus={autoFocus}
            returnKeyType="search"
            style={s.input}
          />
          {loading ? <ActivityIndicator color={ORANGE} /> : null}
        </View>
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <FlatList
        data={results}
        keyExtractor={(x) => x.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={q.trim().length >= 2 && !loading && !error ? <Text style={[s.muted, { padding: 16 }]}>No cards found. Check the spelling or drop the number.</Text> : null}
        renderItem={({ item }) => (
          <TouchableOpacity style={s.item} onPress={() => onOpenCard(item.id)} accessibilityLabel={`${item.name}, ${item.setName || ''} number ${item.number}`}>
            <CardImage uri={item.image} width={52} />
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.name}</Text>
              <Text style={s.muted}>
                {item.setName || 'Unknown set'} · #{item.number}
                {item.setTotal ? `/${item.setTotal}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

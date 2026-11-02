import React, { useMemo, useState } from 'react';
import { FlatList, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { cardCount, itemValue, totalValue } from '../collection';
import { money, ORANGE, shortDate } from '../theme';
import { Button, CardImage, Chip, useStyles } from '../ui';

const styles = (c) => ({
  head: { padding: 16, gap: 12 },
  hero: { backgroundColor: c.soft, borderWidth: 1, borderColor: c.line, borderRadius: 18, padding: 18, gap: 4 },
  eyebrow: { color: c.muted, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  total: { color: c.text, fontSize: 38, fontWeight: '900' },
  muted: { color: c.muted, fontSize: 13, lineHeight: 19 },
  up: { color: c.good, fontSize: 13, fontWeight: '700' },
  down: { color: c.bad, fontSize: 13, fontWeight: '700' },
  chips: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  tile: { flex: 1, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 8, gap: 3 },
  name: { color: c.text, fontWeight: '800', fontSize: 13 },
  price: { color: ORANGE, fontWeight: '900', fontSize: 15 },
  badge: { position: 'absolute', top: 6, right: 6, backgroundColor: ORANGE, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  empty: { margin: 16, padding: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: c.line, borderRadius: 16, alignItems: 'center', gap: 12 },
  emptyTitle: { color: c.text, fontSize: 18, fontWeight: '800' },
});

const SORTS = {
  value: { label: 'Value', fn: (a, b) => itemValue(b) - itemValue(a) },
  recent: { label: 'Recent', fn: (a, b) => b.addedAt - a.addedAt },
  name: { label: 'Name', fn: (a, b) => a.name.localeCompare(b.name) },
};

export default function CollectionScreen({ name, items, lastRefresh, refreshing, onRefresh, onOpenItem, onScan }) {
  const s = useStyles(styles);
  const { width } = useWindowDimensions();
  const [sort, setSort] = useState('value');
  const columns = Math.max(2, Math.min(6, Math.floor(Math.min(width, 1100) / 170)));
  const tileImage = Math.floor(Math.min(width, 1100) / columns) - 34;

  const sorted = useMemo(() => [...items].sort(SORTS[sort].fn), [items, sort]);
  const total = totalValue(items);
  const previousTotal = items.reduce((sum, i) => sum + (i.previousPrice ?? i.price ?? 0) * (i.quantity || 1), 0);
  const change = total - previousTotal;

  const header = (
    <View style={s.head}>
      <View style={s.hero}>
        <Text style={s.eyebrow}>{name ? `${name.toUpperCase()}’S COLLECTION` : 'MY COLLECTION'}</Text>
        <Text style={s.total}>{money(total)}</Text>
        <Text style={s.muted}>
          {cardCount(items)} cards · {items.length} unique · market value, Near Mint
        </Text>
        {lastRefresh && Math.abs(change) >= 0.01 ? (
          <Text style={change > 0 ? s.up : s.down}>
            {change > 0 ? '▲' : '▼'} {money(Math.abs(change))} since last price check
          </Text>
        ) : null}
      </View>
      {items.length ? (
        <View style={s.chips}>
          {Object.entries(SORTS).map(([k, v]) => (
            <Chip key={k} label={v.label} on={sort === k} onPress={() => setSort(k)} />
          ))}
          <View style={{ flex: 1 }} />
          <Button secondary icon="refresh" label="Update prices" loading={refreshing} onPress={onRefresh} style={{ paddingVertical: 8 }} />
        </View>
      ) : null}
      {lastRefresh ? <Text style={s.muted}>Prices checked {shortDate(lastRefresh)}</Text> : null}
    </View>
  );

  if (!items.length) {
    return (
      <View style={{ flex: 1 }}>
        {header}
        <View style={s.empty}>
          <Text style={{ fontSize: 40 }}>🎴</Text>
          <Text style={s.emptyTitle}>Your collection is empty</Text>
          <Text style={[s.muted, { textAlign: 'center' }]}>Scan a card to see what it’s worth and start building your collection.</Text>
          <Button icon="scan" label="Scan your first card" onPress={onScan} />
        </View>
      </View>
    );
  }

  return (
    <FlatList
      key={columns}
      data={sorted}
      numColumns={columns}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={header}
      columnWrapperStyle={{ gap: 10, paddingHorizontal: 16 }}
      contentContainerStyle={{ gap: 10, paddingBottom: 30 }}
      renderItem={({ item }) => (
        <TouchableOpacity style={[s.tile, { maxWidth: tileImage + 18 }]} onPress={() => onOpenItem(item)} accessibilityLabel={`${item.name}, ${money(itemValue(item))}`}>
          <CardImage uri={item.image} width={tileImage} style={{ alignSelf: 'center' }} />
          {item.quantity > 1 ? (
            <View style={s.badge}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>×{item.quantity}</Text>
            </View>
          ) : null}
          <Text style={s.name} numberOfLines={1}>{item.name}</Text>
          <Text style={s.muted} numberOfLines={1}>
            {item.setName}
            {item.number ? ` #${item.number}` : ''}
          </Text>
          <Text style={s.muted} numberOfLines={1}>{item.variantLabel}</Text>
          <Text style={s.price}>{item.priceSource === 'cardmarket' ? '≈ ' : ''}{money(itemValue(item))}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

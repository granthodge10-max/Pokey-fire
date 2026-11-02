import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from './api';
import { defaultVariant } from './collection';
import { money, ORANGE, shortDate, useTheme } from './theme';
import { Button, CardImage, Chip, Panel, useStyles } from './ui';

const styles = (c) => ({
  safe: { flex: 1, backgroundColor: c.bg },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: c.line },
  topTitle: { color: c.text, fontWeight: '800', fontSize: 16 },
  page: { padding: 16, paddingBottom: 40, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center' },
  name: { color: c.text, fontSize: 26, fontWeight: '900' },
  muted: { color: c.muted, fontSize: 13, lineHeight: 19 },
  h2: { color: c.text, fontSize: 17, fontWeight: '800', marginBottom: 8 },
  big: { color: ORANGE, fontSize: 34, fontWeight: '900' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderColor: c.line },
  cell: { color: c.text, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 16, justifyContent: 'center' },
  qtyText: { color: c.text, fontSize: 20, fontWeight: '800', minWidth: 30, textAlign: 'center' },
});

/**
 * Full-screen card view. Pass `cardId` (fetched here) or `card` (already loaded).
 * With `item`, it shows collection controls instead of "Add".
 */
export default function CardDetail({ cardId, card: initialCard, item, finishHint, onAdd, onUpdateItem, onRemoveItem, onClose }) {
  const s = useStyles(styles);
  const { c } = useTheme();
  const [card, setCard] = useState(initialCard || null);
  const [error, setError] = useState(null);
  const [variant, setVariant] = useState(null);

  useEffect(() => {
    if (initialCard || !cardId) return;
    let live = true;
    api.card(cardId).then((x) => live && setCard(x), (e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [cardId, initialCard]);

  useEffect(() => {
    if (card && !variant) setVariant(item?.variant || defaultVariant(card, finishHint)?.key || null);
  }, [card, item, finishHint, variant]);

  const variants = card?.prices?.variants || [];
  const selected = variants.find((v) => v.key === variant);
  const cm = card?.prices?.cardmarket;

  return (
    <Modal animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={s.safe}>
        <View style={s.top}>
          <Text style={s.topTitle}>{item ? 'In your collection' : 'Card details'}</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={c.text} />
          </TouchableOpacity>
        </View>
        {!card && !item?.manual ? (
          <View style={{ padding: 30, alignItems: 'center' }}>
            {error ? <Text style={s.muted}>{error}</Text> : <ActivityIndicator color={ORANGE} />}
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.page}>
            <CardImage uri={card?.image || item?.image} width={240} style={{ alignSelf: 'center' }} />
            <View>
              <Text style={s.name}>{card?.name || item.name}</Text>
              <Text style={s.muted}>
                {[card?.set?.name || item?.setName, (card?.number || item?.number) && `#${card?.number || item.number}${card?.set?.total ? `/${card.set.total}` : ''}`, card?.rarity]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {card?.illustrator ? <Text style={s.muted}>Illus. {card.illustrator}</Text> : null}
            </View>

            {card ? (
              <Panel>
                <Text style={s.h2}>Market price</Text>
                {variants.length > 1 ? (
                  <View style={s.chips}>
                    {variants.map((v) => (
                      <Chip key={v.key} label={v.label} on={v.key === variant} onPress={() => setVariant(v.key)} />
                    ))}
                  </View>
                ) : null}
                {selected?.source === 'cardmarket' ? (
                  <>
                    <Text style={s.big}>≈ {money(selected.market)}</Text>
                    <Text style={s.muted}>
                      {selected.label} · converted from the Cardmarket (EU) price. TCGplayer doesn’t list this printing separately.
                    </Text>
                    <View style={{ marginTop: 10 }}>
                      {[['Cardmarket trend', selected.cardmarket.trend], ['30-day average', selected.cardmarket.avg30], ['Lowest listing', selected.cardmarket.low]].map(([k, v]) => (
                        <View key={k} style={s.row}>
                          <Text style={s.cell}>{k}</Text>
                          <Text style={s.cell}>{money(v, selected.cardmarket.currency)}</Text>
                        </View>
                      ))}
                    </View>
                    {selected.firstEdition === 'mixed' ? (
                      <Text style={[s.muted, { marginTop: 8 }]}>
                        Cardmarket lists 1st Edition and regular copies of this printing together, so a 1st Edition copy usually sells for more than this.
                      </Text>
                    ) : null}
                    {card.prices.eurUsd ? <Text style={[s.muted, { marginTop: 8 }]}>€1 = {money(card.prices.eurUsd)} (ECB rate)</Text> : null}
                  </>
                ) : selected ? (
                  <>
                    <Text style={s.big}>{money(selected.market ?? selected.mid)}</Text>
                    <Text style={s.muted}>{selected.label} · Near Mint, ungraded · TCGplayer market price</Text>
                    <View style={{ marginTop: 10 }}>
                      {[['Low', selected.low], ['Mid', selected.mid], ['High', selected.high]].map(([k, v]) => (
                        <View key={k} style={s.row}>
                          <Text style={s.cell}>{k}</Text>
                          <Text style={s.cell}>{money(v)}</Text>
                        </View>
                      ))}
                      {cm?.trend ? (
                        <View style={s.row}>
                          <Text style={s.cell}>Cardmarket trend (EU)</Text>
                          <Text style={s.cell}>{money(cm.trend, cm.currency)}</Text>
                        </View>
                      ) : null}
                    </View>
                    {card.prices.updated ? <Text style={[s.muted, { marginTop: 8 }]}>Prices updated {shortDate(card.prices.updated)}</Text> : null}
                  </>
                ) : (
                  <Text style={s.muted}>No TCGplayer price is listed for this card yet.{cm?.trend ? ` Cardmarket trend: ${money(cm.trend, cm.currency)}.` : ''}</Text>
                )}
              </Panel>
            ) : (
              <Panel>
                <Text style={s.h2}>Manual entry</Text>
                <Text style={s.muted}>Added by hand in an earlier version, value {money(item.price)}. Search for this card to replace it with a live-priced entry.</Text>
              </Panel>
            )}

            {item ? (
              <Panel style={{ gap: 12 }}>
                <Text style={s.h2}>Copies owned</Text>
                <View style={s.qty}>
                  <TouchableOpacity accessibilityLabel="Remove one copy" onPress={() => (item.quantity > 1 ? onUpdateItem({ ...item, quantity: item.quantity - 1 }) : onRemoveItem(item))}>
                    <Ionicons name="remove-circle-outline" size={34} color={ORANGE} />
                  </TouchableOpacity>
                  <Text style={s.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity accessibilityLabel="Add one copy" onPress={() => onUpdateItem({ ...item, quantity: item.quantity + 1 })}>
                    <Ionicons name="add-circle-outline" size={34} color={ORANGE} />
                  </TouchableOpacity>
                </View>
                {card && variant !== item.variant && selected ? (
                  <Button
                    secondary
                    label={`Change my copy to ${selected.label}`}
                    onPress={() => onUpdateItem({ ...item, variant: selected.key, variantLabel: selected.label, priceSource: selected.source, price: selected.market ?? selected.mid })}
                  />
                ) : null}
                <Button secondary icon="trash-outline" label="Remove from collection" onPress={() => onRemoveItem(item)} />
              </Panel>
            ) : (
              <Button icon="add-circle" label="Add to collection" disabled={!card} onPress={() => onAdd(card, variant)} />
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

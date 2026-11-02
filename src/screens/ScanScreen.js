import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { api } from '../api';
import { defaultVariant } from '../collection';
import { money, ORANGE } from '../theme';
import { Button, CardImage, Chip, Panel, useStyles } from '../ui';

const styles = (c) => ({
  page: { padding: 16, paddingBottom: 40, gap: 14 },
  h1: { color: c.text, fontSize: 24, fontWeight: '900' },
  h2: { color: c.text, fontSize: 17, fontWeight: '800' },
  text: { color: c.text, fontSize: 15 },
  muted: { color: c.muted, fontSize: 13, lineHeight: 19 },
  camera: { width: '100%', aspectRatio: 3 / 4, maxHeight: 560, borderRadius: 18, overflow: 'hidden', backgroundColor: '#111', alignSelf: 'center' },
  frameWrap: { ...{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }, alignItems: 'center', justifyContent: 'center' },
  frame: { width: '72%', aspectRatio: 63 / 88, borderWidth: 3, borderColor: ORANGE, borderRadius: 14 },
  hint: { position: 'absolute', bottom: 14, alignSelf: 'center', backgroundColor: '#000a', color: '#fff', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, fontSize: 13, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: 10 },
  match: { flexDirection: 'row', gap: 14 },
  price: { color: ORANGE, fontSize: 28, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  alt: { width: 110, gap: 4 },
  altName: { color: c.text, fontSize: 12, fontWeight: '700' },
  error: { color: c.bad, fontSize: 14, lineHeight: 20 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
});

// Downscale before upload: faster on mobile data and plenty for reading card text.
async function prepareImage(uri) {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: 1200 });
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
  return out;
}

export default function ScanScreen({ onAdd, onOpenCard, onSearchInstead }) {
  const s = useStyles(styles);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [chosen, setChosen] = useState(0);
  const [variant, setVariant] = useState(null);
  const [added, setAdded] = useState(false);

  function reset() {
    setPhoto(null);
    setResult(null);
    setError(null);
    setChosen(0);
    setVariant(null);
    setAdded(false);
  }

  async function identify(uri) {
    reset();
    setCameraOn(false);
    setWorking(true);
    try {
      const img = await prepareImage(uri);
      setPhoto(img.uri);
      const res = await api.identify(img.base64);
      setResult(res);
      if (res.matches.length) setVariant(defaultVariant(res.matches[0], res.matches[0].suggestedVariant)?.key || null);
    } catch (e) {
      setError(e.status === 503 ? 'Automatic recognition isn’t set up on the server yet. You can still find the card with Search.' : e.message);
    } finally {
      setWorking(false);
    }
  }

  async function openCamera() {
    if (!permission?.granted) {
      const p = await requestPermission();
      if (!p.granted) {
        setError('Camera access was denied. You can upload a photo instead.');
        return;
      }
    }
    reset();
    setCameraOn(true);
  }

  async function capture() {
    try {
      const pic = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
      if (pic?.uri) identify(pic.uri);
    } catch (e) {
      setError('Could not take the picture. Try again or upload a photo.');
    }
  }

  async function upload() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (!r.canceled && r.assets?.[0]?.uri) identify(r.assets[0].uri);
  }

  function choose(i) {
    setChosen(i);
    setAdded(false);
    setVariant(defaultVariant(result.matches[i], result.matches[i].suggestedVariant)?.key || null);
  }

  const match = result?.matches?.[chosen];
  const reading = result?.reading;
  const selected = match?.prices?.variants?.find((v) => v.key === variant);

  return (
    <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
      <View>
        <Text style={s.h1}>Scan a card</Text>
        <Text style={s.muted}>Lay the card flat in good light and fill the frame. Avoid glare over the name and the number at the bottom.</Text>
      </View>

      <View style={s.camera}>
        {cameraOn ? (
          <>
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
            <View style={s.frameWrap} pointerEvents="none">
              <View style={s.frame} />
            </View>
            <Text style={s.hint}>Line the card up inside the frame</Text>
          </>
        ) : photo ? (
          <Image source={{ uri: photo }} style={{ flex: 1 }} resizeMode="contain" />
        ) : (
          <View style={s.placeholder}>
            <Text style={{ fontSize: 46 }}>📸</Text>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Point your camera at a Pokémon card</Text>
          </View>
        )}
        {working ? (
          <View style={[s.frameWrap, { backgroundColor: '#0008', gap: 10 }]}>
            <ActivityIndicator size="large" color={ORANGE} />
            <Text style={{ color: '#fff', fontWeight: '700' }}>Identifying card…</Text>
          </View>
        ) : null}
      </View>

      <View style={s.row}>
        {cameraOn ? (
          <Button icon="radio-button-on" label="Capture" onPress={capture} style={{ flex: 1 }} />
        ) : (
          <Button icon="camera" label={photo ? 'Scan another' : 'Open camera'} onPress={openCamera} disabled={working} style={{ flex: 1 }} />
        )}
        <Button icon="image-outline" label="Upload photo" secondary onPress={upload} disabled={working} style={{ flex: 1 }} />
      </View>

      {error ? (
        <Panel style={{ gap: 10 }}>
          <Text style={s.error}>{error}</Text>
          <Button icon="search" label="Search for the card" secondary onPress={onSearchInstead} />
        </Panel>
      ) : null}

      {result && !match ? (
        <Panel style={{ gap: 10 }}>
          <Text style={s.h2}>{reading?.is_pokemon_card === false ? 'That doesn’t look like a Pokémon card' : 'No exact match found'}</Text>
          {reading?.name ? <Text style={s.muted}>Read from photo: {reading.name}{reading.number ? ` · #${reading.number}${reading.set_total ? `/${reading.set_total}` : ''}` : ''}</Text> : null}
          <Text style={s.muted}>Try a sharper, glare-free photo, or search by name and number.</Text>
          <Button icon="search" label="Search manually" secondary onPress={onSearchInstead} />
        </Panel>
      ) : null}

      {match ? (
        <Panel style={{ gap: 12 }}>
          <Text style={s.muted}>
            {chosen === 0 ? 'Best match' : 'Selected match'}
            {reading?.confidence && chosen === 0 ? ` · ${reading.confidence} confidence` : ''}
          </Text>
          <TouchableOpacity style={s.match} onPress={() => onOpenCard(match, variant)} accessibilityLabel={`View ${match.name} details`}>
            <CardImage uri={match.imageSmall} width={110} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.h2}>{match.name}</Text>
              <Text style={s.muted}>
                {match.set.name} · #{match.number}
                {match.set.total ? `/${match.set.total}` : ''}
                {match.rarity ? ` · ${match.rarity}` : ''}
              </Text>
              <Text style={s.price}>{selected?.source === 'cardmarket' ? '≈ ' : ''}{money(selected?.market ?? selected?.mid)}</Text>
              <Text style={s.muted}>{selected ? `${selected.label} · ${selected.source === 'cardmarket' ? 'estimate from Cardmarket (EU)' : 'market price'}` : 'No market price listed'}</Text>
            </View>
          </TouchableOpacity>
          {match.prices.variants.length > 1 ? (
            <View style={s.chips}>
              {match.prices.variants.map((v) => (
                <Chip key={v.key} label={`${v.label} ${v.source === 'cardmarket' ? '≈' : ''}${money(v.market ?? v.mid)}`} on={v.key === variant} onPress={() => setVariant(v.key)} />
              ))}
            </View>
          ) : null}
          {reading?.notes ? <Text style={s.muted}>Note: {reading.notes}</Text> : null}
          <Button
            icon={added ? 'checkmark-circle' : 'add-circle'}
            label={added ? 'Added. Tap to add another copy' : 'Add to collection'}
            onPress={() => {
              onAdd(match, variant);
              setAdded(true);
            }}
          />
        </Panel>
      ) : null}

      {result?.matches?.length > 1 ? (
        <View style={{ gap: 8 }}>
          <Text style={s.h2}>Not quite? Other matches</Text>
          <ScrollView horizontal contentContainerStyle={{ gap: 10 }}>
            {result.matches.map((m, i) =>
              i === chosen ? null : (
                <TouchableOpacity key={m.id} style={s.alt} onPress={() => choose(i)}>
                  <CardImage uri={m.imageSmall} width={110} />
                  <Text style={s.altName} numberOfLines={1}>{m.name}</Text>
                  <Text style={s.muted} numberOfLines={1}>{m.set.name} #{m.number}</Text>
                </TouchableOpacity>
              ),
            )}
          </ScrollView>
          <Button icon="search" label="Search manually" secondary onPress={onSearchInstead} />
        </View>
      ) : null}
    </ScrollView>
  );
}

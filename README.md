# Pokey Fire

Scan a Pokémon card with your phone, find out what it's worth, and build a digital collection.

## How it works

1. **Scan**: take a photo (or upload one). The app shrinks it and sends it to the Pokey Fire server.
2. **Identify**: the server asks a vision model (xAI Grok by default, or Claude) to read the card's name, collector number (e.g. `199/165`), set and finish, then matches that against the [TCGdex](https://tcgdex.dev) card database to find the exact printing. Close alternatives are shown in case the first guess is wrong.
3. **Price**: TCGdex includes TCGplayer market prices (USD, per variant: normal / holo / reverse holo / 1st edition…) and the Cardmarket trend (EUR).
4. **Collect**: add the card in the right variant. The collection screen shows the total value, sorts by value/recent/name, stacks duplicates, and re-checks prices with one tap.

Manual search ("Charizard 4", "Pikachu ex 238/191") works without recognition.

```
App.js                  app shell: tabs, onboarding, card detail modal
src/
  api.js                talks to the server
  collection.js         collection model, on-device storage, price refresh
  CardDetail.js         card view with price breakdown and collection controls
  screens/              Scan, Search, Collection, Settings
server/
  src/index.js          Express API: /api/identify, /api/search, /api/cards/:id
  src/identify.js       card reading (xAI Grok or Claude) + matching
  src/tcgdex.js         TCGdex client and price normalization
```

## Run it locally

You need Node.js 20.12+.

**1. Start the server**

```bash
cd server
npm install
cp .env.example .env    # then put your xAI API key in .env
npm start               # http://localhost:8787
```

Without `XAI_API_KEY` the server still runs; search and prices work, and scanning shows a "recognition isn't set up" message. Get a key at https://console.x.ai/. (Prefer Claude? Leave `XAI_API_KEY` empty and set `ANTHROPIC_API_KEY` instead.)

**2. Start the app** (in another terminal, from the repo root)

```bash
npm install
npx expo start
```

- **Phone:** install Expo Go and scan the QR code. Phone and computer must be on the same Wi-Fi; the app finds the server on port 8787 of your computer automatically.
- **Browser:** press `w`. The web build uses the webcam or a photo upload.
- To point the app at a hosted server, set `EXPO_PUBLIC_API_URL=https://your-server.example.com` before `npx expo start`.

## Notes and limits

- Prices are for **ungraded, Near Mint** copies. PSA/graded prices aren't in this data source.
- The scanner reports 1st Edition stamps and Base Set Shadowless printings, and the server picks the matching price. Where TCGplayer has no price for a printing (e.g. Base Set 1st Edition / Shadowless), the Cardmarket (EU) price is converted to USD at the ECB rate and shown with "≈". Cardmarket doesn't separate 1st Edition from other Shadowless copies, so those estimates run low for true 1st Editions.
- English-language cards are matched. Japanese cards may be read correctly but won't find a price match yet.
- TCG Pocket (digital) cards are filtered out of results.
- The collection lives on the device (AsyncStorage). Cards saved by the earlier prototype are carried over as "manual entry" items.
- Each scan makes one vision API call (`grok-4.7` by default). Set `XAI_MODEL=grok-4.3` in `server/.env` for a cheaper model.

## Before a public release

Hosted server (with rate limiting / auth so your API key can't be abused), user accounts and cloud sync, subscription billing, privacy policy and terms, account deletion, app icons/screenshots, and store testing.

## Build for Google Play

1. Create an Expo account at https://expo.dev/ and `npm install -g eas-cli`, then `eas login`.
2. `eas build:configure` (replaces the placeholder EAS project ID in `app.json`).
3. `eas build --platform android --profile production`, then upload the `.aab` in Google Play Console.

Set `EXPO_PUBLIC_API_URL` to your hosted server for store builds. The Android package name is `com.pokeyfire.app`.

Pokey Fire is not affiliated with Pokémon, Nintendo, Creatures or GAME FREAK.

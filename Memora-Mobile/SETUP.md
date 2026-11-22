# Memora: deletion starter

What's in here:

```
app/
  _layout.tsx          root: gestures + modal Review screen
  review.tsx           review the trash, then ONE batch delete
  (tabs)/
    _layout.tsx        bottom tabs: Library, Clean, Camera, Create
    index.tsx          Library grid (long-press to select, then Trash)
    clean.tsx          swipe deck + type chips + year chips + "move all"
    camera.tsx         placeholder
    create.tsx         placeholder
src/
  trash/store.ts       the trash queue (saved to storage, with undo)
  photos/query.ts      type/date filters -> photo library queries
  photos/usePhotos.ts  paged loading (60 at a time)
  photos/PermissionGate.tsx  photo permission + "limited access" banner
  components/          SwipeCard, PhotoTile, Chip
  theme.ts             placeholder colors: restyle freely
```

## 1. Create the Expo project (in your empty repo folder)

```bash
npx create-expo-app@latest .
npm run reset-project        # moves the template's demo screens into app-example/
```

Then delete the new empty `app/` folder and copy in `app/` and `src/` from this zip.
You can delete `app-example/` once it runs.

## 2. Install what the starter uses

```bash
npx expo install expo-media-library expo-image react-native-gesture-handler react-native-reanimated @react-native-async-storage/async-storage expo-dev-client
npm install zustand
```

`npx expo install` picks versions that match your Expo SDK, so don't use plain `npm install` for those.

## 3. Add the photo permission text to app.json

Inside `"expo": { ... }`, add to `"plugins"`:

```json
[
  "expo-media-library",
  {
    "photosPermission": "Memora shows your photos so you can sort and clean them. Everything stays on your phone.",
    "savePhotosPermission": "Memora saves photos you take or edit to your library.",
    "isAccessMediaLocationEnabled": false
  }
]
```

App Review reads this text, so keep it honest and specific.

## 4. Check it compiles

```bash
npx tsc --noEmit
```

## 5. Run it on your iPhone (from Windows)

You can't use Xcode on Windows, so Expo builds the iOS app in the cloud:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas device:create                                      # registers your iPhone
eas build --profile development --platform ios         # needs the $99 Apple Developer account
```

Install the build from the link EAS gives you, then:

```bash
npx expo start --dev-client
```

After that first build, JS changes reload instantly. You only rebuild when you add a native package.

Android: install Android Studio, start an emulator, then `npx expo run:android` or `eas build --profile development --platform android`.

## Safety notes

- Nothing is deleted until "Delete N items" on the Review screen. iOS then shows its own popup.
- Deleted items go to Recently Deleted (iOS) or the trash (Android 11+) for about 30 days.
- Test on a phone you don't mind, or with a few junk screenshots first.

## Known gaps (next steps)

- No full-screen photo viewer yet (tap in Library is a TODO).
- Smart album names (Screenshots, Live Photos, Selfies) are matched in English.
- Duplicates / blurry / scene filters need on-device ML (phase 2).
- Videos aren't sorted by file size yet.

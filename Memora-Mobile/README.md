# Memora Mobile — Expo / React Native

This project combines the uploaded **Memora deletion starter** with a **native mobile adaptation** of the uploaded Figma Make design. It is not a copy of the web HTML/CSS: those browser components are incompatible with React Native.

## What's implemented
- Cream/ink editorial theme, home dashboard, recent device photos, navigation, and polished native placeholders.
- Starter photo permission gate, library grid, select-to-trash, swipe cleaning, persistent trash queue, undo, and review/deletion workflow.
- Camera, AI creation, shared albums, journals and collaborative albums are **not implemented**.

## Setup
Requires Node.js and a supported iOS or Android device/emulator.

```bash
npm install
npx expo install --fix
npx tsc --noEmit
npx expo start
```

For native features, use an Expo development build if Expo Go cannot support your installed native dependencies. See `SETUP.md` for dev-build instructions.

**Important:** Verify permissions and deletion behavior on a real device before using with irreplaceable photos. Review is intended to be the only point that requests system deletion.

## Notes
The starter ZIP did not include a package.json, so one has been provided using Expo SDK 54 versions as a starting point. `expo install --fix` will resolve compatible native package versions. The project has **not** been compiled or device-tested in this environment.

# QRY-PTI Android

React Native Android browser foundation.

## Run

```bash
cd mobile
npm install
npx expo start
```

For a connected Android device:

```bash
npx expo start --android
```

For a native Android build:

```bash
npx expo run:android
```

## Current foundation

- React Native + Expo
- Android WebView browser surface
- Address/search bar
- Back/forward/reload
- Local history
- Privacy preference persistence
- Third-party cookie control
- QRY-PTI dark browser chrome

## Next native layers

The web app cannot provide OS-level controls. Native Android modules will be added for app-owned secure windows, protected storage, downloads, permissions, and deeper request/content blocking.

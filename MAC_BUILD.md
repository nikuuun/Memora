# Install Memora on your iPhone from a Mac

Google sign-in (Shared albums) doesn't work in Expo Go. It needs Memora's own
development build on the phone. A Mac builds it once. After that, the app
loads its code from any computer on the same Wi-Fi, just like Expo Go.

With a free Apple ID the install expires after **7 days**. Re-run step 6 to renew it.
You also need to rebuild when a new native package is added.

## 1. Check the Mac (5 min)

Open **Terminal** and run:

```bash
xcodebuild -version   # Xcode installed? It needs a recent version.
node -v               # Node.js 20.19 or newer?
git --version
```

If Xcode is missing or very old and you can't update it, use a different Mac.

## 2. Node.js without admin rights (only if `node -v` failed)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# close and reopen Terminal, then:
nvm install --lts
```

## 3. Get the code

```bash
cd ~/Desktop
git clone https://github.com/nikuuun/Memora.git
cd Memora
git checkout Test
npm install
```

## 4. Get the iPhone ready

1. Plug the iPhone into the Mac with a cable. Tap **Trust** on the phone.
2. On the iPhone: **Settings → Privacy & Security → Developer Mode → On**. The phone restarts.
3. On the Mac, open **Xcode → Settings → Accounts → +** and sign in with your Apple ID.

## 5. Build and install (first time 10–20 min)

```bash
npx expo run:ios --device
```

- Pick your iPhone from the list.
- If it asks to install **CocoaPods**, say yes. If that fails without admin rights:
  `gem install cocoapods --user-install`, then run the build again.
- **Signing error ("No team" / "requires a development team")**: run `open ios/memora.xcworkspace`,
  click **memora** in the left sidebar → **Signing & Capabilities** → **Team**: pick your Apple ID
  ("Personal Team"). Close Xcode and run the build again.
- **"com.memora.app is not available"**: someone else has that bundle ID. Change it in `app.json`
  (for example `com.nikuun.memora`), change it on the Google Cloud iOS client too, and build again.

## 6. Open it on the iPhone

The first time, iOS blocks apps from a personal Apple ID:
**Settings → General → VPN & Device Management →** your Apple ID **→ Trust**.

Then open **Memora** on the iPhone.

## 7. Day-to-day (on any computer, no Mac needed)

On your own computer, same Wi-Fi as the phone:

```bash
npx expo start --dev-client
```

Open Memora on the phone. It finds the computer, or scan the QR code with the Camera app.
School Wi-Fi often blocks this. If so, use a phone hotspot, or run
`npx expo start --dev-client --tunnel`.

## Before you leave the school Mac

- **Xcode → Settings → Accounts** → select your Apple ID → **−** to sign out.
- Delete `~/Desktop/Memora`.

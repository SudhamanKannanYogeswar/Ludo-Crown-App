# Ludo Crown — Zero-Install Cloud Builds (Android `.apk`/`.aab` & iOS `.ipa`)

You do **not** need Android Studio or Xcode installed on your computer. This project includes a ready-to-run **GitHub Actions** cloud workflow (`.github/workflows/mobile-cloud-build.yml`) that builds both Android and iOS automatically in the cloud.

---

## 1. Build & Download Your Android `.apk` in 3 Minutes (Free, Browser-Only)

1. **Push this project to a GitHub repository** (use AI Studio's GitHub export / push button, or download the zip and upload it to a new GitHub repo).
2. *(Recommended for live AdMob banner)* In your GitHub repo, go to **Settings → Secrets and variables → Actions → New repository secret** and add:
   - **`ADMOB_ANDROID_APP_ID`**: your AdMob Android App ID (`ca-app-pub-7279678697929131~XXXXXXXXXX`, found in Google AdMob → App settings).
   - *(Optional for iOS)* **`ADMOB_IOS_APP_ID`**: your AdMob iOS App ID.
   - *(Note: If you skip this step on your first test run, the workflow automatically falls back to Google's official test App ID so your first `.apk` still builds right away.)*
3. Open the **Actions** tab in your GitHub repository:
   - The workflow **`Build Android APK/AAB & iOS App (Capacitor Cloud Build)`** runs automatically on every push to `main`/`master` (or click **Run workflow** manually).
   - Once green (~3–5 minutes), scroll down to **Artifacts** and download **`LudoCrown-Android-APK`** (`app-debug.apk`) to install directly on your Android phone!

> Your live Android Banner Unit ID (`ca-app-pub-7279678697929131/9701826584`) is already wired in `src/services/adMobService.ts`.

---

## 2. Generate a Signed Google Play Store `.aab` in GitHub Actions (No Android Studio)

To upload to **Google Play Console**, you need a signed `.aab` bundle. Add these 4 secrets under **GitHub Settings → Secrets and variables → Actions**:

- `ANDROID_KEYSTORE_BASE64` — base64-encoded contents of your `.jks` signing keystore
- `ANDROID_KEYSTORE_PASSWORD` — keystore password
- `ANDROID_KEY_ALIAS` — key alias
- `ANDROID_KEY_PASSWORD` — key password

As soon as `ANDROID_KEYSTORE_BASE64` is added, the workflow automatically produces and uploads **`LudoCrown-PlayStore-Signed-Release`** containing both `app-release.aab` (for Google Play Console) and `app-release.apk`.

---

## 3. iOS App Store Build (No Mac Needed)

- The same GitHub Actions workflow runs on Apple's cloud `macos-latest` runner, injects your `GADApplicationIdentifier` + Apple ATT permission (`NSUserTrackingUsageDescription`) + Google `SKAdNetworkItems`, and outputs **`LudoCrown-iOS-Unsigned-IPA`**.
- To sign and publish directly to **Apple App Store Connect** without a Mac, connect this exact GitHub repository to **Codemagic** (free tier supports App Store Connect API key signing & TestFlight upload).

---

## 4. Built-In Google AdMob, Play Store & App Store Policy Safeguards

- **No Gameplay Overlap**: Adaptive Banner (`ca-app-pub-7279678697929131/9701826584`) automatically unmounts whenever the Ludo board (`play`) is active to prevent accidental clicks.
- **Explicit Attribution**: Every banner, interstitial, and rewarded placement carries a visible `AD` label.
- **Opt-In Rewarded Video**: Exact coin/ticket/re-roll reward is disclosed before watching; exiting early cancels safely without penalty.
- **Natural-Break Interstitials + Cooldown**: Interstitials never fire on app launch, app exit, or mid-turn. Strictly capped at 1 per 3 completed matches with a minimum 90-second cooldown.
- **Privacy & Consent (UMP / Apple ATT)**: Non-personalized ads (`npa: true`) are requested by default until the player opts into personalized ads in the Ad Privacy toggle.

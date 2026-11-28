# Ludo Crown — Zero-Install Cloud Builds (Android `.apk`/`.aab` & iOS `.ipa`)

You do **not** need Android Studio or Xcode installed on your computer. This project includes a ready-to-run **GitHub Actions** cloud workflow (`.github/workflows/mobile-cloud-build.yml`) that builds both Android and iOS automatically in the cloud.

---

## 1. Enable Google Sign-In, Play Online & Play Friends in Your Android APK

Web popup sign-in is blocked by Google inside Android WebViews. Ludo Crown automatically uses **Native Android Google Sign-In** (`@capacitor-firebase/authentication`) inside the APK, which requires two one-time steps so Google trusts your APK:

### Step A — Create a Permanent Android Keystore (Browser-Only, No Install)
Because GitHub Actions generates a different random debug key on every run, create one permanent signing keystore right inside your browser using **GitHub Codespaces** (click green **`<> Code` → Codespaces → Create codespace on main** in your repo) and paste this single command:

```bash
keytool -genkeypair -v -keystore ludocrown-upload.jks -alias ludocrown -keyalg RSA -keysize 2048 -validity 10000 -storepass LudoCrown2026! -keypass LudoCrown2026! -dname "CN=Ludo Crown, O=Ludo Crown, C=IN" && echo "--- SHA1 (PASTE IN FIREBASE CONSOLE) ---" && keytool -list -v -keystore ludocrown-upload.jks -alias ludocrown -storepass LudoCrown2026! | grep "SHA1:" && echo "--- ANDROID_KEYSTORE_BASE64 (PASTE IN GITHUB SECRET) ---" && base64 -w 0 ludocrown-upload.jks && echo ""
```

Save the outputs and add these 4 secrets in your GitHub repo (**Settings → Secrets and variables → Actions → New repository secret**):
- **`ANDROID_KEYSTORE_BASE64`** = the base64 line printed above
- **`ANDROID_KEYSTORE_PASSWORD`** = `LudoCrown2026!` (or whatever password you chose)
- **`ANDROID_KEY_ALIAS`** = `ludocrown`
- **`ANDROID_KEY_PASSWORD`** = `LudoCrown2026!`

### Step B — Register Android App + SHA-1 in Firebase Console & Add `google-services.json`
1. Open **[Firebase Console](https://console.firebase.google.com/)** and select your project **`gen-lang-client-0829075952`**.
2. Go to **Project Settings (gear icon) → General → Your apps → Add app → Android**.
3. Fill in:
   - **Android package name**: `com.ludocrown.game`
   - **App nickname**: `Ludo Crown Android`
   - **Debug / Signing certificate SHA-1**: paste the **SHA-1** from Step A (you can also view it on the GitHub Actions run summary page after adding the keystore secrets).
4. Click **Register app**, then **Download `google-services.json`**.
5. Convert `google-services.json` to base64 (in Codespaces or any base64 encoder: `base64 -w 0 google-services.json`) and add it as a GitHub Secret:
   - **`GOOGLE_SERVICES_JSON_BASE64`** = base64 contents of `google-services.json`

### Step C — Build & Install the Signed APK
1. Push your latest code (or open **Actions → Build Android APK and iOS App → Run workflow**).
2. Download **`LudoCrown-PlayStore-Signed-Release`** and install **`app-release.apk`** on your phone (uninstall the old debug APK first so signatures don't conflict).
3. **Google Sign-In**, **Play Online**, **Play Friends**, **Tournaments**, and **Cloud Sync** will now all work natively!

### Step D — Mandatory for Google Play Store `.aab` Bundles (Prevents Error `10:`)
When you upload `app-release.aab` to Google Play Console (Internal testing, Closed testing, or Production), Google Play **re-signs** your app with its own **App Signing key** (a different SHA-1 than your upload keystore):
1. In **Google Play Console**, go to **Test and release → Setup → App integrity → App signing**.
2. Copy the **App signing key certificate SHA-1** (and **SHA-256**).
3. In **Firebase Console → Project Settings → General → Your apps → `com.ludocrown.game`**, click **Add fingerprint** and paste Google Play's **App signing key SHA-1** alongside your Upload Keystore SHA-1.
4. Re-download **`google-services.json`**, base64-encode it (`base64 -w 0 google-services.json`), and update the **`GOOGLE_SERVICES_JSON_BASE64`** GitHub secret, then re-run the workflow.

---

## 2. Enable Live Google AdMob Banners in the APK

Add your AdMob Android App ID in **GitHub Settings → Secrets and variables → Actions → New repository secret**:
- **`ADMOB_ANDROID_APP_ID`**: your AdMob Android App ID (`ca-app-pub-7279678697929131~XXXXXXXXXX`, found in Google AdMob → App settings).
- *(Optional for iOS)* **`ADMOB_IOS_APP_ID`**: your AdMob iOS App ID.

> Your live Android Ad Units are already wired in `src/services/adMobService.ts`:
> - **Adaptive Banner**: `ca-app-pub-7279678697929131/9701826584` (Home, Cups, Rank, Rewards, Shop, and Online Waiting Rooms — auto-hidden during active gameplay)
> - **Rewarded Video**: `ca-app-pub-7279678697929131/9754631621` (+250 Coins, +5 Gems, Free Cup Ticket, 2x Post-Match Coins, Bonus Lucky Wheel Spin, Practice Dice Re-Roll)

---

## 3. iOS App Store Build (No Mac Needed)

- Optionally add **`GOOGLE_SERVICE_INFO_PLIST_BASE64`** (base64 of your Firebase iOS `GoogleService-Info.plist`) to enable native Google Sign-In on iOS.
- The GitHub Actions workflow runs on Apple's `macos-latest` runner when you check **Also build unsigned iOS IPA** under **Run workflow**, outputting **`LudoCrown-iOS-Unsigned-IPA`**.
- To sign and publish directly to **Apple App Store Connect** without a Mac, connect this GitHub repo to **Codemagic**.

---

## 4. Built-In Google AdMob, Play Store & App Store Policy Safeguards

- **No Gameplay Overlap**: Adaptive Banner (`ca-app-pub-7279678697929131/9701826584`) sits inside a dedicated 64px non-interactive safe zone on menus & waiting rooms, and automatically unmounts whenever the Ludo board (`play`) is active to prevent accidental clicks.
- **Explicit Attribution**: Every banner, interstitial, and rewarded placement carries a visible `AD` label.
- **Opt-In Rewarded Video**: Rewarded Video (`ca-app-pub-7279678697929131/9754631621`) discloses exact rewards before watching; exiting early cancels safely without penalty.
- **Natural-Break Interstitials + Cooldown**: Interstitials never fire on app launch, app exit, or mid-turn. Strictly capped at 1 per 3 completed matches with a minimum 90-second cooldown.
- **Privacy & Consent (UMP / Apple ATT)**: Non-personalized ads (`npa: true`) are requested by default until the player opts into personalized ads in the Ad Privacy toggle.

import fs from 'node:fs';
import path from 'node:path';

const target = (process.argv[2] || 'all').toLowerCase();

const ANDROID_APP_ID =
  (process.env.ADMOB_ANDROID_APP_ID || '').trim() ||
  'ca-app-pub-3940256099942544~3347511713';

const IOS_APP_ID =
  (process.env.ADMOB_IOS_APP_ID || '').trim() ||
  'ca-app-pub-3940256099942544~1458002511';

function ensurePermission(xml, permissionName) {
  if (xml.includes(permissionName)) return xml;
  return xml.replace(
    '<application',
    `    <uses-permission android:name="${permissionName}" />\n\n    <application`
  );
}

function configureAndroidFirebaseGradle() {
  const googleServicesPath = path.resolve('android/app/google-services.json');
  if (!fs.existsSync(googleServicesPath)) {
    console.warn(
      'android/app/google-services.json not found — native Android Google Sign-In will stay inactive until GOOGLE_SERVICES_JSON_BASE64 secret is set.'
    );
    return;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(googleServicesPath, 'utf8'));
    const clients = Array.isArray(parsed.client) ? parsed.client : [];
    const matchingClient = clients.find(
      (c) => c?.client_info?.android_client_info?.package_name === 'com.ludocrown.game'
    );
    if (!matchingClient) {
      console.warn(
        'WARNING: google-services.json does not contain package_name "com.ludocrown.game". Native Google Sign-In may fail.'
      );
    } else {
      const oauthClients = Array.isArray(matchingClient.oauth_client)
        ? matchingClient.oauth_client
        : [];
      const hasWebClient = oauthClients.some((o) => o?.client_type === 3);
      const hasAndroidClient = oauthClients.some((o) => o?.client_type === 1);
      console.log(
        `Verified google-services.json for com.ludocrown.game (webOAuthClient=${hasWebClient}, androidSha1Client=${hasAndroidClient})`
      );
      if (!hasAndroidClient) {
        console.warn(
          'WARNING: google-services.json has no Android SHA-1 OAuth client (client_type=1). Add your APK SHA-1 fingerprint in Firebase Console and re-download google-services.json.'
        );
      }
    }
  } catch (err) {
    console.warn('WARNING: Could not parse android/app/google-services.json:', err?.message || err);
  }

  // Ensure root android/build.gradle has google-services classpath
  const rootGradlePath = path.resolve('android/build.gradle');
  if (fs.existsSync(rootGradlePath)) {
    let rootGradle = fs.readFileSync(rootGradlePath, 'utf8');
    if (!rootGradle.includes('com.google.gms:google-services')) {
      rootGradle = rootGradle.replace(
        /dependencies\s*\{/,
        "dependencies {\n        classpath 'com.google.gms:google-services:4.4.2'"
      );
      fs.writeFileSync(rootGradlePath, rootGradle, 'utf8');
      console.log('Added com.google.gms:google-services classpath to android/build.gradle');
    }
  }

  // Ensure android/app/build.gradle applies google-services plugin when google-services.json exists
  const appGradlePath = path.resolve('android/app/build.gradle');
  if (fs.existsSync(appGradlePath)) {
    let appGradle = fs.readFileSync(appGradlePath, 'utf8');
    if (!appGradle.includes('com.google.gms.google-services')) {
      appGradle += `\napply plugin: 'com.google.gms.google-services'\n`;
      fs.writeFileSync(appGradlePath, appGradle, 'utf8');
      console.log('Applied com.google.gms.google-services plugin in android/app/build.gradle');
    }
  }
}

function configureAndroid() {
  const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');
  if (!fs.existsSync(manifestPath)) {
    console.warn('AndroidManifest.xml not found, skipping Android native injection.');
    return;
  }

  let xml = fs.readFileSync(manifestPath, 'utf8');

  // Ensure internet, network state, and Android 13+ Advertising ID permissions
  xml = ensurePermission(xml, 'android.permission.INTERNET');
  xml = ensurePermission(xml, 'android.permission.ACCESS_NETWORK_STATE');
  xml = ensurePermission(xml, 'com.google.android.gms.permission.AD_ID');

  // Inject or update Google AdMob APPLICATION_ID meta-data inside <application>
  const metaTag = `        <meta-data\n            android:name="com.google.android.gms.ads.APPLICATION_ID"\n            android:value="${ANDROID_APP_ID}" />`;
  if (xml.includes('com.google.android.gms.ads.APPLICATION_ID')) {
    xml = xml.replace(
      /<meta-data[\s\S]*?com\.google\.android\.gms\.ads\.APPLICATION_ID[\s\S]*?\/>/,
      metaTag
    );
  } else {
    xml = xml.replace('</application>', `${metaTag}\n    </application>`);
  }

  fs.writeFileSync(manifestPath, xml, 'utf8');
  console.log(`Configured Android AdMob App ID in AndroidManifest.xml (${ANDROID_APP_ID})`);

  configureAndroidFirebaseGradle();
}

function configureIos() {
  const plistPath = path.resolve('ios/App/App/Info.plist');
  if (!fs.existsSync(plistPath)) {
    console.warn('Info.plist not found, skipping iOS native injection.');
    return;
  }

  let plist = fs.readFileSync(plistPath, 'utf8');

  if (!plist.includes('GADApplicationIdentifier')) {
    const iosBlock = `	<key>GADApplicationIdentifier</key>
	<string>${IOS_APP_ID}</string>
	<key>NSUserTrackingUsageDescription</key>
	<string>Ludo Crown uses this permission only if you allow personalized ads; declining still gives you full gameplay with non-personalized ads.</string>
	<key>SKAdNetworkItems</key>
	<array>
		<dict>
			<key>SKAdNetworkIdentifier</key>
			<string>cstr6suwn9.skadnetwork</string>
		</dict>
	</array>
`;
    const lastDictIdx = plist.lastIndexOf('</dict>');
    if (lastDictIdx !== -1) {
      plist = plist.slice(0, lastDictIdx) + iosBlock + plist.slice(lastDictIdx);
    }
  }

  // If GoogleService-Info.plist was supplied, wire REVERSED_CLIENT_ID URL scheme for Google Sign-In
  const googlePlistPath = path.resolve('ios/App/App/GoogleService-Info.plist');
  if (fs.existsSync(googlePlistPath)) {
    const googlePlist = fs.readFileSync(googlePlistPath, 'utf8');
    const match = googlePlist.match(
      /<key>REVERSED_CLIENT_ID<\/key>\s*<string>([^<]+)<\/string>/
    );
    const reversedClientId = match?.[1]?.trim();
    if (reversedClientId && !plist.includes(reversedClientId)) {
      const urlTypeBlock = `	<key>CFBundleURLTypes</key>
	<array>
		<dict>
			<key>CFBundleTypeRole</key>
			<string>Editor</string>
			<key>CFBundleURLSchemes</key>
			<array>
				<string>${reversedClientId}</string>
			</array>
		</dict>
	</array>
`;
      const lastDictIdx = plist.lastIndexOf('</dict>');
      if (lastDictIdx !== -1) {
        plist = plist.slice(0, lastDictIdx) + urlTypeBlock + plist.slice(lastDictIdx);
        console.log('Injected Google Sign-In REVERSED_CLIENT_ID URL scheme into iOS Info.plist');
      }
    }
  }

  fs.writeFileSync(plistPath, plist, 'utf8');
  console.log(`Configured iOS AdMob App ID & ATT keys in Info.plist (${IOS_APP_ID})`);
}

if (target === 'android' || target === 'all') configureAndroid();
if (target === 'ios' || target === 'all') configureIos();

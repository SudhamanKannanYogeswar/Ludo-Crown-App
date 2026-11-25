import fs from 'node:fs';
import path from 'node:path';

const target = (process.argv[2] || 'all').toLowerCase();

const ANDROID_APP_ID =
  (process.env.ADMOB_ANDROID_APP_ID || '').trim() ||
  'ca-app-pub-3940256099942544~3347511713';

const IOS_APP_ID =
  (process.env.ADMOB_IOS_APP_ID || '').trim() ||
  'ca-app-pub-3940256099942544~1458002511';

function configureAndroid() {
  const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');
  if (!fs.existsSync(manifestPath)) {
    console.warn('AndroidManifest.xml not found, skipping Android AdMob injection.');
    return;
  }

  let xml = fs.readFileSync(manifestPath, 'utf8');

  // Ensure Android 13+ Advertising ID permission (required for Google Play AdMob)
  if (!xml.includes('com.google.android.gms.permission.AD_ID')) {
    xml = xml.replace(
      '<application',
      '    <uses-permission android:name="com.google.android.gms.permission.AD_ID" />\n\n    <application'
    );
  }

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
}

function configureIos() {
  const plistPath = path.resolve('ios/App/App/Info.plist');
  if (!fs.existsSync(plistPath)) {
    console.warn('Info.plist not found, skipping iOS AdMob injection.');
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

  fs.writeFileSync(plistPath, plist, 'utf8');
  console.log(`Configured iOS AdMob App ID & ATT keys in Info.plist (${IOS_APP_ID})`);
}

if (target === 'android' || target === 'all') configureAndroid();
if (target === 'ios' || target === 'all') configureIos();

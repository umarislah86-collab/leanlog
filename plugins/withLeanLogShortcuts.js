const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SHORTCUT_META_NAME = 'android.app.shortcuts';

module.exports = function withLeanLogShortcuts(config) {
  config = withAndroidManifest(config, (mod) => {
    const application = mod.modResults.manifest.application?.[0];
    const activities = application?.activity || [];
    const mainActivity = activities.find((activity) =>
      (activity['intent-filter'] || []).some((filter) =>
        (filter.category || []).some((category) => category.$?.['android:name'] === 'android.intent.category.LAUNCHER'),
      ),
    );
    if (!mainActivity) throw new Error('LeanLog launcher activity was not found.');
    mainActivity['meta-data'] = (mainActivity['meta-data'] || []).filter(
      (item) => item.$?.['android:name'] !== SHORTCUT_META_NAME,
    );
    mainActivity['meta-data'].push({
      $: {
        'android:name': SHORTCUT_META_NAME,
        'android:resource': '@xml/leanlog_shortcuts',
      },
    });
    return mod;
  });

  return withDangerousMod(config, ['android', async (mod) => {
    const packageName = config.android?.package;
    if (!packageName) throw new Error('LeanLog Android package name is missing.');
    const resourceRoot = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
    const xmlDir = path.join(resourceRoot, 'xml');
    const valuesDir = path.join(resourceRoot, 'values');
    fs.mkdirSync(xmlDir, { recursive: true });
    fs.mkdirSync(valuesDir, { recursive: true });
    fs.writeFileSync(path.join(xmlDir, 'leanlog_shortcuts.xml'), `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut android:shortcutId="leanlog_food" android:enabled="true" android:icon="@mipmap/ic_launcher" android:shortcutShortLabel="@string/shortcut_log_food" android:shortcutLongLabel="@string/shortcut_log_food_long">
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${packageName}" android:targetClass="${packageName}.MainActivity" android:data="leanlog://quick/food" />
  </shortcut>
  <shortcut android:shortcutId="leanlog_money" android:enabled="true" android:icon="@mipmap/ic_launcher" android:shortcutShortLabel="@string/shortcut_log_money" android:shortcutLongLabel="@string/shortcut_log_money_long">
    <intent android:action="android.intent.action.VIEW" android:targetPackage="${packageName}" android:targetClass="${packageName}.MainActivity" android:data="leanlog://redcoins/expense" />
  </shortcut>
</shortcuts>
`);
    fs.writeFileSync(path.join(valuesDir, 'leanlog_shortcut_strings.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="shortcut_log_food">Log makanan</string>
  <string name="shortcut_log_food_long">Tambah makanan ke LeanLog</string>
  <string name="shortcut_log_money">Log duit</string>
  <string name="shortcut_log_money_long">Tambah transaksi RedCoins</string>
</resources>
`);
    return mod;
  }]);
};

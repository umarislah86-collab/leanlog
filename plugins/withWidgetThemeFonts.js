const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs'); const path = require('path');
module.exports = config => withDangerousMod(config, ['android', async mod => {
  const destination = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/assets/fonts');
  fs.mkdirSync(destination, { recursive: true });
  for (const [packageName, family] of [['lora', 'Lora'], ['manrope', 'Manrope'], ['space-grotesk', 'SpaceGrotesk']]) {
    for (const [weight, face] of [[400, 'Regular'], [500, 'Medium'], [700, 'Bold']]) {
      const source = require.resolve(`@expo-google-fonts/${packageName}/${weight}${face}/${family}_${weight}${face}.ttf`);
      fs.copyFileSync(source, path.join(destination, `LeanLog${family}${face}.ttf`));
    }
  }
  return mod;
}]);

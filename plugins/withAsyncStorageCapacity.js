const { withGradleProperties } = require('@expo/config-plugins');

module.exports = config => withGradleProperties(config, mod => {
  // Headroom for existing legacy checkpoints and ordinary preferences.
  // New finance recovery snapshots live in RedCoins SQLite, not AsyncStorage.
  mod.modResults = mod.modResults.filter(item => item.key !== 'AsyncStorage_db_size_in_MB');
  mod.modResults.push({ type: 'property', key: 'AsyncStorage_db_size_in_MB', value: '32' });
  return mod;
});

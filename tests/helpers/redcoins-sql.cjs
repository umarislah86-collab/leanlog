const { DatabaseSync } = require('node:sqlite');
/** Real SQLite engine behind Expo's asynchronous interface, not a map fake. */
function sqliteHarness() {
  const db = new DatabaseSync(':memory:');
  const writes = [];
  let failure = null;
  let chain = Promise.resolve();
  const args = values => values.length === 1 && Array.isArray(values[0]) ? values[0] : values;
  const run = (sql, values) => {
    if (failure) failure(sql, values);
    writes.push({ sql, args: values });
    return db.prepare(sql).run(...values);
  };
  const api = {
    execAsync: async sql => db.exec(sql),
    getFirstAsync: async (sql, ...values) => db.prepare(sql).get(...args(values)) || null,
    getAllAsync: async (sql, ...values) => db.prepare(sql).all(...args(values)),
    runAsync: async (sql, ...values) => run(sql, args(values)),
    prepareAsync: async sql => ({ executeAsync: async (...values) => run(sql, args(values)), finalizeAsync: async () => {} }),
    withExclusiveTransactionAsync: task => {
      const work = chain.catch(() => {}).then(async () => {
        db.exec('BEGIN IMMEDIATE');
        try { const result = await task(api); db.exec('COMMIT'); return result; }
        catch (error) { db.exec('ROLLBACK'); throw error; }
      });
      chain = work.catch(() => {});
      return work;
    },
  };
  return { expo: { openDatabaseAsync: async () => api }, db, writes, fail: callback => { failure = callback; } };
}
module.exports = { sqliteHarness };

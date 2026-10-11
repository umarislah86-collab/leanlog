const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const exportsTiming = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../services/workoutTiming.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exportsTiming, Date });
const { remainingRestSeconds, isTimedExercise } = exportsTiming;
test('rest catches up after background suspension and expires at its deadline', () => {
 assert.equal(remainingRestSeconds(90000, 0), 90);
 assert.equal(remainingRestSeconds(90000, 61500), 29);
 assert.equal(remainingRestSeconds(90000, 90000), 0);
 assert.equal(remainingRestSeconds(90000, 200000), 0);
 assert.equal(remainingRestSeconds(null, 0), 0);
});
test('extension uses actual remaining time rather than a frozen display', () => {
 const actual = remainingRestSeconds(90000, 60000);
 const extended = 60000 + (actual + 30) * 1000;
 assert.equal(remainingRestSeconds(extended, 60000), 60);
});
test('strength rows use reps while explicit rowing cardio uses timer', () => {
 for (const name of ['Seated Row', 'Cable Row', 'Bent-over Barbell Row', 'Dumbbell Row', 'Bench Press']) assert.equal(isTimedExercise(name), false, name);
 for (const name of ['Rowing Machine', 'Rower', 'Treadmill Walk', 'Plank', 'Jump Rope']) assert.equal(isTimedExercise(name), true, name);
});

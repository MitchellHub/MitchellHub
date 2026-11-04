const test = require('node:test');
const assert = require('node:assert');
const M = require('./model.js');
const D = require('./data.js');

const g = D.govt;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const clone = o => JSON.parse(JSON.stringify(o));

test('income tax 2026-27 incl. Medicare', () => {
  // 110k: 4,020 + 19,500 + 2,200 Medicare
  near(M.incomeTax(110000, g), 25720, 1, '110k');
  // 130k: 4,020 + 25,500 + 2,600
  near(M.incomeTax(130000, g), 32120, 1, '130k');
  assert.strictEqual(M.incomeTax(18000, g), 0);
});

test('mortgage repayment matches standard P&I formula', () => {
  near(M.mortgagePayment(900000, 6.84, 30), 5891, 2, '900k @ 6.84% 30y');
  near(M.mortgagePayment(120000, 0, 10), 1000, 0.01, 'zero rate');
});

test('offset reduces interest and brings debt-free date forward', () => {
  const s = clone(D);
  s.other = [];
  const sc = { kids: 0, firstIn: 1, gap: 2, profile: 'min', school: 'public', ccDays: 0, oshcDays: 0 };
  s.mortgage.offset = 0;
  const a = M.simulate(s, sc);
  s.mortgage.offset = 60000;
  const b = M.simulate(s, sc);
  assert.ok(b.rows[0].interest < a.rows[0].interest);
  assert.ok(b.debtFreeMonth < a.debtFreeMonth);
});

test('CCS percentage taper', () => {
  assert.strictEqual(M.ccsPct(80000, g, false), 90);
  assert.strictEqual(M.ccsPct(188000, g, false), 69);
  assert.strictEqual(M.ccsPct(240000, g, false), 59);
  assert.strictEqual(M.ccsPct(600000, g, false), 0);
  assert.strictEqual(M.ccsPct(240000, g, true), 89);
});

test('FTB is nil at high family income', () => {
  const f = M.ftbAnnual(240000, 130000, 110000, [1], g);
  assert.strictEqual(f.a, 0);
  assert.strictEqual(f.b, 0);
  assert.ok(M.ftbAnnual(60000, 60000, 0, [1], g).a > 6000);
});

test('primary carer leave: PLP then part-time return', () => {
  const segs = M.leaveSegments(D.leave, true);
  const firstMonth = M.monthLeave(segs, 0);
  assert.strictEqual(firstMonth.factor, 1); // employer leave at 100%
  const plpMonth = M.monthLeave(segs, 20);
  near(plpMonth.factor, 0, 1e-9, 'on PLP');
  near(plpMonth.plp, 1, 1e-9, 'plp fraction');
  near(M.monthLeave(segs, 100).factor, 0.6, 1e-9, 'part time');
  assert.strictEqual(M.monthLeave(segs, 5 * 52 + 1).factor, 1);
  assert.strictEqual(M.monthLeave(segs, -20).factor, 1);
});

test('kids reduce wealth; minimum costs less than typical', () => {
  const s = clone(D);
  const [none, one, , twoTyp] = s.scenarios.map(sc => M.simulate(s, sc));
  const twoMin = M.simulate(s, s.scenarios[2]);
  const end = r => r.rows[r.rows.length - 1].netPos;
  assert.ok(end(none) > end(one));
  assert.ok(end(one) > end(twoMin));
  assert.ok(end(twoMin) > end(twoTyp));
  const sum = M.summarize(one, none);
  assert.ok(sum.kidCosts > 0 && sum.incomeLost > 0 && sum.superLost > 0);
});

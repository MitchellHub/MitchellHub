/* Kids cost & income model. Pure functions, no DOM.
 * Monthly steps. Money in nominal AUD; each month also carries a price index
 * so the UI can show today's dollars. */
(function (root) {
  const WEEKS_PER_MONTH = 52 / 12;

  // ---------- Tax ----------
  function lito(taxable) {
    if (taxable <= 37500) return 700;
    if (taxable <= 45000) return 700 - 0.05 * (taxable - 37500);
    if (taxable <= 66667) return Math.max(0, 325 - 0.015 * (taxable - 45000));
    return 0;
  }

  function incomeTax(taxable, g) {
    const b = g.taxBrackets;
    let tax = 0;
    for (let i = 0; i < b.length; i++) {
      const lo = b[i].from;
      const hi = i + 1 < b.length ? b[i + 1].from : Infinity;
      if (taxable > lo) tax += (Math.min(taxable, hi) - lo) * b[i].rate;
    }
    tax = Math.max(0, tax - lito(taxable));
    const low = g.medicareLowThreshold;
    let medicare = 0;
    if (taxable > low * 1.25) medicare = taxable * g.medicare;
    else if (taxable > low) medicare = (taxable - low) * 0.1;
    return tax + medicare;
  }

  // ---------- Mortgage ----------
  function mortgagePayment(principal, ratePct, years) {
    const r = ratePct / 100 / 12;
    const n = years * 12;
    if (principal <= 0) return 0;
    if (r === 0) return principal / n;
    return principal * r / (1 - Math.pow(1 + r, -n));
  }

  // ---------- Child Care Subsidy ----------
  function ccsPct(ati, g, higher) {
    let pct;
    if (ati <= g.ccsLowerThreshold) pct = g.ccsMaxPct;
    else pct = Math.max(0, g.ccsMaxPct - Math.ceil((ati - g.ccsLowerThreshold) / g.ccsStep));
    if (higher && ati < g.ccsHigherRateLimit) pct = Math.min(95, pct + 30);
    return pct;
  }

  // ---------- Family Tax Benefit (annual, simplified) ----------
  function ftbAnnual(familyAti, primaryAti, secondaryAti, ages, g) {
    const kids = ages.filter(a => a >= 0 && a < 18);
    if (!kids.length) return { a: 0, b: 0 };
    const A = g.ftbA;
    const maxSum = kids.reduce((s, a) => s + (a < 13 ? A.maxUnder13 : A.max13plus), 0);
    const baseSum = kids.length * A.base;
    const m1 = Math.max(0, maxSum - 0.2 * Math.max(0, familyAti - A.freeArea));
    const m2 = Math.max(0, baseSum - 0.3 * Math.max(0, familyAti - A.baseFreeArea));
    let a = Math.max(m1, m2);
    if (familyAti <= A.supplementLimit) a += kids.length * A.supplement;
    const B = g.ftbB;
    const youngest = Math.min(...kids);
    let b = 0;
    if (primaryAti <= B.primaryLimit && youngest < 13) {
      const max = youngest < 5 ? B.maxUnder5 : B.max5to12;
      b = Math.max(0, max - 0.2 * Math.max(0, secondaryAti - B.secondaryFreeArea));
    }
    return { a, b };
  }

  // ---------- Leave ----------
  // Segment: [fromWeek, toWeek, salaryFactor, isPlp]
  function leaveSegments(L, isPrimary) {
    if (isPrimary) {
      const e = L.employerWeeks, p = L.plpWeeks, u = L.unpaidWeeks;
      const back = e + p + u;
      const segs = [
        [0, e, L.employerPct / 100, false],
        [e, e + p, 0, true],
        [e + p, back, 0, false]
      ];
      if (L.fteUntilAge * 52 > back) segs.push([back, L.fteUntilAge * 52, L.returnFte / 100, false]);
      return segs;
    }
    const s = L.partnerPaidWeeks;
    return [[s, s + L.partnerPlpWeeks, 0, true]];
  }

  // Salary factor and PLP fraction for one kid in one month.
  // w0 = kid age in weeks at month start (can be negative).
  function monthLeave(segs, w0) {
    const w1 = w0 + WEEKS_PER_MONTH;
    let lost = 0, plp = 0;
    for (const [a, b, f, isPlp] of segs) {
      const lo = Math.max(a, w0, 0), hi = Math.min(b, w1);
      if (hi <= lo) continue;
      const frac = (hi - lo) / WEEKS_PER_MONTH;
      lost += frac * (1 - f);
      if (isPlp) plp += frac;
    }
    return { factor: 1 - lost, plp };
  }

  function band(age) {
    if (age < 1) return 'baby';
    if (age < 5) return 'toddler';
    if (age < 12) return 'primary';
    return 'secondary';
  }

  function sumObj(o) { return Object.values(o).reduce((s, v) => s + (+v || 0), 0); }

  // ---------- Simulation ----------
  function simulate(state, sc) {
    const H = state.household, M = state.mortgage, L = state.leave, C = state.childcare, g = state.govt;
    const months = Math.round(H.horizonYears * 12);
    const wg = H.wageGrowth / 100, inf = H.inflation / 100;
    const births = [];
    for (let k = 0; k < sc.kids; k++) births.push(sc.firstIn + k * sc.gap);
    const people = [
      { key: 'A', gross: H.personA.gross },
      { key: 'B', gross: H.personB.gross }
    ];
    const familyBase = people[0].gross + people[1].gross;
    const returnWeek = L.employerWeeks + L.plpWeeks + L.unpaidWeeks;
    const costs = state.kidCosts[sc.profile] || state.kidCosts.min;
    const fees = state.schoolFees[sc.school] || state.schoolFees.public;

    // Pass 1: gross income per month
    const rows = [];
    for (let i = 0; i < months; i++) {
      const t = i / 12;
      const wIdx = Math.pow(1 + wg, t), pIdx = Math.pow(1 + inf, t);
      const ages = births.map(b => t - b);
      const row = { i, t, pIdx, ages, salary: [0, 0], plp: [0, 0], factor: [1, 1] };
      people.forEach((p, j) => {
        const segs = leaveSegments(L, L.primary === p.key);
        let factor = 1, plp = 0;
        ages.forEach(a => {
          const m = monthLeave(segs, a * 52);
          factor = Math.min(factor, m.factor);
          plp = Math.max(plp, m.plp);
        });
        const eligible = p.gross <= g.plpIndividualLimit || familyBase <= g.plpFamilyLimit;
        row.factor[j] = factor;
        row.salary[j] = p.gross * wIdx / 12 * factor;
        row.plp[j] = eligible ? g.plpWeekly * pIdx * plp * WEEKS_PER_MONTH : 0;
      });
      rows.push(row);
    }

    // Pass 2: tax per 12-month block, allocated by income share
    const blocks = [];
    for (let s = 0; s < months; s += 12) {
      const slice = rows.slice(s, s + 12);
      const scale = 12 / slice.length;
      const taxable = [0, 1].map(j => slice.reduce((x, r) => x + r.salary[j] + r.plp[j], 0) * scale);
      const tax = taxable.map(x => incomeTax(x, g));
      blocks.push({ taxable, tax, family: taxable[0] + taxable[1] });
      slice.forEach(r => {
        r.tax = [0, 1].map(j => {
          const inc = r.salary[j] + r.plp[j];
          return taxable[j] > 0 ? tax[j] * (inc * scale) / taxable[j] : 0;
        });
        r.block = blocks[blocks.length - 1];
      });
    }

    // Pass 3: cash flow
    const payment = mortgagePayment(M.balance, M.rate, M.termYears);
    const r = M.rate / 100 / 12;
    let bal = M.balance, offset = M.offset;
    let debtFreeMonth = null;
    const primaryIdx = L.primary === 'A' ? 0 : 1;

    rows.forEach(row => {
      const { pIdx, ages, block } = row;
      const net = [0, 1].map(j => row.salary[j] + row.plp[j] - row.tax[j]);
      const superC = g.superRate * (row.salary[0] + row.salary[1] + row.plp[0] + row.plp[1]);

      // Kid running costs + school fees
      let kidCost = 0;
      ages.forEach(a => {
        if (a < 0 || a >= 18) return;
        const b = band(a);
        kidCost += sumObj(costs[b]) * pIdx / 12;
        if (b === 'primary') kidCost += fees.primary * pIdx / 12;
        if (b === 'secondary') kidCost += fees.secondary * pIdx / 12;
      });

      // Childcare
      let ccFee = 0, ccSub = 0, ldcCount = 0;
      const working = row.factor[primaryIdx] > 0;
      const order = ages.map((a, k) => ({ a, k })).filter(x => x.a >= 0).sort((x, y) => y.a - x.a);
      order.forEach(({ a }) => {
        const mid = a + 1 / 24;
        if (mid * 52 >= returnWeek && mid < 5 && working && sc.ccDays > 0) {
          const higher = ldcCount > 0;
          ldcCount++;
          const pct = ccsPct(block.family, g, higher) / 100;
          const fee = C.dayFee * pIdx, cap = g.ccsHourlyCapLDC * pIdx;
          ccFee += sc.ccDays * fee * C.weeksPerYear / 12;
          ccSub += sc.ccDays * C.hoursPerDay * pct * Math.min(fee / C.hoursPerDay, cap) * C.weeksPerYear / 12;
        } else if (mid >= 5 && mid < 12 && sc.oshcDays > 0) {
          const pct = ccsPct(block.family, g, false) / 100;
          const fee = C.oshcFee * pIdx, cap = g.ccsHourlyCapOSHC * pIdx;
          ccFee += sc.oshcDays * fee * C.oshcWeeksPerYear / 12;
          ccSub += sc.oshcDays * C.oshcHours * pct * Math.min(fee / C.oshcHours, cap) * C.oshcWeeksPerYear / 12;
        }
      });

      // FTB
      const hi = Math.max(...block.taxable), lo = Math.min(...block.taxable);
      const ftb = ftbAnnual(block.family, hi, lo, ages, g);
      const ftbM = (ftb.a + ftb.b) / 12;

      // Other items
      let otherIn = 0, otherOut = 0;
      (state.other || []).forEach(o => {
        if (row.t < o.fromYear || row.t >= o.toYear) return;
        const v = o.monthly * pIdx;
        if (v >= 0) otherIn += v; else otherOut -= v;
      });

      // Mortgage with offset
      let mPay = 0;
      if (bal > 0.005) {
        const interest = Math.max(0, bal - offset) * r;
        mPay = Math.min(payment, bal + interest);
        bal = bal + interest - mPay;
        row.interest = interest;
      } else { bal = 0; row.interest = 0; }

      const income = net[0] + net[1] + ftbM + otherIn;
      const childcare = ccFee - ccSub;
      const spend = mPay + otherOut + kidCost + childcare;
      const surplus = income - spend;
      offset += surplus;
      if (debtFreeMonth === null && offset >= bal) debtFreeMonth = row.i;

      Object.assign(row, {
        net, netIncome: net[0] + net[1], superC, kidCost, ccFee, ccSub, childcare, ftb: ftbM,
        otherIn, otherOut, mortgage: mPay, income, spend, surplus,
        balance: bal, offset, netPos: offset - bal
      });
    });

    return { scenario: sc, rows, payment, debtFreeMonth };
  }

  function summarize(res, base) {
    const rows = res.rows;
    const real = (r, k) => r[k] / r.pIdx;
    const sum = (k, rr = rows) => rr.reduce((s, r) => s + real(r, k), 0);
    let minAvg = Infinity, minAt = 0;
    for (let i = 0; i + 12 <= rows.length; i += 1) {
      const avg = rows.slice(i, i + 12).reduce((s, r) => s + real(r, 'surplus'), 0) / 12;
      if (avg < minAvg) { minAvg = avg; minAt = i; }
    }
    let minMonth = Infinity, minMonthAt = 0;
    rows.forEach(r => { const v = real(r, 'surplus'); if (v < minMonth) { minMonth = v; minMonthAt = r.i; } });
    const lowestOffset = Math.min(...rows.map(r => r.offset));
    const at = y => { const r = rows[Math.min(rows.length - 1, y * 12 - 1)]; return r ? real(r, 'netPos') : null; };
    const s = {
      surplusNow: real(rows[0], 'surplus'),
      minAvgSurplus: minAvg, minAvgAt: minAt,
      minMonthSurplus: minMonth, minMonthAt,
      lowestOffset,
      netPos5: at(5), netPos10: at(10), netPosEnd: at(rows.length / 12),
      debtFreeMonth: res.debtFreeMonth,
      kidCosts: sum('kidCost') + sum('childcare') - sum('ftb'),
      incomeLost: base ? sum('netIncome', base.rows) - sum('netIncome') : 0,
      superLost: base ? sum('superC', base.rows) - sum('superC') : 0
    };
    s.status = lowestOffset < 0 ? 'bad' : (minAvg < 0 ? 'tight' : 'ok');
    return s;
  }

  const api = { incomeTax, lito, mortgagePayment, ccsPct, ftbAnnual, leaveSegments, monthLeave, band, simulate, summarize };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KidsModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

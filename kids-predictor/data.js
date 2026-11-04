/* Default assumptions. AUD, 2026-27 values unless noted.
 * All values are estimates. Every value can be changed in the app.
 * Figures in "household" and "mortgage" are generic examples, not real data. */
(function (root) {
  const DEFAULTS = {
    version: 1,
    household: {
      personA: { name: 'Partner A', gross: 100000 },
      personB: { name: 'Partner B', gross: 120000 },
      wageGrowth: 3.0,   // % per year
      inflation: 3.0,    // % per year (CPI)
      horizonYears: 20,
      todaysDollars: true
    },
    mortgage: {
      balance: 700000,
      rate: 6.2,         // % per year, variable
      termYears: 30,
      offset: 30000
    },
    // Monthly amounts in today's dollars. Negative = cost, positive = extra income (after tax).
    other: [
      { name: 'Living costs (food, bills, cars, insurance)', monthly: -4500, fromYear: 0, toYear: 99 }
    ],
    leave: {
      primary: 'A',            // who takes the main leave: 'A' or 'B'
      employerWeeks: 12,       // employer paid parental leave
      employerPct: 100,        // % of salary while on employer leave
      plpWeeks: 22,            // Govt Paid Parental Leave weeks taken by primary carer
      unpaidWeeks: 16,         // unpaid leave after PLP
      returnFte: 60,           // % of full time on return to work
      fteUntilAge: 5,          // back to full time when youngest kid reaches this age
      partnerPaidWeeks: 2,     // partner's employer paid leave (no income change)
      partnerPlpWeeks: 4       // partner's share of Govt PLP (replaces salary)
    },
    childcare: {
      dayFee: 140,             // long day care, $/day, Hunter region estimate
      hoursPerDay: 10,
      weeksPerYear: 50,
      oshcFee: 38,             // before/after school care, $/day
      oshcHours: 4,
      oshcWeeksPerYear: 40
    },
    // Government settings (estimates for 2026-27, indexed values rounded)
    govt: {
      taxBrackets: [            // resident rates from 1 July 2026
        { from: 0, rate: 0 },
        { from: 18200, rate: 0.15 },
        { from: 45000, rate: 0.30 },
        { from: 135000, rate: 0.37 },
        { from: 190000, rate: 0.45 }
      ],
      medicare: 0.02,
      medicareLowThreshold: 27222,
      superRate: 0.12,
      plpWeekly: 981,           // national minimum wage per week (est. 2026-27)
      plpIndividualLimit: 175000,
      plpFamilyLimit: 380000,
      ccsLowerThreshold: 85279,
      ccsMaxPct: 90,
      ccsStep: 5000,
      ccsHigherRateLimit: 367563,
      ccsHourlyCapLDC: 15.04,
      ccsHourlyCapOSHC: 13.17,
      ftbA: { maxUnder13: 6200, max13plus: 8050, base: 2000, supplement: 916,
              supplementLimit: 80000, freeArea: 65189, baseFreeArea: 115997 },
      ftbB: { maxUnder5: 4600, max5to12: 3200, primaryLimit: 117194, secondaryFreeArea: 6789 }
    },
    // Annual cost per kid, today's dollars, excluding childcare and school fees.
    // Bands: baby (<1), toddler (1-4), primary (5-11), secondary (12-17).
    kidCosts: {
      min: {
        label: 'Absolute minimum',
        note: 'Second-hand gear, home food, public school, few extras.',
        baby:      { food: 1200, nappies: 1300, clothing: 300,  health: 300,  gear: 600,  activities: 0,    other: 300 },
        toddler:   { food: 2400, nappies: 500,  clothing: 400,  health: 400,  gear: 200,  activities: 200,  other: 400 },
        primary:   { food: 3600, nappies: 0,    clothing: 600,  health: 500,  gear: 900,  activities: 400,  other: 700 },
        secondary: { food: 5000, nappies: 0,    clothing: 900,  health: 700,  gear: 1900, activities: 600,  other: 1300 }
      },
      typical: {
        label: 'Typical (AU data)',
        note: 'Middle-income family spend. Based on AIFS / NATSEM Cost of Kids, indexed to 2026.',
        baby:      { food: 1800, nappies: 1600, clothing: 900,  health: 600,  gear: 2500, activities: 400,  other: 800 },
        toddler:   { food: 3400, nappies: 600,  clothing: 1100, health: 800,  gear: 600,  activities: 1000, other: 1200 },
        primary:   { food: 4800, nappies: 0,    clothing: 1300, health: 1000, gear: 1800, activities: 2500, other: 2700 },
        secondary: { food: 7000, nappies: 0,    clothing: 1800, health: 1500, gear: 4000, activities: 3000, other: 4000 }
      }
    },
    // School tuition per year, today's dollars (Hunter estimates)
    schoolFees: {
      public:      { primary: 0,     secondary: 0,     label: 'Public' },
      catholic:    { primary: 3500,  secondary: 6500,  label: 'Catholic' },
      independent: { primary: 12000, secondary: 20000, label: 'Independent' }
    },
    scenarios: [
      { name: 'No kids',            kids: 0, firstIn: 1, gap: 2.5, profile: 'min',     school: 'public', ccDays: 3, oshcDays: 2 },
      { name: '1 kid · minimum',    kids: 1, firstIn: 1, gap: 2.5, profile: 'min',     school: 'public', ccDays: 3, oshcDays: 2 },
      { name: '2 kids · minimum',   kids: 2, firstIn: 1, gap: 2.5, profile: 'min',     school: 'public', ccDays: 3, oshcDays: 2 },
      { name: '2 kids · typical',   kids: 2, firstIn: 1, gap: 2.5, profile: 'typical', school: 'public', ccDays: 3, oshcDays: 2 },
      { name: '3 kids · typical',   kids: 3, firstIn: 1, gap: 2.5, profile: 'typical', school: 'catholic', ccDays: 3, oshcDays: 2 }
    ],
    tracker: []
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DEFAULTS;
  else root.KIDS_DEFAULTS = DEFAULTS;
})(typeof globalThis !== 'undefined' ? globalThis : this);

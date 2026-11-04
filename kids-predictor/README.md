# Kids Runway

Plan the money side of having kids. Static web app: no install, no server, no build.

## Use
- Open `index.html` in a browser. Data stays in that browser (localStorage).
- **Plan**: compare scenarios (0–3+ kids, timing, lifestyle, school, childcare days).
- **Tracker**: log real monthly take-home, spending and offset. Compare with the plan.
- **Assumptions**: change any value. Backup: copy / paste text.

## What it models (monthly, 20 years)
- Income tax 2026-27 resident rates, LITO, Medicare levy. Wage growth.
- P&I mortgage with offset. All spare cash goes to the offset.
- Parental leave: employer paid leave, Govt Paid Parental Leave (min. wage), unpaid leave, part-time return.
- Childcare and before/after school care, less Child Care Subsidy (income taper, higher rate for 2nd child, hourly caps).
- Kid running costs by age band: "Absolute minimum" and "Typical" (AIFS / NATSEM Cost of Kids, indexed).
- School fees: public / Catholic / independent. Family Tax Benefit A and B (simplified).
- Super lost from time off work.

All defaults are estimates. Not financial advice.

## Personal build
Keep real figures out of git. Put them in a JSON file outside the repo, then:

```
node build.js out.html my-figures.json        # one self-contained file
node build.js out.artifact.html my-figures.json  # fragment for claude.ai pages
```

`my-figures.json` example: `{"household":{"personA":{"gross":100000}},"mortgage":{"balance":700000,"rate":6.2}}`

## Test
```
node --test model.test.js
```

export interface CashFlow {
  date: Date;
  amount: number;
  description?: string;
}

export interface MethodResult {
  rate: number;
  ratePercent: string;
  iterations: number;
  method: string;
  converged: boolean;
  finalNPV: number;
}

export interface XIRRResult {
  xirr: number;
  xirrPercent: string;
  simpleReturn: number;
  simpleReturnPercent: string;
  annualized: boolean;
  totalDays: number;
  netCashFlow: number;
  firstCashFlow: number;
  lastCashFlow: number;
  totalInflows: number;
  totalOutflows: number;
  newtonRaphson: MethodResult;
  brent: MethodResult;
  hasDifference: boolean;
  difference: number;
  differencePercent: string;
}

function dateDiffInDays(date1: Date, date2: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const utc2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return Math.abs((utc2 - utc1) / msPerDay);
}

function calculateNPV(rate: number, cashFlows: CashFlow[], startDate: Date): number {
  let npv = 0;
  for (const flow of cashFlows) {
    const days = dateDiffInDays(startDate, flow.date);
    const years = days / 365.25;
    npv += flow.amount / Math.pow(1 + rate, years);
  }
  return npv;
}

function calculateDerivativeNPV(rate: number, cashFlows: CashFlow[], startDate: Date): number {
  let dnpv = 0;
  for (const flow of cashFlows) {
    const days = dateDiffInDays(startDate, flow.date);
    const years = days / 365.25;
    dnpv += (-years * flow.amount) / Math.pow(1 + rate, years + 1);
  }
  return dnpv;
}

function calculateWithNewtonRaphson(
  cashFlows: CashFlow[],
  startDate: Date,
  initialGuess: number = 0.1
): MethodResult {
  let rate = initialGuess;
  const maxIterations = 100;
  const precision = 0.000001;
  let iterations = 0;
  let converged = false;

  for (iterations = 0; iterations < maxIterations; iterations++) {
    const npv = calculateNPV(rate, cashFlows, startDate);

    if (Math.abs(npv) < precision) {
      converged = true;
      break;
    }

    const dnpv = calculateDerivativeNPV(rate, cashFlows, startDate);

    if (dnpv === 0) {
      break;
    }

    const newRate = rate - npv / dnpv;

    if (newRate <= -0.99) {
      rate = -0.99;
    } else {
      rate = newRate;
    }
  }

  const finalNPV = calculateNPV(rate, cashFlows, startDate);

  return {
    rate,
    ratePercent: (rate * 100).toFixed(6),
    iterations: iterations + 1,
    method: 'Newton-Raphson',
    converged,
    finalNPV
  };
}

function calculateWithBrent(
  cashFlows: CashFlow[],
  startDate: Date,
  lowerBound: number = -0.99,
  upperBound: number = 10.0
): MethodResult {
  const maxIterations = 100;
  const precision = 0.000001;
  let a = lowerBound;
  let b = upperBound;
  let c = a;
  let d = b - a;
  let e = d;

  let fa = calculateNPV(a, cashFlows, startDate);
  let fb = calculateNPV(b, cashFlows, startDate);
  let fc = fa;

  let iterations = 0;
  let converged = false;

  if (fa * fb >= 0) {
    a = -0.5;
    b = 5.0;
    fa = calculateNPV(a, cashFlows, startDate);
    fb = calculateNPV(b, cashFlows, startDate);
  }

  for (iterations = 0; iterations < maxIterations; iterations++) {
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }

    const tol = 2 * precision * Math.abs(b) + precision;
    const m = 0.5 * (c - b);

    if (Math.abs(m) <= tol || Math.abs(fb) < precision) {
      converged = true;
      break;
    }

    if (Math.abs(e) < tol || Math.abs(fa) <= Math.abs(fb)) {
      d = m;
      e = d;
    } else {
      const s = fb / fa;
      let p, q;

      if (a === c) {
        p = 2 * m * s;
        q = 1 - s;
      } else {
        q = fa / fc;
        const r = fb / fc;
        p = s * (2 * m * q * (q - r) - (b - a) * (r - 1));
        q = (q - 1) * (r - 1) * (s - 1);
      }

      if (p > 0) {
        q = -q;
      } else {
        p = -p;
      }

      const s2 = 2 * p;

      if (s2 < 3 * m * q - Math.abs(tol * q) && s2 < Math.abs(e * q)) {
        e = d;
        d = p / q;
      } else {
        d = m;
        e = d;
      }
    }

    a = b;
    fa = fb;

    if (Math.abs(d) > tol) {
      b += d;
    } else {
      b += m >= 0 ? tol : -tol;
    }

    fb = calculateNPV(b, cashFlows, startDate);

    if (fb * fc > 0) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
  }

  const finalNPV = calculateNPV(b, cashFlows, startDate);

  return {
    rate: b,
    ratePercent: (b * 100).toFixed(6),
    iterations: iterations + 1,
    method: "Brent's Method",
    converged,
    finalNPV
  };
}

export function calculateXIRR(cashFlows: CashFlow[]): XIRRResult | null {
  if (cashFlows.length < 2) {
    return null;
  }

  const sortedFlows = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const startDate = sortedFlows[0].date;
  const endDate = sortedFlows[sortedFlows.length - 1].date;
  const totalDays = dateDiffInDays(startDate, endDate);

  const netCashFlow = sortedFlows.reduce((sum, flow) => sum + flow.amount, 0);
  const outflows = sortedFlows.filter(f => f.amount < 0);
  const inflows = sortedFlows.filter(f => f.amount > 0);
  const totalOutflows = outflows.reduce((sum, flow) => sum + Math.abs(flow.amount), 0);
  const totalInflows = inflows.reduce((sum, flow) => sum + flow.amount, 0);

  const firstCashFlow = sortedFlows[0].amount;
  const lastCashFlow = sortedFlows[sortedFlows.length - 1].amount;

  if (lastCashFlow < 0 && netCashFlow < 0) {
    return null;
  }

  const newtonResult = calculateWithNewtonRaphson(sortedFlows, startDate);
  const brentResult = calculateWithBrent(sortedFlows, startDate);

  const bestResult = Math.abs(newtonResult.finalNPV) < Math.abs(brentResult.finalNPV) ? newtonResult : brentResult;
  const rate = bestResult.rate;

  const difference = Math.abs(newtonResult.rate - brentResult.rate);
  const hasDifference = difference > 0.00001;

  const annualized = totalDays > 365;
  const years = totalDays / 365.25;
  const simpleReturn = Math.pow(1 + rate, years) - 1;

  return {
    xirr: rate,
    xirrPercent: (rate * 100).toFixed(2),
    simpleReturn,
    simpleReturnPercent: (simpleReturn * 100).toFixed(2),
    annualized,
    totalDays,
    netCashFlow,
    firstCashFlow,
    lastCashFlow,
    totalInflows,
    totalOutflows,
    newtonRaphson: newtonResult,
    brent: brentResult,
    hasDifference,
    difference,
    differencePercent: (difference * 100).toFixed(6)
  };
}

export function filterCashFlowsByPeriod(cashFlows: CashFlow[], endDate: Date, years: number): CashFlow[] {
  const startDate = new Date(endDate);
  startDate.setFullYear(startDate.getFullYear() - years);

  const filtered = cashFlows.filter(cf => cf.date >= startDate && cf.date <= endDate);

  if (filtered.length === 0) {
    return [];
  }

  const sorted = [...filtered].sort((a, b) => a.date.getTime() - b.date.getTime());
  const firstDate = sorted[0].date;

  const flowsBeforeStart = cashFlows.filter(cf => cf.date < startDate);
  if (flowsBeforeStart.length > 0) {
    const openingBalance = flowsBeforeStart.reduce((sum, cf) => sum + cf.amount, 0);
    if (openingBalance !== 0) {
      sorted.unshift({ date: firstDate, amount: openingBalance, description: 'Opening Balance' });
    }
  }

  return sorted;
}

export function parseCSV(csvText: string): CashFlow[] {
  const lines = csvText.trim().split('\n');
  const cashFlows: CashFlow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 2) continue;

    const dateStr = parts[0].trim();
    const amountStr = parts[1].trim();
    const description = parts[2]?.trim() || '';

    const date = new Date(dateStr);
    const amount = parseFloat(amountStr);

    if (!isNaN(date.getTime()) && !isNaN(amount)) {
      cashFlows.push({ date, amount, description });
    }
  }

  return cashFlows;
}

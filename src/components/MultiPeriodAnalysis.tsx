import { useMemo } from 'react';
import { TrendingUp, Calendar, AlertCircle, DollarSign, GitCompare, CheckCircle2, AlertTriangle } from 'lucide-react';
import { CashFlow, calculateXIRR, filterCashFlowsByPeriod, XIRRResult } from '../utils/xirr';

interface PeriodResult {
  period: string;
  years: number;
  result: XIRRResult | null;
  error?: string;
}

interface MultiPeriodAnalysisProps {
  cashFlows: CashFlow[];
}

export function MultiPeriodAnalysis({ cashFlows }: MultiPeriodAnalysisProps) {
  const periodResults = useMemo<PeriodResult[]>(() => {
    if (cashFlows.length < 2) return [];

    const sortedFlows = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
    const endDate = sortedFlows[sortedFlows.length - 1].date;

    const periods = [
      { period: '1 Year', years: 1 },
      { period: '5 Years', years: 5 },
      { period: '10 Years', years: 10 },
    ];

    return periods.map(({ period, years }) => {
      const filteredFlows = filterCashFlowsByPeriod(cashFlows, endDate, years);

      if (filteredFlows.length < 2) {
        return {
          period,
          years,
          result: null,
          error: 'Insufficient data for this period'
        };
      }

      const xirrResult = calculateXIRR(filteredFlows);

      if (!xirrResult) {
        return {
          period,
          years,
          result: null,
          error: 'Unable to calculate (invalid cash flow pattern)'
        };
      }

      return {
        period,
        years,
        result: xirrResult,
      };
    });
  }, [cashFlows]);

  const methodStats = useMemo(() => {
    const validResults = periodResults.filter(pr => pr.result !== null);
    const totalCalculations = validResults.length;
    const mismatchedPeriods = validResults.filter(pr => pr.result?.hasDifference);
    const methodMismatches = mismatchedPeriods.length;
    const mismatchPeriodNames = mismatchedPeriods.map(pr => pr.period);
    return { totalCalculations, methodMismatches, mismatchPeriodNames };
  }, [periodResults]);

  if (cashFlows.length < 2) {
    return (
      <div className="p-8 text-center text-slate-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-400" />
        <p>Enter at least 2 cash flows to see multi-period analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2">
          <TrendingUp className="w-7 h-7 text-blue-600" />
          Multi-Period Performance Analysis
        </h2>
        <p className="text-slate-600 mt-2">Compare returns across different time horizons</p>
      </div>

      <div className="mb-6 p-4 bg-gradient-to-br from-slate-700 to-slate-800 text-white rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-300">Summary Statistics</p>
            <div className="mt-2 flex items-baseline gap-6">
              <div>
                <span className="text-3xl font-bold">{methodStats.totalCalculations}</span>
                <span className="text-sm text-slate-300 ml-2">Total Calculations</span>
              </div>
              <div>
                <span className={`text-3xl font-bold ${methodStats.methodMismatches > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                  {methodStats.methodMismatches}
                </span>
                <span className="text-sm text-slate-300 ml-2">Method Mismatches</span>
              </div>
            </div>
          </div>
          {methodStats.methodMismatches > 0 ? (
            <AlertTriangle className="w-12 h-12 text-amber-400 opacity-50" />
          ) : methodStats.totalCalculations > 0 ? (
            <CheckCircle2 className="w-12 h-12 text-green-400 opacity-50" />
          ) : null}
        </div>
        {methodStats.totalCalculations > 0 && (
          <p className="text-xs text-slate-400 mt-3">
            {methodStats.methodMismatches === 0
              ? 'All calculation methods agree on the results.'
              : `${methodStats.methodMismatches} out of ${methodStats.totalCalculations} calculations show differences between Newton-Raphson and Brent's method${methodStats.mismatchPeriodNames.length > 0 ? ` (${methodStats.mismatchPeriodNames.join(', ')})` : ''}.`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
        {periodResults.map((periodResult, index) => (
          <div
            key={periodResult.period}
            className="bg-white rounded-lg shadow overflow-hidden border border-slate-200 hover:border-blue-300 transition-colors"
          >
            <div className={`px-2 py-1.5 ${
              index === 0 ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
              index === 1 ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
              'bg-gradient-to-br from-slate-600 to-slate-700'
            }`}>
              <h3 className="text-xs font-bold text-white text-center">
                {periodResult.period}
              </h3>
            </div>

            <div className="p-2">
              {periodResult.error ? (
                <div className="flex items-start gap-1 p-2 bg-amber-50 border border-amber-200 rounded">
                  <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-medium text-amber-800">Not Available</p>
                  </div>
                </div>
              ) : periodResult.result ? (
                <div className="space-y-2">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded p-2 border border-green-200 text-center">
                    {periodResult.result.totalDays < 365 ? (
                      <>
                        <p className="text-[9px] text-slate-600 mb-0.5 font-medium">Simple Return</p>
                        <p className={`text-xl font-bold ${
                          parseFloat(periodResult.result.simpleReturnPercent) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {periodResult.result.simpleReturnPercent}%
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[9px] text-slate-600 mb-0.5 font-medium">XIRR</p>
                        <p className={`text-xl font-bold ${
                          parseFloat(periodResult.result.xirrPercent) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {periodResult.result.xirrPercent}%
                        </p>
                      </>
                    )}
                  </div>

                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Days</span>
                      <span className="font-semibold text-slate-800">
                        {periodResult.result.totalDays}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Net</span>
                      <span className={`font-semibold ${
                        periodResult.result.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${(periodResult.result.netCashFlow / 1000).toFixed(0)}k
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-600" />
          Understanding Multi-Period Analysis
        </h3>
        <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-700">
          <div>
            <h4 className="font-semibold text-slate-800 mb-2">What is XIRR?</h4>
            <p className="leading-relaxed">
              XIRR (Extended Internal Rate of Return) calculates the annualized rate of return
              accounting for the exact timing of each cash flow. For periods less than 12 months,
              we show the simple (non-annualized) return instead, as annualizing short periods
              can be misleading.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 mb-2">Why Multiple Periods?</h4>
            <p className="leading-relaxed">
              Comparing performance across 1, 5, and 10 years helps identify trends and volatility.
              Recent performance may differ significantly from long-term results, revealing important
              patterns in your investment strategy.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 mb-2">Opening Balances</h4>
            <p className="leading-relaxed">
              For periods that don't start at your first investment, the calculator automatically
              includes an opening balance representing all prior cash flows. This ensures accurate
              period-specific returns.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-800 mb-2">Data Requirements</h4>
            <p className="leading-relaxed">
              Your final cash flow should represent the current market value (positive number).
              Negative ending values indicate losses exceeding 100% and will produce invalid results.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-300 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-slate-600" />
          Calculation Method Comparison
        </h3>
        <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-700">
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
              Newton-Raphson Method
              <span className="text-xs font-normal text-slate-600">(Fast)</span>
            </h4>
            <p className="leading-relaxed mb-3">
              Uses calculus (derivatives) to rapidly converge to the solution. This is the same method
              used by Excel and Google Sheets for XIRR calculations.
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Very fast (typically 5-10 iterations)</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Industry standard approach</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
                <span>May struggle with unusual cash flow patterns</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-green-200">
            <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
              Brent's Method
              <span className="text-xs font-normal text-slate-600">(Robust)</span>
            </h4>
            <p className="leading-relaxed mb-3">
              Hybrid approach combining bisection with inverse quadratic interpolation. Used in scientific
              computing libraries for its reliability.
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Guaranteed convergence if solution exists</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Handles edge cases reliably</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-3 h-3 text-amber-600 mt-0.5 flex-shrink-0" />
                <span>Slightly more iterations needed</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-100 border border-blue-300 rounded-lg">
          <p className="text-sm text-slate-700 leading-relaxed">
            <span className="font-semibold text-slate-800">When they differ:</span> The calculator uses
            the result with the smaller final NPV (Net Present Value) error. Differences typically occur
            with complex cash flow patterns, multiple sign changes, or when there are multiple valid
            solutions. Both methods are mathematically correct, but Brent's method is more reliable
            in edge cases.
          </p>
        </div>
      </div>
    </div>
  );
}

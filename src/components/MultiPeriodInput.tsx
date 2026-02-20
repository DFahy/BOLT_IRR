import { useState } from 'react';
import { Plus, Trash2, TrendingUp, Calendar, AlertCircle, DollarSign, GitCompare, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { CashFlow, calculateXIRR, XIRRResult } from '../utils/xirr';

interface FlowInput {
  id: string;
  date: string;
  amount: string;
  description: string;
}

interface Period {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  startValue: string;
  endValue: string;
}

interface PeriodValues {
  periods: Period[];
}

interface MultiPeriodInputProps {
  periodValues: PeriodValues;
  setPeriodValues: (values: PeriodValues) => void;
  flows: FlowInput[];
  setFlows: (flows: FlowInput[]) => void;
  buildPeriodCashFlows: (startDate: string, endDate: string, startValue: string, endValue: string) => CashFlow[];
}

interface PeriodResult {
  period: string;
  startDate: string;
  endDate: string;
  years: number;
  cashFlows: CashFlow[];
  result: XIRRResult | null;
  error?: string;
}

export function MultiPeriodInput({
  periodValues,
  setPeriodValues,
  flows,
  setFlows,
  buildPeriodCashFlows
}: MultiPeriodInputProps) {
  const [showResults, setShowResults] = useState(false);
  const [periodsExpanded, setPeriodsExpanded] = useState(true);
  const [cashFlowsExpanded, setCashFlowsExpanded] = useState(true);

  const addFlow = () => {
    setFlows([...flows, {
      id: Date.now().toString(),
      date: '',
      amount: '',
      description: ''
    }]);
  };

  const removeFlow = (id: string) => {
    setFlows(flows.filter(f => f.id !== id));
  };

  const updateFlow = (id: string, field: keyof FlowInput, value: string) => {
    setFlows(flows.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const addPeriod = () => {
    const today = new Date().toISOString().split('T')[0];
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const startDate = oneYearAgo.toISOString().split('T')[0];

    const newPeriod: Period = {
      id: Date.now().toString(),
      label: `Period ${periodValues.periods.length + 1}`,
      startDate,
      endDate: today,
      startValue: '',
      endValue: ''
    };
    setPeriodValues({
      ...periodValues,
      periods: [...periodValues.periods, newPeriod]
    });
  };

  const removePeriod = (id: string) => {
    if (periodValues.periods.length > 1) {
      setPeriodValues({
        ...periodValues,
        periods: periodValues.periods.filter(p => p.id !== id)
      });
    }
  };

  const updatePeriod = (id: string, field: keyof Period, value: string | number) => {
    setPeriodValues({
      ...periodValues,
      periods: periodValues.periods.map(p =>
        p.id === id ? { ...p, [field]: value } : p
      )
    });
  };

  const calculateResults = () => {
    setShowResults(true);
  };

  const generateJSON = () => {
    const startTime = Date.now();

    const windows = periodResults.map((pr, index) => {
      if (pr.error || !pr.result) {
        return {
          "window-id": (index + 1).toString(),
          "converged": false,
          "error": pr.error || "Unable to calculate XIRR",
          "iterations": 0,
          "xirr": -999.99
        };
      }

      const selectedMethod = pr.result.hasDifference &&
        Math.abs(pr.result.brent.finalNPV) < Math.abs(pr.result.newtonRaphson.finalNPV)
        ? pr.result.brent
        : pr.result.newtonRaphson;

      return {
        "window-id": (index + 1).toString(),
        "converged": selectedMethod.converged,
        "iterations": selectedMethod.iterations,
        "xirr": parseFloat(selectedMethod.rate.toFixed(15))
      };
    });

    const calcTime = Date.now() - startTime;

    const jsonOutput = {
      "type": "xirr-results",
      "calc-time": `${calcTime} ms`,
      "request-id": `${Date.now()}-user-generated`,
      "results": [
        {
          "calc-id": "multi-period-analysis",
          "windows": windows
        }
      ]
    };

    const blob = new Blob([JSON.stringify(jsonOutput, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xirr-results-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const periodResults: PeriodResult[] = periodValues.periods.map(p => {
    const cashFlows = buildPeriodCashFlows(p.startDate, p.endDate, p.startValue, p.endValue);

    const startDate = new Date(p.startDate);
    const endDate = new Date(p.endDate);
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const years = daysDiff / 365.25;

    if (cashFlows.length < 2) {
      return {
        period: p.label,
        startDate: p.startDate,
        endDate: p.endDate,
        years,
        cashFlows,
        result: null,
        error: 'Please enter start date, end date, and values'
      };
    }

    const result = calculateXIRR(cashFlows);
    if (!result) {
      return {
        period: p.label,
        startDate: p.startDate,
        endDate: p.endDate,
        years,
        cashFlows,
        result: null,
        error: 'Unable to calculate XIRR'
      };
    }

    return { period: p.label, startDate: p.startDate, endDate: p.endDate, years, cashFlows, result };
  });

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => setPeriodsExpanded(!periodsExpanded)}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
              title={periodsExpanded ? "Collapse section" : "Expand section"}
            >
              {periodsExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-600" />
              )}
            </button>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Analysis Periods</h2>
              <p className="text-sm text-slate-600 mt-1">
                Define custom time periods to analyze your portfolio performance.
              </p>
            </div>
          </div>
          <button
            onClick={addPeriod}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Period
          </button>
        </div>

        {periodsExpanded && (
        <div className="space-y-4">
          {periodValues.periods.map((period, index) => {
            return (
            <div
              key={period.id}
              className="border border-slate-200 rounded-lg p-4 bg-slate-50"
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Period Label</label>
                    <input
                      type="text"
                      value={period.label}
                      onChange={(e) => updatePeriod(period.id, 'label', e.target.value)}
                      placeholder="e.g., Q4 2024"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={period.startDate}
                      onChange={(e) => updatePeriod(period.id, 'startDate', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={period.endDate}
                      onChange={(e) => updatePeriod(period.id, 'endDate', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Start Value
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={period.startValue}
                      onChange={(e) => updatePeriod(period.id, 'startValue', e.target.value)}
                      placeholder="100000"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">End Value</label>
                    <input
                      type="number"
                      step="0.01"
                      value={period.endValue}
                      onChange={(e) => updatePeriod(period.id, 'endValue', e.target.value)}
                      placeholder="115000"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <button
                  onClick={() => removePeriod(period.id)}
                  disabled={periodValues.periods.length <= 1}
                  className="mt-5 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Remove period"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
          })}
        </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => setCashFlowsExpanded(!cashFlowsExpanded)}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
              title={cashFlowsExpanded ? "Collapse section" : "Expand section"}
            >
              {cashFlowsExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-600" />
              )}
            </button>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Intermediate Cash Flows</h2>
              <p className="text-sm text-slate-600 mt-1">
                Add any contributions, withdrawals, dividends, or distributions that occurred during the periods
              </p>
            </div>
          </div>
          <button
            onClick={addFlow}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Flow
          </button>
        </div>

        {cashFlowsExpanded && (
        <>
        {flows.length === 0 ? (
          <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg">
            <p>No intermediate cash flows. Click "Add Flow" to add contributions, distributions, etc.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-3 text-sm font-medium text-slate-600 px-2">
              <div className="col-span-3">Date</div>
              <div className="col-span-3">Amount</div>
              <div className="col-span-5">Description</div>
              <div className="col-span-1"></div>
            </div>

            {flows.map((flow) => (
              <div key={flow.id} className="grid grid-cols-12 gap-3 items-center">
                <input
                  type="date"
                  value={flow.date}
                  onChange={(e) => updateFlow(flow.id, 'date', e.target.value)}
                  className="col-span-3 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="number"
                  step="0.01"
                  value={flow.amount}
                  onChange={(e) => updateFlow(flow.id, 'amount', e.target.value)}
                  placeholder="Amount"
                  className="col-span-3 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <input
                  type="text"
                  value={flow.description}
                  onChange={(e) => updateFlow(flow.id, 'description', e.target.value)}
                  placeholder="Description"
                  className="col-span-5 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => removeFlow(flow.id)}
                  className="col-span-1 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-slate-700">
          <p className="font-medium mb-2">Tips for Cash Flows:</p>
          <ul className="list-disc list-inside space-y-1 text-slate-600">
            <li>Use negative amounts for additional investments (e.g., -10000)</li>
            <li>Use positive amounts for distributions or withdrawals (e.g., 5000)</li>
            <li>Only include flows that occurred between your periods</li>
            <li>The system will automatically include these flows in the relevant periods</li>
          </ul>
        </div>
        </>
        )}
      </div>

      <button
        onClick={calculateResults}
        className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg shadow-md hover:shadow-lg"
      >
        Calculate Multi-Period XIRR
      </button>

      {showResults && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2">
              <TrendingUp className="w-7 h-7 text-blue-600" />
              Multi-Period Performance Analysis
            </h2>
            <p className="text-slate-600 mt-2">Compare returns across different time horizons</p>
          </div>

          {(() => {
            const validResults = periodResults.filter(pr => pr.result && !pr.error);
            const totalCalculations = validResults.length;
            const mismatchedPeriods = validResults.filter(pr => pr.result?.hasDifference);
            const methodMismatches = mismatchedPeriods.length;
            const mismatchPeriodNames = mismatchedPeriods.map(pr => pr.period);

            return (
              <div className="mb-6 p-4 bg-gradient-to-br from-slate-700 to-slate-800 text-white rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-300">Summary Statistics</p>
                    <div className="mt-2 flex items-baseline gap-6">
                      <div>
                        <span className="text-3xl font-bold">{totalCalculations}</span>
                        <span className="text-sm text-slate-300 ml-2">Total Calculations</span>
                      </div>
                      <div>
                        <span className={`text-3xl font-bold ${methodMismatches > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                          {methodMismatches}
                        </span>
                        <span className="text-sm text-slate-300 ml-2">Method Mismatches</span>
                      </div>
                    </div>
                  </div>
                  {methodMismatches > 0 ? (
                    <AlertTriangle className="w-12 h-12 text-amber-400 opacity-50" />
                  ) : totalCalculations > 0 ? (
                    <CheckCircle2 className="w-12 h-12 text-green-400 opacity-50" />
                  ) : null}
                </div>
                {totalCalculations > 0 && (
                  <p className="text-xs text-slate-400 mt-3">
                    {methodMismatches === 0
                      ? 'All calculation methods agree on the results.'
                      : `${methodMismatches} out of ${totalCalculations} calculations show differences between Newton-Raphson and Brent's method (${mismatchPeriodNames.join(', ')}).`}
                  </p>
                )}
              </div>
            );
          })()}

          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
            {periodResults.map((periodResult, index) => {
              const colors = [
                'bg-gradient-to-br from-blue-500 to-blue-600',
                'bg-gradient-to-br from-green-500 to-green-600',
                'bg-gradient-to-br from-orange-500 to-orange-600',
                'bg-gradient-to-br from-slate-600 to-slate-700',
                'bg-gradient-to-br from-teal-500 to-teal-600',
                'bg-gradient-to-br from-cyan-500 to-cyan-600',
              ];
              const colorClass = colors[index % colors.length];

              const formatDate = (dateStr: string) => {
                if (!dateStr) return '';
                const [year, month, day] = dateStr.split('-');
                const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
              };

              return (
              <div
                key={periodResult.period}
                className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-slate-200"
              >
                <div className={`p-4 ${colorClass}`}>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    {periodResult.period}
                  </h3>
                  <p className="text-sm text-white/90 mt-1">
                    {formatDate(periodResult.startDate)} - {formatDate(periodResult.endDate)}
                  </p>
                </div>

                <div className="p-6">
                  {periodResult.error ? (
                    <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">Not Available</p>
                        <p className="text-xs text-amber-700 mt-1">{periodResult.error}</p>
                      </div>
                    </div>
                  ) : periodResult.result && !periodResult.result.errorReason ? (
                    <div className="space-y-4">
                      <div className={`rounded-lg p-4 border ${
                        periodResult.result.hasDifference
                          ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300'
                          : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                      }`}>
                        {periodResult.result.hasDifference ? (
                          <>
                            <p className="text-xs text-slate-600 mb-1 font-medium">Calculation Result</p>
                            <p className="text-3xl font-bold text-amber-600">N/A</p>
                            <p className="text-[10px] text-amber-700 mt-1">Methods disagree - result unreliable</p>
                          </>
                        ) : periodResult.result.totalDays < 365 ? (
                          <>
                            <p className="text-xs text-slate-600 mb-1 font-medium">Simple Return (Non-Annualized)</p>
                            <p className={`text-3xl font-bold ${
                              parseFloat(periodResult.result.simpleReturnPercent) >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {periodResult.result.simpleReturnPercent}%
                            </p>
                            <p className="text-[10px] text-slate-500 mt-1">Period is less than 12 months</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-slate-600 mb-1 font-medium">Annualized Return (XIRR)</p>
                            <p className={`text-3xl font-bold ${
                              parseFloat(periodResult.result.xirrPercent) >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {periodResult.result.xirrPercent}%
                            </p>
                          </>
                        )}
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-300 shadow-md">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-blue-800 flex items-center gap-1">
                            <GitCompare className="w-4 h-4" />
                            Method Comparison
                          </h4>
                          {periodResult.result.hasDifference ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded">
                              <AlertTriangle className="w-3 h-3" />
                              Different
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded">
                              <CheckCircle2 className="w-3 h-3" />
                              Match
                            </span>
                          )}
                        </div>

                        <div className="space-y-2 text-[11px]">
                          <div className={`flex justify-between items-center p-2 rounded ${
                            periodResult.result.hasDifference ? 'bg-blue-100 border border-blue-300' : 'bg-white'
                          }`}>
                            <span className="font-medium text-slate-700 truncate pr-1">Newton-Raphson:</span>
                            <span className="font-mono font-semibold text-slate-800 flex-shrink-0">
                              {periodResult.result.newtonRaphson.ratePercent}%
                            </span>
                          </div>

                          <div className={`flex justify-between items-center p-2 rounded ${
                            periodResult.result.hasDifference ? 'bg-green-100 border border-green-300' : 'bg-white'
                          }`}>
                            <span className="font-medium text-slate-700 truncate pr-1">Brent's Method:</span>
                            <span className="font-mono font-semibold text-slate-800 flex-shrink-0">
                              {periodResult.result.brent.ratePercent}%
                            </span>
                          </div>

                          {periodResult.result.hasDifference && (
                            <div className="flex justify-between p-2 bg-amber-50 border border-amber-200 rounded">
                              <span className="font-medium text-amber-800">Difference:</span>
                              <span className="font-mono font-semibold text-amber-900">
                                {periodResult.result.differencePercent}%
                              </span>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                            <div className="text-center">
                              <p className="text-[10px] text-slate-500">Iterations</p>
                              <p className="font-mono font-semibold text-slate-700">
                                {periodResult.result.newtonRaphson.iterations} / {periodResult.result.brent.iterations}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-[10px] text-slate-500">Status</p>
                              <p className="text-[10px] font-medium text-green-600">
                                {periodResult.result.newtonRaphson.converged && periodResult.result.brent.converged ? 'Both Converged' : 'Partial'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                          <span className="text-slate-600 flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Time Period
                          </span>
                          <span className="font-semibold text-slate-800">
                            {periodResult.result.totalDays} days
                          </span>
                        </div>

                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                          <span className="text-slate-600 flex items-center gap-1">
                            <DollarSign className="w-4 h-4" />
                            Net Cash Flow
                          </span>
                          <span className={`font-semibold ${
                            periodResult.result.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ${periodResult.result.netCashFlow.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </span>
                        </div>

                        <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                          <span className="text-slate-600">Total Invested</span>
                          <span className="font-semibold text-red-600">
                            ${periodResult.result.totalOutflows.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-slate-600">Total Returns</span>
                          <span className="font-semibold text-green-600">
                            ${periodResult.result.totalInflows.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
            })}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              Understanding Your Results
            </h3>
            <div className="grid md:grid-cols-2 gap-6 text-sm text-slate-700">
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">How It Works</h4>
                <p className="leading-relaxed">
                  The calculator uses your period start/end values plus any intermediate cash flows to compute
                  returns for each time horizon. Periods under 12 months show simple returns, while periods
                  12 months or longer show annualized returns (XIRR).
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 mb-2">Comparing Periods</h4>
                <p className="leading-relaxed">
                  Different periods may show different returns based on market performance and your investment
                  timing. Recent periods often differ from long-term results, revealing important patterns
                  in your investment strategy.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Upload, Plus, Trash2, Calculator, Download, ClipboardPaste, X, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { CashFlow, calculateXIRR, parseCSV, XIRRResult } from './utils/xirr';
import { DatasetManager } from './components/DatasetManager';
import { MultiPeriodInput } from './components/MultiPeriodInput';

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

type ViewMode = 'simple' | 'multi-period';

interface APIMetadata {
  requestId: string;
  entity: string;
  scorecard: string;
}

const extractCalcType = (calcId: string): string => {
  // Extract the calculation type from calc-id
  // Example: "1016415.GrossOfFees" -> "Gross of Fees"
  // Example: "1016415.NetOfFees" -> "Net of Fees"
  const parts = calcId.split('.');
  if (parts.length > 1) {
    const type = parts[1];
    // Convert camelCase to readable format
    return type.replace(/([A-Z])/g, ' $1').trim();
  }
  return calcId;
};

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('multi-period');
  const [flows, setFlows] = useState<FlowInput[]>([
    { id: '1', date: '', amount: '', description: 'Initial Investment' },
    { id: '2', date: '', amount: '', description: 'Final Value' }
  ]);
  const [periodFlows, setPeriodFlows] = useState<FlowInput[]>([]);
  const [apiMetadata, setApiMetadata] = useState<APIMetadata | null>(null);
  const [periodValues, setPeriodValues] = useState<PeriodValues>(() => {
    const today = new Date().toISOString().split('T')[0];

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);

    return {
      periods: [
        { id: '1', label: '1 Year', startDate: oneYearAgo.toISOString().split('T')[0], endDate: today, startValue: '', endValue: '' },
        { id: '2', label: '5 Years', startDate: fiveYearsAgo.toISOString().split('T')[0], endDate: today, startValue: '', endValue: '' },
        { id: '3', label: '10 Years', startDate: tenYearsAgo.toISOString().split('T')[0], endDate: today, startValue: '', endValue: '' }
      ]
    };
  });
  const [result, setResult] = useState<XIRRResult | null>(null);
  const [error, setError] = useState<string>('');
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const [showCalcSelector, setShowCalcSelector] = useState(false);
  const [availableCalcs, setAvailableCalcs] = useState<any[]>([]);
  const [apiData, setApiData] = useState<any>(null);
  const [cashFlowsExpanded, setCashFlowsExpanded] = useState(true);
  const [selectedCalcType, setSelectedCalcType] = useState<string>('');
  const [loadedCalculations, setLoadedCalculations] = useState<any[]>([]);

  const cashFlows: CashFlow[] = flows
    .filter(f => f.date && f.amount)
    .map(f => ({
      date: new Date(f.date),
      amount: parseFloat(f.amount),
      description: f.description
    }));

  const findStartValueForDate = (dateStr: string): string => {
    return '';
  };

  const buildPeriodCashFlows = (startDateStr: string, endDateStr: string, startValue: string, endValue: string): CashFlow[] => {
    if (!startDateStr || !endDateStr || !endValue) return [];

    const effectiveStartValue = startValue || findStartValueForDate(startDateStr);

    if (!effectiveStartValue) return [];

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    const flows: CashFlow[] = [];

    flows.push({
      date: startDate,
      amount: -Math.abs(parseFloat(effectiveStartValue)),
      description: 'Period Start Value'
    });

    const intermediateFlows = periodFlows
      .filter(f => f.date && f.amount)
      .map(f => ({
        date: new Date(f.date),
        amount: parseFloat(f.amount),
        description: f.description
      }))
      .filter(f => f.date > startDate && f.date < endDate);

    flows.push(...intermediateFlows);

    flows.push({
      date: endDate,
      amount: parseFloat(endValue),
      description: 'Period End Value'
    });

    return flows.sort((a, b) => a.date.getTime() - b.date.getTime());
  };

  const addFlow = () => {
    setFlows([...flows, {
      id: Date.now().toString(),
      date: '',
      amount: '',
      description: ''
    }]);
  };

  const removeFlow = (id: string) => {
    if (flows.length > 2) {
      setFlows(flows.filter(f => f.id !== id));
    }
  };

  const updateFlow = (id: string, field: keyof FlowInput, value: string) => {
    setFlows(flows.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const parseAPIDate = (dateNum: number): string => {
    const dateStr = dateNum.toString();
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${year}-${month}-${day}`;
  };

  const importAPICalculation = (calc: any) => {
    console.log('Importing calculation:', calc['calc-id']);
    const calcType = extractCalcType(calc['calc-id']);
    setSelectedCalcType(calcType);

    if (!calc || !calc.dates || !calc.flows || !calc.windows) {
      setError('Invalid API format. Missing dates, flows, or windows.');
      return;
    }

    // Convert dates and flows to cash flows
    const newFlows: FlowInput[] = [];
    for (let i = 0; i < calc.dates.length; i++) {
      const date = parseAPIDate(calc.dates[i]);
      const amount = calc.flows[i].toString();

      newFlows.push({
        id: `${Date.now()}-${i}`,
        date,
        amount,
        description: amount.startsWith('-') ? 'Flow Out' : 'Flow In'
      });
    }

    // Convert windows to periods
    const newPeriods: Period[] = calc.windows.map((window: any) => ({
      id: `window-${window['window-id']}`,
      label: `Window ${window['window-id']}`,
      startDate: parseAPIDate(window['start-date']),
      endDate: parseAPIDate(window['end-date']),
      startValue: window['start-market-value'].toString(),
      endValue: window['end-market-value'].toString()
    }));

    // Switch to multi-period mode and populate data
    setViewMode('multi-period');
    setPeriodFlows(newFlows);
    setPeriodValues({
      periods: newPeriods
    });

    setError('');
    setResult(null);
    setShowCalcSelector(false);

    alert(`✓ Imported: ${calc['calc-id']}\n\n${newFlows.length} cash flows\n${newPeriods.length} analysis windows\n\nSwitch to Multi-Period mode and click "Calculate Multi-Period XIRR" to verify results.`);
  };

  const handleJSONImport = (jsonText: string) => {
    console.log('handleJSONImport called, text length:', jsonText.length);
    try {
      let data;

      // Clean the text first - remove BOM and normalize line endings
      let cleanText = jsonText.trim();
      if (cleanText.charCodeAt(0) === 0xFEFF) {
        cleanText = cleanText.slice(1);
      }

      try {
        // Try standard JSON parsing first
        data = JSON.parse(cleanText);
        console.log('JSON parsed successfully on first try');
      } catch (firstError) {
        console.error('Standard JSON parse failed:', firstError);
        console.log('First 200 chars of input:', cleanText.substring(0, 200));
        console.log('Error details:', firstError);

        throw new Error(`JSON parsing failed: ${firstError instanceof Error ? firstError.message : String(firstError)}`);
      }
      console.log('JSON parsed successfully, data keys:', Object.keys(data));

      // Check if this is an API request format
      if (data.calculations && Array.isArray(data.calculations)) {
        // API format detected
        if (data.calculations.length === 0) {
          setError('No calculations found in API data.');
          return;
        }

        // Parse request-id to extract Entity and Scorecard
        if (data['request-id']) {
          const parts = data['request-id'].split('|').map((p: string) => p.trim());
          if (parts.length >= 3) {
            setApiMetadata({
              requestId: parts[0],
              entity: parts[1],
              scorecard: parts[2]
            });
          }
        }

        // Load ALL calculations
        const allCalcs = data.calculations.filter((calc: any) => calc['calc-id']);

        if (allCalcs.length === 0) {
          setError('No calculations found in API data.');
          return;
        }

        // Store all calculations
        setLoadedCalculations(allCalcs);
        setApiData(data);

        // If multiple calculations, show selector
        if (allCalcs.length > 1) {
          setAvailableCalcs(allCalcs);
          setShowCalcSelector(true);
          setError('');
          return;
        }

        // Single calculation - import directly
        const calcType = extractCalcType(allCalcs[0]['calc-id']);
        setSelectedCalcType(calcType);
        importAPICalculation(allCalcs[0]);
        alert(`API data imported successfully!\n${allCalcs[0]['calc-id']}\n${allCalcs[0].dates?.length || 0} cash flows, ${allCalcs[0].windows?.length || 0} windows`);
        return;
      }

      // Handle format with dates[] and Flows[] arrays
      if (data.dates && Array.isArray(data.dates) && (data.Flows || data.flows)) {
        console.log('Detected dates/Flows format');
        const flows = data.Flows || data.flows;
        const dates = data.dates;

        if (dates.length !== flows.length) {
          setError('Dates and Flows arrays must have the same length.');
          return;
        }

        // Helper to parse date (handles both number and string formats)
        const parseDate = (date: any): string => {
          if (typeof date === 'number') {
            return parseAPIDate(date);
          }
          return parseDateString(date);
        };

        const newFlows: FlowInput[] = dates.map((date: any, idx: number) => ({
          id: Date.now().toString() + idx,
          date: parseDate(date),
          amount: flows[idx]?.toString() || '',
          description: ''
        })).filter(f => f.date && f.amount);

        console.log('Parsed flows:', newFlows);

        // Handle windows for multi-period analysis
        if (data.windows && Array.isArray(data.windows)) {
          console.log('Processing windows data', data.windows);
          const periods = data.windows.map((window: any, idx: number) => {
            const startDateRaw = window['start-date'] || window.start_date || window.startDate;
            const endDateRaw = window['end-date'] || window.end_date || window.endDate;

            return {
              id: `window-${window['window-id'] || window.windowId || idx}`,
              label: `Period ${idx + 1}`,
              startDate: typeof startDateRaw === 'number' ? parseAPIDate(startDateRaw) : parseDateString(startDateRaw || ''),
              endDate: typeof endDateRaw === 'number' ? parseAPIDate(endDateRaw) : parseDateString(endDateRaw || ''),
              startValue: (window['start-market-value'] || window.start_market_value || window.startMarketValue || window.market_value || window.marketValue || 0).toString(),
              endValue: (window['end-market-value'] || window.end_market_value || window.endMarketValue || 0).toString()
            };
          });

          console.log('Parsed periods:', periods);

          setViewMode('multi-period');
          setPeriodFlows(newFlows);
          setPeriodValues({
            startValues: [],
            periods: periods
          });
        } else {
          // Single period mode
          if (viewMode === 'multi-period') {
            setPeriodFlows(newFlows);
          } else {
            setFlows(newFlows);
          }
        }

        setError('');
        setResult(null);
        console.log('Successfully imported', newFlows.length, 'cash flows');
        return;
      }

      // Original format handling
      let cashFlowData: any[] = [];
      let periodValuesData: PeriodValues | null = null;

      if (Array.isArray(data)) {
        cashFlowData = data;
      } else if (data.cashFlows && Array.isArray(data.cashFlows)) {
        cashFlowData = data.cashFlows;
        if (data.periodValues) {
          periodValuesData = data.periodValues;
        }
      } else {
        setError('Invalid JSON format. Expected dates/Flows arrays or cashFlows array.');
        return;
      }

      const newFlows: FlowInput[] = cashFlowData.map((item, idx) => {
        const date = item.date ? parseDateString(item.date) : '';
        const amount = item.amount?.toString() || '';
        const description = item.description || '';

        return {
          id: Date.now().toString() + idx,
          date,
          amount,
          description
        };
      }).filter(f => f.date && f.amount);

      if (newFlows.length === 0) {
        setError('No valid cash flows found in JSON file.');
        return;
      }

      if (viewMode === 'multi-period') {
        setPeriodFlows(newFlows);
        if (periodValuesData) {
          setPeriodValues(periodValuesData);
        }
      } else {
        setFlows(newFlows);
      }

      setError('');
      setResult(null);
    } catch (err) {
      console.error('Error in handleJSONImport:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Error parsing JSON: ${errorMsg}`);
    }
  };

  const calculateIRR = () => {
    setError('');
    setResult(null);

    const cashFlows: CashFlow[] = flows
      .filter(f => f.date && f.amount)
      .map(f => ({
        date: new Date(f.date),
        amount: parseFloat(f.amount),
        description: f.description
      }));

    if (cashFlows.length < 2) {
      setError('Please enter at least 2 cash flows with valid dates and amounts.');
      return;
    }

    const hasOutflow = cashFlows.some(f => f.amount < 0);
    const hasInflow = cashFlows.some(f => f.amount > 0);

    if (!hasOutflow || !hasInflow) {
      setError('You need at least one negative cash flow (investment) and one positive cash flow (return).');
      return;
    }

    const calculatedResult = calculateXIRR(cashFlows);

    if (!calculatedResult) {
      setError('Unable to calculate XIRR. Please check your data.');
      return;
    }

    setResult(calculatedResult);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('handleFileUpload called', event.target.files);
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', file.name, file.type, file.size);

    const reader = new FileReader();
    reader.onerror = () => {
      console.error('FileReader error');
      setError('Error reading file. Please try again.');
    };
    reader.onload = (e) => {
      const text = e.target?.result as string;
      console.log('File content loaded, length:', text.length);
      try {
        // Check if this is a JSON file
        if (file.name.endsWith('.json')) {
          console.log('Processing as JSON file');
          handleJSONImport(text);
          return;
        }

        const lines = text.trim().split('\n').filter(line => line.trim());
        let extractedPeriodValues: PeriodValues | null = null;
        let newFlows: FlowInput[] = [];

        // Check if this is a multi-section template format
        const hasMultiPeriodSections = text.includes('Period Definitions:') ||
                                       text.includes('Period Label,Start Date,End Date');

        if (viewMode === 'multi-period' && hasMultiPeriodSections) {
          // Parse multi-section template format
          const periods: Period[] = [];

          let inPeriodSection = false;
          let inCashFlowSection = false;

          for (const line of lines) {
            const trimmedLine = line.trim();

            // Toggle sections
            if (trimmedLine.includes('Period Definitions:')) {
              inPeriodSection = true;
              inCashFlowSection = false;
              continue;
            }
            if (trimmedLine.includes('Intermediate Cash Flows')) {
              inPeriodSection = false;
              inCashFlowSection = true;
              continue;
            }

            // Skip headers
            if (trimmedLine.startsWith('Period Label,')) {
              continue;
            }

            // Parse period values section
            if (inPeriodSection) {
              const parts = trimmedLine.split(',');

              if (parts.length >= 5) {
                const label = parts[0].trim();
                const startDate = parseDateString(parts[1].trim());
                const endDate = parseDateString(parts[2].trim());
                const startValue = parts[3].trim().replace(/[^0-9.-]/g, '');
                const endValue = parts[4].trim().replace(/[^0-9.-]/g, '');

                if (startDate && endDate) {
                  periods.push({
                    id: Date.now().toString() + periods.length,
                    label,
                    startDate,
                    endDate,
                    startValue,
                    endValue
                  });
                }
              }
              continue;
            }

            // Parse cash flows section
            if (inCashFlowSection) {
              const parts = trimmedLine.split(',');

              if (parts.length >= 2) {
                const dateStr = parts[0].trim();
                const amountStr = parts[1].trim();
                const descriptionStr = parts.length > 2 ? parts[2].trim() : '';

                const date = parseDateString(dateStr);
                const amount = amountStr.replace(/[^0-9.-]/g, '');

                if (date && amount && !isNaN(parseFloat(amount))) {
                  newFlows.push({
                    id: `${Date.now()}-${newFlows.length}`,
                    date,
                    amount,
                    description: descriptionStr
                  });
                }
              }
            }
          }

          // Build extracted period values
          extractedPeriodValues = {
            periods: periods.length > 0 ? periods : periodValues.periods
          };
        } else {
          // Parse simple CSV format
          const cashFlows = parseCSV(text);
          if (cashFlows.length === 0) {
            setError('No valid data found in CSV file.');
            return;
          }

          newFlows = cashFlows.map((cf, idx) => ({
            id: Date.now().toString() + idx,
            date: cf.date.toISOString().split('T')[0],
            amount: cf.amount.toString(),
            description: cf.description || ''
          }));
        }

        if (viewMode === 'multi-period') {
          setPeriodFlows(newFlows);
          if (extractedPeriodValues) {
            setPeriodValues(extractedPeriodValues);
          }
        } else {
          setFlows(newFlows);
        }
        setError('');
        setResult(null);
      } catch (err) {
        setError('Error parsing CSV file. Please check the format.');
      }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  const downloadTemplate = (format: 'csv' | 'json' = 'csv') => {
    if (format === 'json') {
      let jsonContent: any;

      if (viewMode === 'multi-period') {
        jsonContent = {
          periodValues: {
            periods: [
              { label: '1 Year', startDate: '2024-01-01', endDate: '2024-12-31', startValue: '100000', endValue: '115000' }
            ]
          },
          cashFlows: [
            { date: '2024-03-15', amount: -5000, description: 'Additional Investment' },
            { date: '2024-06-15', amount: 2000, description: 'Distribution' },
            { date: '2024-09-15', amount: -3000, description: 'Additional Investment' },
            { date: '2024-12-15', amount: 3000, description: 'Distribution' }
          ]
        };
      } else {
        jsonContent = [
          { date: '2024-01-01', amount: -100000, description: 'Initial Investment' },
          { date: '2024-06-15', amount: 5000, description: 'Dividend Received' },
          { date: '2024-09-30', amount: -10000, description: 'Additional Investment' },
          { date: '2024-12-31', amount: 115000, description: 'Final Value' }
        ];
      }

      const blob = new Blob([JSON.stringify(jsonContent, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = viewMode === 'multi-period' ? 'multi_period_template.json' : 'irr_template.json';
      a.click();
      window.URL.revokeObjectURL(url);
      return;
    }

    let csvContent: string;

    if (viewMode === 'multi-period') {
      const periodLines = periodValues.periods.map(p =>
        `${p.label},${p.startDate || '2024-01-01'},${p.endDate || '2024-12-31'},${p.startValue || '100000'},${p.endValue || '115000'}`
      ).join('\n');

      csvContent = `MULTI-PERIOD XIRR TEMPLATE

Instructions:
1. Define your analysis periods with start dates, end dates, start values, and end values
2. Add intermediate cash flows (contributions, distributions, etc.) with dates
3. Upload or paste this file - all values will be automatically populated!

Period Definitions:
Period Label,Start Date,End Date,Start Value,End Value
${periodLines}

Intermediate Cash Flows:
Date,Amount,Description
2024-03-15,-5000,Additional Investment
2024-06-15,2000,Distribution
2024-09-15,-3000,Additional Investment
2024-12-15,3000,Distribution

Note: Use negative amounts for investments, positive for distributions`;
    } else {
      csvContent = `Date,Amount,Description
2024-01-01,-100000,Initial Investment
2024-06-15,5000,Dividend Received
2024-09-30,-10000,Additional Investment
2024-12-31,115000,Final Value

Example with Loss:
2024-01-01,-620400.58,Initial Investment
2024-03-15,25000,Distribution
2024-06-20,-50000,Additional Capital Call
2024-12-31,-772956.68,Current Position Value (Loss)`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = viewMode === 'multi-period' ? 'multi_period_template.csv' : 'irr_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleLoadDataset = (savedFlows: { date: string; amount: string; description: string }[], savedPeriodValues?: PeriodValues) => {
    const newFlows: FlowInput[] = savedFlows.map((cf, idx) => ({
      id: Date.now().toString() + idx,
      date: cf.date,
      amount: cf.amount,
      description: cf.description || ''
    }));

    if (viewMode === 'multi-period') {
      setPeriodFlows(newFlows);
      if (savedPeriodValues) {
        setPeriodValues(savedPeriodValues);
      }
    } else {
      setFlows(newFlows);
    }
    setError('');
    setResult(null);
  };

  const parseDateString = (dateStr: string): string => {
    const cleanDate = dateStr.trim();
    const parsedDate = new Date(cleanDate);

    if (isNaN(parsedDate.getTime())) {
      return '';
    }

    const year = parsedDate.getFullYear();
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  const handlePasteData = () => {
    try {
      const trimmedData = pasteData.trim();

      if (trimmedData.length === 0) {
        setError('No data to paste');
        return;
      }

      // Check if this is JSON format (including API format)
      if (trimmedData.startsWith('{') || trimmedData.startsWith('[')) {
        handleJSONImport(trimmedData);
        setShowPasteDialog(false);
        setPasteData('');
        return;
      }

      const lines = trimmedData.split('\n').filter(line => line.trim());

      if (lines.length === 0) {
        setError('No data to paste');
        return;
      }

      const newFlows: FlowInput[] = [];
      let extractedPeriodValues: PeriodValues | null = null;

      // Check if this is a multi-section template format
      const hasMultiPeriodSections = pasteData.includes('Period Definitions:') ||
                                     pasteData.includes('Period Label,Start Date,End Date');

      if (viewMode === 'multi-period' && hasMultiPeriodSections) {
        // Parse multi-section template format
        const periods: Period[] = [];

        let inPeriodSection = false;
        let inCashFlowSection = false;

        for (const line of lines) {
          const trimmedLine = line.trim();

          // Toggle sections
          if (trimmedLine.includes('Period Definitions:')) {
            inPeriodSection = true;
            inCashFlowSection = false;
            continue;
          }
          if (trimmedLine.includes('Intermediate Cash Flows')) {
            inPeriodSection = false;
            inCashFlowSection = true;
            continue;
          }

          // Skip headers
          if (trimmedLine.startsWith('Period Label,')) {
            continue;
          }

          // Parse period values section
          if (inPeriodSection) {
            let parts: string[];
            if (trimmedLine.includes('\t')) {
              parts = trimmedLine.split('\t');
            } else {
              parts = trimmedLine.split(',');
            }

            if (parts.length >= 5) {
              const label = parts[0].trim();
              const startDate = parseDateString(parts[1].trim());
              const endDate = parseDateString(parts[2].trim());
              const startValue = parts[3].trim().replace(/[^0-9.-]/g, '');
              const endValue = parts[4].trim().replace(/[^0-9.-]/g, '');

              if (startDate && endDate) {
                periods.push({
                  id: Date.now().toString() + periods.length,
                  label,
                  startDate,
                  endDate,
                  startValue,
                  endValue
                });
              }
            }
            continue;
          }

          // Parse cash flows section
          if (inCashFlowSection) {
            let parts: string[];
            if (trimmedLine.includes('\t')) {
              parts = trimmedLine.split('\t');
            } else {
              parts = trimmedLine.split(',');
            }

            if (parts.length >= 2) {
              const dateStr = parts[0].trim();
              const amountStr = parts[1].trim();
              const descriptionStr = parts.length > 2 ? parts[2].trim() : '';

              const date = parseDateString(dateStr);
              const amount = amountStr.replace(/[^0-9.-]/g, '');

              if (date && amount && !isNaN(parseFloat(amount))) {
                newFlows.push({
                  id: `${Date.now()}-${newFlows.length}`,
                  date,
                  amount,
                  description: descriptionStr
                });
              }
            }
          }
        }

        // Build extracted period values
        extractedPeriodValues = {
          periods: periods.length > 0 ? periods : periodValues.periods
        };
      } else {
        // Parse simple format (single line per cash flow)
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          let parts: string[];
          if (line.includes('\t')) {
            parts = line.split('\t');
          } else if (line.includes(',')) {
            parts = line.split(',');
          } else {
            continue;
          }

          if (parts.length < 2) continue;

          const dateStr = parts[0].trim();
          const amountStr = parts[1].trim();
          const descriptionStr = parts.length > 2 ? parts[2].trim() : '';

          const date = parseDateString(dateStr);
          const amount = amountStr.replace(/[^0-9.-]/g, '');

          if (date && amount && !isNaN(parseFloat(amount))) {
            newFlows.push({
              id: `${Date.now()}-${i}`,
              date,
              amount,
              description: descriptionStr
            });
          }
        }
      }

      if (newFlows.length === 0 && viewMode === 'simple') {
        setError('No valid data found. Please ensure your data has dates and amounts.');
        return;
      }

      if (viewMode === 'multi-period') {
        setPeriodFlows(newFlows);
        if (extractedPeriodValues) {
          setPeriodValues(extractedPeriodValues);
        }
      } else {
        setFlows(newFlows);
      }
      setError('');
      setResult(null);
      setShowPasteDialog(false);
      setPasteData('');
    } catch (err) {
      setError('Error parsing pasted data. Please check the format.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <Calculator className="w-8 h-8" />
                  Investment IRR Calculator
                </h1>
                <p className="text-blue-100 mt-2">Calculate Extended Internal Rate of Return (XIRR) for your investments</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            {apiMetadata && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">API Data Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-slate-600 font-medium">Request ID:</span>
                    <span className="ml-2 text-slate-800 font-mono text-xs">{apiMetadata.requestId}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 font-medium">Entity:</span>
                    <span className="ml-2 text-slate-800 font-semibold">{apiMetadata.entity}</span>
                  </div>
                  <div>
                    <span className="text-slate-600 font-medium">Scorecard:</span>
                    <span className="ml-2 text-slate-800 font-semibold">{apiMetadata.scorecard}</span>
                  </div>
                </div>

                {selectedCalcType && (
                  <div className="pt-4 border-t border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-slate-600 font-medium text-sm">Current View:</span>
                        <span className="ml-2 text-blue-900 font-bold text-lg">{selectedCalcType}</span>
                      </div>

                      {loadedCalculations.length > 1 && (
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-slate-600 font-medium">Switch View:</label>
                          <select
                            value={loadedCalculations.findIndex(c => extractCalcType(c['calc-id']) === selectedCalcType)}
                            onChange={(e) => {
                              const selectedCalc = loadedCalculations[parseInt(e.target.value)];
                              if (selectedCalc) {
                                importAPICalculation(selectedCalc);
                              }
                            }}
                            className="px-3 py-1.5 bg-white border border-blue-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {loadedCalculations.map((calc, idx) => {
                              const calcType = extractCalcType(calc['calc-id']);
                              return (
                                <option key={calc['calc-id']} value={idx}>
                                  {calcType}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-center mb-6">
              <div className="inline-flex rounded-lg bg-slate-100 p-1">
                <button
                  onClick={() => setViewMode('simple')}
                  className={`flex items-center gap-2 px-6 py-2 rounded-md font-medium transition-colors ${
                    viewMode === 'simple'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Calculator className="w-4 h-4" />
                  Simple Calculator
                </button>
                <button
                  onClick={() => setViewMode('multi-period')}
                  className={`flex items-center gap-2 px-6 py-2 rounded-md font-medium transition-colors ${
                    viewMode === 'multi-period'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Multi-Period Analysis
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-8 flex-wrap">
              <DatasetManager
                onLoad={handleLoadDataset}
                currentFlows={
                  viewMode === 'multi-period'
                    ? periodFlows.map(f => ({ date: f.date, amount: f.amount, description: f.description }))
                    : flows.map(f => ({ date: f.date, amount: f.amount, description: f.description }))
                }
                periodValues={viewMode === 'multi-period' ? periodValues : undefined}
                isMultiPeriod={viewMode === 'multi-period'}
              />
              <button
                onClick={() => downloadTemplate('csv')}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                <Download className="w-4 h-4" />
                Download CSV Template
              </button>
              <button
                onClick={() => downloadTemplate('json')}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
              >
                <Download className="w-4 h-4" />
                Download JSON Template
              </button>
              <button
                onClick={() => setShowPasteDialog(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium"
              >
                <ClipboardPaste className="w-4 h-4" />
                Paste Data
              </button>
              <label
                htmlFor="file-upload"
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer font-medium"
              >
                <Upload className="w-4 h-4" />
                Upload CSV/JSON
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                  onClick={(e) => console.log('File input clicked', e)}
                />
              </label>
            </div>

            {viewMode === 'simple' ? (
              <>
                <div className="mb-8">
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
                      <h2 className="text-xl font-semibold text-slate-800">Cash Flows</h2>
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
                      disabled={flows.length <= 2}
                      className="col-span-1 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-slate-700">
                <p className="font-medium mb-2">Tips:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>Use negative amounts for investments/outflows (e.g., -100000)</li>
                  <li>Use positive amounts for returns/inflows (e.g., 115000)</li>
                  <li>Enter dates in chronological order for best results</li>
                  <li>Returns over 12 months are automatically annualized</li>
                </ul>
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="font-medium mb-2 text-amber-700">For Losses & Negative Positions:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li>If your position value is negative (you owe money), enter it as a negative final cash flow</li>
                    <li>Example: Invested -$100k, now worth -$50k means you'd need to pay $50k to exit</li>
                    <li>For positions with total loss: enter the current value as what you'd receive if liquidated (can be 0 or negative)</li>
                  </ul>
                </div>
              </div>
              </>
              )}
            </div>

                <button
                  onClick={calculateIRR}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg shadow-md hover:shadow-lg"
                >
                  Calculate XIRR
                </button>

                {error && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                  </div>
                )}

                {result && (
              <div className="mt-8 p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <h3 className="text-2xl font-bold text-slate-800 mb-6">Results</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-sm text-slate-600 mb-1">XIRR (Annualized Return)</div>
                    <div className={`text-3xl font-bold ${parseFloat(result.xirrPercent) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {result.xirrPercent}%
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Annualized rate of return</div>
                  </div>

                  {!result.annualized && (
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      <div className="text-sm text-slate-600 mb-1">Simple Return (Non-Annualized)</div>
                      <div className={`text-3xl font-bold ${parseFloat(result.simpleReturnPercent) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {result.simpleReturnPercent}%
                      </div>
                      <div className="text-xs text-slate-500 mt-1">Actual return for this period</div>
                    </div>
                  )}

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-sm text-slate-600 mb-1">Investment Period</div>
                    <div className="text-3xl font-bold text-slate-800">
                      {Math.round(result.totalDays)} days
                    </div>
                    <div className="text-sm text-slate-500">
                      ({(result.totalDays / 365.25).toFixed(2)} years)
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-sm text-slate-600 mb-1">First Cash Flow</div>
                    <div className={`text-2xl font-bold ${result.firstCashFlow < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${result.firstCashFlow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-sm text-slate-600 mb-1">Last Cash Flow</div>
                    <div className={`text-2xl font-bold ${result.lastCashFlow < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ${result.lastCashFlow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-sm text-slate-600 mb-1">Total Invested</div>
                    <div className="text-2xl font-bold text-slate-800">
                      ${result.totalOutflows.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="text-sm text-slate-600 mb-1">Total Received</div>
                    <div className="text-2xl font-bold text-slate-800">
                      ${result.totalInflows.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="text-sm text-slate-600 mb-1">Net Cash Flow</div>
                  <div className={`text-2xl font-bold ${result.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${result.netCashFlow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <MultiPeriodInput
            periodValues={periodValues}
            setPeriodValues={setPeriodValues}
            flows={periodFlows}
            setFlows={setPeriodFlows}
            buildPeriodCashFlows={buildPeriodCashFlows}
          />
        )}
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-slate-600">
          <p>XIRR uses the Newton-Raphson method to calculate the internal rate of return for irregular cash flows</p>
        </div>
      </div>

      {showPasteDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800">Paste Data</h3>
              <button onClick={() => setShowPasteDialog(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Paste your data (CSV, tab-delimited, or JSON)
                </label>
                <textarea
                  value={pasteData}
                  onChange={(e) => setPasteData(e.target.value)}
                  placeholder={`CSV/Tab format:
2024-01-01	-100000	Initial Investment
2024-12-31	115000	Final Value

JSON format:
[
  {"date": "2024-01-01", "amount": -100000, "description": "Initial Investment"},
  {"date": "2024-12-31", "amount": 115000, "description": "Final Value"}
]`}
                  rows={10}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Supports CSV (Date,Amount,Description), tab-delimited, or JSON array format
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handlePasteData}
                  disabled={!pasteData.trim()}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import Data
                </button>
                <button
                  onClick={() => {
                    setShowPasteDialog(false);
                    setPasteData('');
                  }}
                  className="flex-1 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCalcSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800">Select Calculation</h3>
              <button onClick={() => setShowCalcSelector(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              Multiple calculations found in the API data. Select which one to import:
            </p>

            <div className="flex-1 overflow-y-auto space-y-3">
              {availableCalcs.map((calc, index) => (
                <div
                  key={index}
                  className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-800 text-lg">{calc['calc-id']}</h4>
                      <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-slate-500">Cash Flows:</span>
                          <span className="ml-2 font-semibold">{calc.dates?.length || 0}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Windows:</span>
                          <span className="ml-2 font-semibold">{calc.windows?.length || 0}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Date Range:</span>
                          <span className="ml-2 font-semibold text-xs">
                            {calc.dates?.[0] ? parseAPIDate(calc.dates[0]) : 'N/A'} to{' '}
                            {calc.dates?.[calc.dates.length - 1] ? parseAPIDate(calc.dates[calc.dates.length - 1]) : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => importAPICalculation(calc)}
                      className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Import
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <button
                onClick={() => setShowCalcSelector(false)}
                className="w-full py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

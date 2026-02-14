import { useState, useEffect } from 'react';
import { Save, FolderOpen, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

interface Dataset {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface CashFlowData {
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

interface DatasetManagerProps {
  onLoad: (flows: CashFlowData[], periodValues?: PeriodValues) => void;
  currentFlows: CashFlowData[];
  periodValues?: PeriodValues;
  isMultiPeriod?: boolean;
}

export function DatasetManager({ onLoad, currentFlows, periodValues, isMultiPeriod }: DatasetManagerProps) {
  const { user } = useAuth();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadDatasets = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('datasets')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      setError('Failed to load datasets');
      return;
    }

    setDatasets(data || []);
  };

  useEffect(() => {
    if (showLoadDialog) {
      loadDatasets();
    }
  }, [showLoadDialog, user]);

  const handleSave = async () => {
    if (!user || !saveName.trim()) return;

    setLoading(true);
    setError('');

    try {
      const { data: dataset, error: datasetError } = await supabase
        .from('datasets')
        .insert({
          user_id: user.id,
          name: saveName.trim(),
          description: saveDescription.trim(),
          period_values: isMultiPeriod && periodValues ? periodValues : null,
        })
        .select()
        .single();

      if (datasetError) throw datasetError;

      const cashFlowsToInsert = currentFlows
        .filter(f => f.date && f.amount)
        .map((flow, index) => ({
          dataset_id: dataset.id,
          date: flow.date,
          amount: parseFloat(flow.amount),
          description: flow.description,
          sort_order: index,
        }));

      const { error: flowsError } = await supabase
        .from('cash_flows')
        .insert(cashFlowsToInsert);

      if (flowsError) throw flowsError;

      setSaveName('');
      setSaveDescription('');
      setShowSaveDialog(false);
      alert('Dataset saved successfully!');
    } catch (err) {
      setError('Failed to save dataset');
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async (datasetId: string) => {
    setLoading(true);
    setError('');

    try {
      const { data: dataset, error: datasetError } = await supabase
        .from('datasets')
        .select('period_values')
        .eq('id', datasetId)
        .single();

      if (datasetError) throw datasetError;

      const { data, error } = await supabase
        .from('cash_flows')
        .select('*')
        .eq('dataset_id', datasetId)
        .order('sort_order');

      if (error) throw error;

      const flows: CashFlowData[] = data.map(cf => ({
        date: cf.date,
        amount: cf.amount.toString(),
        description: cf.description,
      }));

      const loadedPeriodValues = dataset.period_values as PeriodValues | null;
      onLoad(flows, loadedPeriodValues || undefined);
      setShowLoadDialog(false);
    } catch (err) {
      setError('Failed to load dataset');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (datasetId: string) => {
    if (!confirm('Are you sure you want to delete this dataset?')) return;

    try {
      const { error } = await supabase
        .from('datasets')
        .delete()
        .eq('id', datasetId);

      if (error) throw error;

      loadDatasets();
    } catch (err) {
      setError('Failed to delete dataset');
    }
  };

  return (
    <div className="flex gap-3">
      <button
        onClick={() => setShowSaveDialog(true)}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
      >
        <Save className="w-4 h-4" />
        Save Data
      </button>

      <button
        onClick={() => setShowLoadDialog(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
      >
        <FolderOpen className="w-4 h-4" />
        Load Data
      </button>

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800">Save Dataset</h3>
              <button onClick={() => setShowSaveDialog(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dataset Name</label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g., Q4 2024 Investment"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
                <textarea
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="Add any notes about this dataset"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={loading || !saveName.trim()}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="flex-1 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLoadDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800">Load Dataset</h3>
              <button onClick={() => setShowLoadDialog(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {datasets.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  No saved datasets yet. Save your current data to get started!
                </div>
              ) : (
                <div className="space-y-2">
                  {datasets.map((dataset) => (
                    <div
                      key={dataset.id}
                      className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-800">{dataset.name}</h4>
                          {dataset.description && (
                            <p className="text-sm text-slate-600 mt-1">{dataset.description}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-2">
                            Updated: {new Date(dataset.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleLoad(dataset.id)}
                            disabled={loading}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleDelete(dataset.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

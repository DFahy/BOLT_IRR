export interface Database {
  public: {
    Tables: {
      datasets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string;
          period_values: any | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string;
          period_values?: any | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string;
          period_values?: any | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      cash_flows: {
        Row: {
          id: string;
          dataset_id: string;
          date: string;
          amount: number;
          description: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          dataset_id: string;
          date: string;
          amount: number;
          description?: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          dataset_id?: string;
          date?: string;
          amount?: number;
          description?: string;
          sort_order?: number;
        };
      };
    };
  };
}

# Investment IRR Calculator

A comprehensive Extended Internal Rate of Return (XIRR) calculator with support for multi-period analysis and API data import.

## Features

- **Simple Calculator**: Calculate XIRR for basic investment scenarios
- **Multi-Period Analysis**: Compare returns across multiple time horizons
- **API Data Import**: Import and verify IRR calculations from API request JSON files
- **Two Calculation Methods**: Newton-Raphson and Brent's Method for accuracy verification
- **Data Persistence**: Save and load datasets to your Supabase account
- **Multiple Import Formats**: CSV, JSON, and API request formats

## API Request JSON Import

This calculator can import and verify IRR calculations from API request JSON files.

### Supported Format

```json
{
  "request-id": "your-request-id",
  "nan-value": -999.99,
  "calculations": [
    {
      "calc-id": "TotalPort_GrossOfFees",
      "dates": [20220101, 20220315, 20220630, 20221231],
      "flows": [-100000, 5000, -10000, 125000],
      "windows": [
        {
          "window-id": "1",
          "start-date": 20220101,
          "start-market-value": 0,
          "end-date": 20221231,
          "end-market-value": 125000,
          "annualized": "at-least-one-year"
        }
      ]
    }
  ]
}
```

### How to Use

1. **Upload a File**: Click "Upload CSV/JSON" and select your API request JSON file
2. **Paste Data**: Click "Paste Data" and paste your JSON
3. **Select Calculation**: If multiple calculations exist, select which one to import
4. **View Results**: Click "Calculate Multi-Period XIRR" to see IRR for each window

### Date Format

- API dates are in YYYYMMDD format (e.g., 20220315 = March 15, 2022)
- Automatically converted to standard format on import

### Windows vs Cash Flows

- **dates/flows**: Individual cash flow transactions
- **windows**: Analysis periods with start/end values for IRR calculation
- Each window is imported as a separate period for independent IRR calculation

## Other Supported Formats

### Simple JSON Format
```json
[
  {"date": "2024-01-01", "amount": -100000, "description": "Initial Investment"},
  {"date": "2024-12-31", "amount": 115000, "description": "Final Value"}
]
```

### Multi-Period JSON Format
```json
{
  "periodValues": {
    "startValues": [
      {"date": "2024-01-01", "value": "100000", "label": "January Start"}
    ],
    "periods": [
      {"label": "1 Year", "startDate": "2024-01-01", "endDate": "2024-12-31", "endValue": "115000"}
    ]
  },
  "cashFlows": [
    {"date": "2024-03-15", "amount": -5000, "description": "Additional Investment"}
  ]
}
```

### CSV Format
```csv
Date,Amount,Description
2024-01-01,-100000,Initial Investment
2024-12-31,115000,Final Value
```

## Sample Test File

See `sample-api-test.json` for a working example of the API format.

## Getting Started

1. Sign in with email/password
2. Choose Simple or Multi-Period mode
3. Import your data or enter manually
4. Calculate XIRR
5. Save your datasets for future reference

## Tech Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Supabase (Authentication & Storage)
- Custom XIRR calculation algorithms

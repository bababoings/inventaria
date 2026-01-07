// CSV utility functions for parsing and generating CSV data

export interface CSVRow {
  [key: string]: string | number | boolean;
}

export interface ParseResult<T = CSVRow> {
  headers: string[];
  rows: T[];
  errors: string[];
}

export interface ValidationResult<T = CSVRow> {
  row: T;
  rowIndex: number;
  isValid: boolean;
  errors: string[];
}

// Parse CSV string into structured data
export function parseCSV(csvString: string): ParseResult {
  const lines = csvString.trim().split(/\r?\n/);
  const errors: string[] = [];

  if (lines.length === 0) {
    return { headers: [], rows: [], errors: ["Empty CSV file"] };
  }

  const headers = parseCSVLine(lines[0]);
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);

    if (values.length !== headers.length) {
      errors.push(`Row ${i}: Expected ${headers.length} columns, got ${values.length}`);
      continue;
    }

    const row: CSVRow = {};
    headers.forEach((header, index) => {
      const value = values[index];
      // Try to convert to number if possible
      const numValue = parseFloat(value);
      row[header] = !isNaN(numValue) && value.trim() !== "" ? numValue : value;
    });
    rows.push(row);
  }

  return { headers, rows, errors };
}

// Parse a single CSV line, handling quoted values
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  values.push(current.trim());
  return values;
}

// Generate CSV string from data
export function generateCSV<T>(
  data: T[],
  columns: { key: keyof T; header: string }[]
): string {
  if (data.length === 0) {
    return columns.map((c) => escapeCSVValue(c.header)).join(",");
  }

  const headers = columns.map((c) => escapeCSVValue(c.header)).join(",");
  const rows = data.map((item) =>
    columns.map((c) => escapeCSVValue(String((item as any)[c.key] ?? ""))).join(",")
  );

  return [headers, ...rows].join("\n");
}

// Escape CSV value if necessary
function escapeCSVValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Download CSV file
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Read file content as string
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

// Validate rows with custom validator
export function validateRows<T extends CSVRow>(
  rows: T[],
  validator: (row: T, index: number) => string[]
): ValidationResult<T>[] {
  return rows.map((row, index) => {
    const errors = validator(row, index);
    return {
      row,
      rowIndex: index,
      isValid: errors.length === 0,
      errors,
    };
  });
}


export interface CsvRow {
  [key: string]: string;
}

export interface ProcessedData {
  headers: string[];
  rows: CsvRow[];
}

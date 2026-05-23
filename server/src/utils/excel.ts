/**
 * Excel / CSV 解析工具（复刻自 plugin/src/utils/excel.ts）
 */
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ParsedRow {
  [column: string]: string | number | boolean | null;
}

/** 从 Buffer 解析 Excel */
export function parseExcelBuffer(buffer: Buffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<ParsedRow>(sheet);
}

/** 从文本解析 CSV */
export function parseCSVText(text: string): ParsedRow[] {
  const result = Papa.parse<ParsedRow>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data;
}

/** 自动检测文件类型并解析 */
export function parseFile(filename: string, buffer: Buffer): ParsedRow[] {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    return parseCSVText(buffer.toString('utf-8'));
  }
  return parseExcelBuffer(buffer);
}

/** 提取列名 */
export function getColumns(rows: ParsedRow[]): string[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]);
}

/** 获取前 N 行预览 */
export function getPreview(rows: ParsedRow[], n = 5): ParsedRow[] {
  return rows.slice(0, n);
}

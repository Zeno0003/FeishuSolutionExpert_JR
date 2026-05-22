/**
 * Excel / CSV 解析工具（Phase 2: 批量导入）
 * 依赖：npm install xlsx papaparse
 */

/** 文件解析结果 */
export interface ParsedRow {
  [column: string]: string | number | boolean | null;
}

/** 字段映射：Excel 列名 → 飞书字段名 */
export interface FieldMapping {
  [excelColumn: string]: string;
}

/** 从 File 对象解析 Excel (.xlsx / .xls) */
export async function parseExcel(file: File): Promise<ParsedRow[]> {
  // 动态导入 xlsx，仅在实际使用时加载
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<ParsedRow>(sheet);
}

/** 从 File 对象解析 CSV */
export async function parseCSV(file: File): Promise<ParsedRow[]> {
  const Papa = await import('papaparse');
  const text = await file.text();
  return new Promise((resolve, reject) => {
    Papa.default.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (result: { data: ParsedRow[] }) => resolve(result.data),
      error: (err: Error) => reject(err),
    });
  });
}

/** 自动检测文件类型并解析 */
export async function parseFile(file: File): Promise<ParsedRow[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    return parseCSV(file);
  }
  return parseExcel(file);
}

/** 提取 Excel 的列名列表 */
export async function getColumns(file: File): Promise<string[]> {
  const rows = await parseFile(file);
  if (rows.length === 0) return [];
  return Object.keys(rows[0]);
}

/** 获取前 N 行预览数据 */
export async function getPreview(file: File, n: number = 5): Promise<ParsedRow[]> {
  const rows = await parseFile(file);
  return rows.slice(0, n);
}

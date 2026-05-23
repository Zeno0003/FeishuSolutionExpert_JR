/**
 * Phase 2：批量导入 — 解析 Excel/CSV 并逐行写入多维表格
 */
import { client, baseToken, resolveTableId } from '../client';
import { parseFile, getColumns, getPreview } from '../utils/excel';

interface ImportProgress {
  total: number;
  current: number;
  success: number;
  errors: string[];
}

type ProgressCallback = (p: ImportProgress) => void;

export interface ImportRequest {
  tableName: string;
  filename: string;
  buffer: Buffer;
  mapping: Record<string, string>; // Excel列名 → 飞书字段名
}

/** 执行批量导入，支持进度回调 */
export async function batchImport(
  req: ImportRequest,
  onProgress?: ProgressCallback,
): Promise<ImportProgress> {
  const tableId = await resolveTableId(req.tableName);
  const rows = parseFile(req.filename, req.buffer);

  if (rows.length === 0) {
    const result: ImportProgress = { total: 0, current: 0, success: 0, errors: [] };
    onProgress?.(result);
    return result;
  }

  let success = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const fields: Record<string, any> = {};

    for (const [excelCol, bitableField] of Object.entries(req.mapping)) {
      if (bitableField && row[excelCol] !== undefined && row[excelCol] !== null) {
        fields[bitableField] = row[excelCol];
      }
    }

    try {
      await client.bitable.v1.appTableRecord.create({
        path: { app_token: baseToken, table_id: tableId },
        data: { fields },
      });
      success++;
    } catch (e: any) {
      errors.push(`[第 ${i + 1} 行] ${e.message}`);
    }

    onProgress?.({ total: rows.length, current: i + 1, success, errors: [...errors] });
  }

  return { total: rows.length, current: rows.length, success, errors };
}

/** 预览文件（不导入，只返回列名和前 N 行） */
export async function previewFile(filename: string, buffer: Buffer) {
  const rows = parseFile(filename, buffer);
  return {
    columns: getColumns(rows),
    preview: getPreview(rows, 5),
    totalRows: rows.length,
  };
}

/**
 * Tab 2: 批量导入（Phase 2 占位 — 后续实现）
 * 流程：上传 Excel/CSV → 预览映射 → 确认导入
 */
import React, { useState } from 'react';
import { parseFile, getColumns, getPreview, type ParsedRow, type FieldMapping } from '../utils/excel';
import { getTargetTable, getSourceTable } from '../utils/bitable';

export default function BatchImport() {
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [allRows, setAllRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [targetTable, setTargetTable] = useState<string>('收货表');
  const [targetTableFields, setTargetTableFields] = useState<string[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    try {
      const [cols, previewRows, all] = await Promise.all([
        getColumns(f),
        getPreview(f, 5),
        parseFile(f),
      ]);
      setColumns(cols);
      setPreview(previewRows);
      setAllRows(all);
      setMapping({});
      setTargetTableFields([]);
    } catch (err: any) {
      alert(`文件解析失败: ${err.message}`);
    }
  };

  const handleLoadTargetFields = async () => {
    try {
      const table = await (targetTable === '收货表' ? getTargetTable() : getSourceTable());
      const fields = await table.getFields();
      setTargetTableFields(fields.map((f: any) => f.name));
    } catch (err: any) {
      alert(`加载字段失败: ${err.message}`);
    }
  };

  const handleMappingChange = (excelCol: string, bitableField: string) => {
    setMapping(prev => ({ ...prev, [excelCol]: bitableField }));
  };

  const handleImport = async () => {
    if (allRows.length === 0) return;
    setLoading(true);
    setProgress({ current: 0, total: allRows.length });

    try {
      const table = await (targetTable === '收货表' ? getTargetTable() : getSourceTable());

      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        const fields: Record<string, unknown> = {};
        for (const [excelCol, bitableField] of Object.entries(mapping)) {
          if (bitableField && row[excelCol] !== undefined) {
            fields[bitableField] = row[excelCol];
          }
        }
        await table.addRecord({ fields });
        setProgress({ current: i + 1, total: allRows.length });
      }
    } catch (err: any) {
      alert(`导入失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-content">
      <h3>批量导入（Excel / CSV）</h3>
      <p className="desc">上传 Excel 或 CSV 文件，映射列到飞书字段，批量写入多维表格。写入为串行，保证顺序。</p>

      <div className="form-row">
        <label>目标表：</label>
        <select value={targetTable} onChange={e => setTargetTable(e.target.value)}>
          <option value="收货表">收货表（配件库存）</option>
          <option value="辅助表格">辅助表格（整机收货）</option>
        </select>
        <button className="btn-secondary" onClick={handleLoadTargetFields} disabled={loading}>
          加载字段
        </button>
      </div>

      <div className="form-row">
        <label>选择文件：</label>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} disabled={loading} />
      </div>

      {file && (
        <p className="file-info">📄 {file.name}（{allRows.length} 条记录，{columns.length} 列）</p>
      )}

      {/* 列映射 */}
      {columns.length > 0 && targetTableFields.length > 0 && (
        <div className="mapping-section">
          <h4>字段映射</h4>
          <table className="mapping-table">
            <thead>
              <tr>
                <th>Excel 列</th>
                <th>→</th>
                <th>飞书字段</th>
              </tr>
            </thead>
            <tbody>
              {columns.map(col => (
                <tr key={col}>
                  <td>{col}</td>
                  <td>→</td>
                  <td>
                    <select
                      value={mapping[col] || ''}
                      onChange={e => handleMappingChange(col, e.target.value)}
                    >
                      <option value="">不导入</option>
                      {targetTableFields.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 预览 */}
      {preview.length > 0 && (
        <div className="preview-section">
          <h4>数据预览（前 5 行）</h4>
          <table className="preview-table">
            <thead>
              <tr>{columns.map(col => <th key={col}>{col}</th>)}</tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i}>{columns.map(col => <td key={col}>{String(row[col] ?? '')}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 导入按钮 */}
      {allRows.length > 0 && Object.keys(mapping).length > 0 && (
        <button className="btn-primary" onClick={handleImport} disabled={loading}>
          {loading
            ? `⏳ 导入中... ${progress?.current ?? 0} / ${progress?.total ?? 0}`
            : `导入 ${allRows.length} 条记录`}
        </button>
      )}

      {progress && (
        <div className="progress-section">
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
          <p className="progress-text">{progress.current} / {progress.total}</p>
        </div>
      )}
    </div>
  );
}

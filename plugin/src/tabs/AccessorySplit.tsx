/**
 * Tab 1: 配件拆分 —— 将勾选的整机记录拆分为 L/R/C 配件记录
 */
import React, { useState, useCallback } from 'react';
import { getPendingRecords, sortRecordsByKey, splitOneRecord, markProcessed } from '../utils/bitable';

interface Progress {
  total: number;
  current: number;
  success: number;
  errors: string[];
}

export default function AccessorySplit() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  const handleSplit = useCallback(async () => {
    setLoading(true);
    setProgress(null);

    try {
      // 1. 查询待处理记录
      const records = await getPendingRecords();

      if (records.length === 0) {
        setProgress({ total: 0, current: 0, success: 0, errors: [] });
        return;
      }

      // 2. 按编号排序
      const sorted = sortRecordsByKey(records);

      // 3. 串行逐条处理
      let success = 0;
      const errors: string[] = [];
      setProgress({ total: sorted.length, current: 0, success: 0, errors: [] });

      for (let i = 0; i < sorted.length; i++) {
        const record = sorted[i];
        const label = String(record.fields?.['整机编号'] ?? `#${i + 1}`);

        try {
          await splitOneRecord(record);    // 写入 L → R → C
          await markProcessed(record);     // 标记已处理
          success++;
        } catch (e: any) {
          errors.push(`[${label}] ${e.message}`);
        }

        setProgress({ total: sorted.length, current: i + 1, success, errors: [...errors] });
      }
    } catch (e: any) {
      setProgress({ total: 0, current: 0, success: 0, errors: [`初始化失败: ${e.message}`] });
    } finally {
      setLoading(false);
    }
  }, []);

  const stats = progress && progress.total > 0
    ? `✅ ${progress.success} / ${progress.total} 条` + (progress.errors.length > 0 ? `  ❌ ${progress.errors.length} 条失败` : '')
    : null;

  return (
    <div className="tab-content">
      <h3>配件拆分</h3>
      <p className="desc">将「辅助表格」中勾选「待拆分」的整机记录，<br />逐条拆分为 L（左耳）/ R（右耳）/ C（充电仓）三条配件记录。</p>

      <button
        className="btn-primary"
        onClick={handleSplit}
        disabled={loading}
      >
        {loading ? '⏳ 处理中...' : '一键拆分配件'}
      </button>

      {stats && <p className="stats">{stats}</p>}

      {progress && (
        <div className="progress-section">
          {progress.total > 0 && (
            <>
              {/* 进度条 */}
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="progress-text">{progress.current} / {progress.total}</p>
            </>
          )}

          {progress.total === 0 && !loading && (
            <p className="empty-hint">没有待拆分的整机记录。请在辅助表格中勾选「待拆分」复选框。</p>
          )}

          {/* 错误列表 */}
          {progress.errors.length > 0 && (
            <ul className="error-list">
              {progress.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

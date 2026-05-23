/**
 * Phase 1：配件拆分 — 将整机记录拆分为 L/R/C 三条配件记录
 */
import { client, baseToken, resolveTableId } from '../client';
import { CONFIG } from '../config';

interface SplitProgress {
  total: number;
  current: number;
  success: number;
  errors: string[];
}

type ProgressCallback = (p: SplitProgress) => void;
type ShouldContinue = () => boolean;

/** 查询所有待拆分的整机记录（已拆分 ≠ 勾选） */
async function getPendingRecords(sourceTableId: string) {
  const filter = `NOT(CurrentValue.[${CONFIG.processedField}])`;

  const resp = await client.bitable.v1.appTableRecord.list({
    path: { app_token: baseToken, table_id: sourceTableId },
    params: { page_size: CONFIG.pageSize, filter },
  });

  return resp.data?.items ?? [];
}

/** 构建出错标签：[物流单号 + 商品型号] 方便定位 */
function recordLabel(fields: Record<string, any>, index: number): string {
  const tracking = fields['物流单号'];
  const model = fields['商品型号'];
  if (tracking || model) {
    return [tracking, model].filter(Boolean).join(' / ');
  }
  return `#${index + 1}`;
}

/** 执行配件拆分，支持进度回调（用于 SSE 推送） */
export async function splitAccessories(onProgress?: ProgressCallback, shouldContinue?: ShouldContinue): Promise<SplitProgress> {
  const sourceTableId = await resolveTableId(CONFIG.sourceTableName);
  const targetTableId = await resolveTableId(CONFIG.targetTableName);

  // 1. 查询待处理记录
  const records = await getPendingRecords(sourceTableId);

  if (records.length === 0) {
    const result: SplitProgress = { total: 0, current: 0, success: 0, errors: [] };
    onProgress?.(result);
    return result;
  }

  // 2. 按整机ID排序
  const sorted = [...records].sort((a, b) => {
    const aKey = String((a.fields as any)?.[CONFIG.sourceKeyField] ?? '');
    const bKey = String((b.fields as any)?.[CONFIG.sourceKeyField] ?? '');
    return aKey.localeCompare(bKey);
  });

  let success = 0;
  const errors: string[] = [];

  // 3. 串行逐条处理（支持中途取消）
  for (let i = 0; i < sorted.length; i++) {
    if (shouldContinue && !shouldContinue()) {
      break;
    }
    const record = sorted[i];
    const recordId = record.record_id!;
    const fields = (record.fields ?? {}) as Record<string, any>;
    const label = recordLabel(fields, i);

    try {
      // 构建共享字段（来源→目标映射）
      const sharedFields: Record<string, any> = {};
      for (const [srcField, tgtField] of Object.entries(CONFIG.fieldMapping)) {
        if (fields[srcField] !== undefined) {
          sharedFields[tgtField] = fields[srcField];
        }
      }

      // 依次创建 C → R → L 配件记录
      for (const part of CONFIG.parts) {
        await client.bitable.v1.appTableRecord.create({
          path: { app_token: baseToken, table_id: targetTableId },
          data: {
            fields: {
              [CONFIG.linkField]: [recordId],
              [CONFIG.partMarkField]: part.mark,
              ...sharedFields,
            },
          },
        });
      }

      // 标记来源记录为已处理
      await client.bitable.v1.appTableRecord.update({
        path: { app_token: baseToken, table_id: sourceTableId, record_id: recordId },
        data: { fields: { [CONFIG.processedField]: true } },
      });

      success++;
    } catch (e: any) {
      errors.push(`[${label}] ${e.message}`);
    }

    onProgress?.({ total: sorted.length, current: i + 1, success, errors: [...errors] });
  }

  return { total: sorted.length, current: sorted.length, success, errors };
}

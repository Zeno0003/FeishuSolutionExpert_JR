/**
 * Bitable SDK 工具函数封装
 */
import { bitable } from '@lark-base-open/js-sdk';
import { CONFIG } from '../config';

/** 获取来源表（整机收货） */
export async function getSourceTable() {
  return bitable.base.getTableByName(CONFIG.sourceTableName);
}

/** 获取目标表（配件库存） */
export async function getTargetTable() {
  return bitable.base.getTableByName(CONFIG.targetTableName);
}

/** 查询所有待拆分的整机记录 */
export async function getPendingRecords() {
  const table = await getSourceTable();
  const filterStr = `AND(${CONFIG.autoGenerateField}.=true(),NOT(${CONFIG.processedField}.=true()))`;
  const { records } = await table.getRecords({
    filter: filterStr,
    pageSize: CONFIG.pageSize,
  });
  return records;
}

/** 按整机编号排序 */
export function sortRecordsByKey(records: any[]) {
  return [...records].sort((a, b) => {
    const aKey = String(a.fields[CONFIG.sourceKeyField] ?? '');
    const bKey = String(b.fields[CONFIG.sourceKeyField] ?? '');
    return aKey.localeCompare(bKey);
  });
}

/**
 * 为一条整机记录生成 3 条配件记录（L→R→C，串行写入）
 * @returns 成功数（3）或抛出异常
 */
export async function splitOneRecord(sourceRecord: any) {
  const tgtTable = await getTargetTable();

  // 构建共享字段
  const sharedFields: Record<string, unknown> = {};
  for (const [srcField, tgtField] of Object.entries(CONFIG.fieldMapping)) {
    if (sourceRecord.fields[srcField] !== undefined) {
      sharedFields[tgtField] = sourceRecord.fields[srcField];
    }
  }

  // 依次写入 L → R → C
  for (const part of CONFIG.parts) {
    await tgtTable.addRecord({
      fields: {
        [CONFIG.linkField]: sourceRecord.id,
        [CONFIG.partMarkField]: part.mark,
        [CONFIG.partSeqField]: part.seq,
        ...sharedFields,
      },
    });
  }
}

/** 标记来源记录为已处理 */
export async function markProcessed(sourceRecord: any) {
  const table = await getSourceTable();
  await table.updateRecord(sourceRecord.id, {
    fields: { [CONFIG.processedField]: true },
  });
}

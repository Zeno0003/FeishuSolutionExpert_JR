/**
 * 飞书 SDK 客户端 + 表名→ID 解析
 */
import { Client } from '@larksuiteoapi/node-sdk';

const client = new Client({
  appId: process.env.FEISHU_APP_ID!,
  appSecret: process.env.FEISHU_APP_SECRET!,
});

const baseToken = process.env.BASE_TOKEN!;

/** 缓存：表名 → table_id */
const tableIdCache = new Map<string, string>();

/** 根据表名获取 table_id（带缓存） */
export async function resolveTableId(tableName: string): Promise<string> {
  if (tableIdCache.has(tableName)) return tableIdCache.get(tableName)!;

  const resp = await client.bitable.v1.appTable.list({
    path: { app_token: baseToken },
  });

  const items = resp.data?.items;
  if (!items) throw new Error('无法获取 Base 中的表列表');

  for (const item of items) {
    if (item.name) tableIdCache.set(item.name, item.table_id!);
  }

  const id = tableIdCache.get(tableName);
  if (!id) throw new Error(`找不到表「${tableName}」，请确认表名是否正确`);
  return id;
}

/** 获取表中所有字段（字段名 → field_name 映射，用于 Web UI 展示） */
export async function getFieldMap(tableName: string): Promise<Map<string, string>> {
  const tableId = await resolveTableId(tableName);
  const resp = await client.bitable.v1.appTableField.list({
    path: { app_token: baseToken, table_id: tableId },
  });

  const map = new Map<string, string>();
  if (resp.data?.items) {
    for (const item of resp.data.items) {
      if (item.field_name) map.set(item.field_name, item.field_id!);
    }
  }
  return map;
}

/** 列出 Base 中所有表名 */
export async function listTableNames(): Promise<string[]> {
  const resp = await client.bitable.v1.appTable.list({
    path: { app_token: baseToken },
  });
  return (resp.data?.items ?? []).map(t => t.name!).filter(Boolean);
}

export { client, baseToken };

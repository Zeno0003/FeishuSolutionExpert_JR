/**
 * 字段选项校验 — 写入前过滤目标表不存在的选项值，避免 1254302 错误
 *
 * TODO: 当前方案只做跳过+告警，数据有损。
 *       若后续飞书开放 base:field:update 权限，可改为自动同步选项到目标表。
 */
import { client, baseToken } from '../client';

interface FieldOption {
  name: string;
}

interface FieldInfo {
  type: number;  // 3=SingleSelect, 4=MultiSelect
  validNames: Set<string>;
}

export interface FieldGuard {
  /** fieldName → 该字段在目标表中的合法选项值集合 */
  fields: Map<string, FieldInfo>;
}

/**
 * 构建字段校验器：拉取目标表指定字段的合法选项列表
 * @param tableId 目标表 ID
 * @param fieldNames 需要校验的字段名列表
 */
export async function buildFieldGuard(tableId: string, fieldNames: string[]): Promise<FieldGuard> {
  const fields = new Map<string, FieldInfo>();

  const resp = await client.bitable.v1.appTableField.list({
    path: { app_token: baseToken, table_id: tableId },
    params: { page_size: 100 },
  });

  const nameSet = new Set(fieldNames);

  for (const f of resp.data?.items ?? []) {
    if (!f.field_name || !nameSet.has(f.field_name)) continue;

    const prop = (f as any).property;
    const options: FieldOption[] = prop?.options ?? [];
    const uiTypeMap: Record<number, string> = { 3: 'SingleSelect', 4: 'MultiSelect' };

    if (uiTypeMap[f.type!]) {
      fields.set(f.field_name, {
        type: f.type!,
        validNames: new Set(options.map((o: FieldOption) => o.name)),
      });
    }
  }

  return { fields };
}

export interface ValidateResult {
  /** 通过校验的字段，可直接写入 */
  valid: Record<string, any>;
  /** 被跳过的字段及原始值 */
  skipped: Array<{ field: string; value: any }>;
}

/**
 * 校验待写入的字段值，过滤掉目标表不存在的选项
 * @param guard 目标表字段校验器
 * @param values 待校验的字段名→值映射
 */
export function validateFields(guard: FieldGuard, values: Record<string, any>): ValidateResult {
  const valid: Record<string, any> = {};
  const skipped: Array<{ field: string; value: any }> = [];

  for (const [fieldName, value] of Object.entries(values)) {
    if (value === undefined || value === null) continue;

    const info = guard.fields.get(fieldName);
    if (!info) {
      // 非选项字段，直接通过
      valid[fieldName] = value;
      continue;
    }

    if (info.type === 4) {
      // MultiSelect: value 是数组，检查每个元素
      if (!Array.isArray(value)) {
        valid[fieldName] = value;
        continue;
      }
      const clean = value.filter((v: string) => info.validNames.has(v));
      if (clean.length === 0) {
        skipped.push({ field: fieldName, value });
      } else {
        valid[fieldName] = clean;
        if (clean.length < value.length) {
          skipped.push({ field: fieldName, value: value.filter((v: string) => !info.validNames.has(v)) });
        }
      }
    } else if (info.type === 3) {
      // SingleSelect: value 是字符串
      if (info.validNames.has(String(value))) {
        valid[fieldName] = value;
      } else {
        skipped.push({ field: fieldName, value });
      }
    }
  }

  return { valid, skipped };
}

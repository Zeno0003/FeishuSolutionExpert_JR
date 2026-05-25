/**
 * fetchSchema — 爬取指定表的完整字段定义，输出为 Markdown
 */
import { client, baseToken, resolveTableId, listTableNames } from '../client';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/** 字段类型 → 名称映射，优先用 ui_type（type 1/2 为复合类型） */
const UI_TYPE_MAP: Record<number, string> = {
  1: 'Text',
  2: 'Number',
  3: 'SingleSelect',
  4: 'MultiSelect',
  5: 'DateTime',
  7: 'Checkbox',
  11: 'User',
  13: 'Phone',
  15: 'Url',
  17: 'Attachment',
  18: 'SingleLink',
  19: 'Lookup',
  20: 'Formula',
  21: 'DuplexLink',
  22: 'Location',
  23: 'GroupChat',
  1001: 'CreatedTime',
  1002: 'ModifiedTime',
  1003: 'CreatedUser',
  1004: 'ModifiedUser',
  1005: 'AutoNumber',
};

/** 优先用 ui_type（Text/Number/Currency 等），其次用 type 查表 */
function fieldTypeName(f: any): string {
  if (f.ui_type) return f.ui_type;
  return UI_TYPE_MAP[f.type] ?? `Type${f.type}`;
}

function describeField(f: any): string {
  const typeName = fieldTypeName(f);
  let desc = `**${f.field_name}** (${typeName})`;
  const options = (f as any).property?.options as Array<{ name: string }> | undefined;
  if (options && options.length > 0) {
    desc += ` — ${options.map(o => `\`${o.name}\``).join(' | ')}`;
  }
  return desc;
}

export async function fetchSchema(tableNames: string[], outputDir: string) {
  mkdirSync(outputDir, { recursive: true });

  for (const name of tableNames) {
    console.log(`📋 正在拉取: ${name}`);
    try {
      const tableId = await resolveTableId(name);

      const resp = await client.bitable.v1.appTableField.list({
        path: { app_token: baseToken, table_id: tableId },
        params: { page_size: 100 },
      });

      const items = resp.data?.items ?? [];
      const lines: string[] = [
        `# ${name}`,
        '',
        `_table_id: ${tableId}_`,
        '',
        `| # | 字段名 | 类型 | 选项 |`,
        `|---|--------|------|------|`,
      ];

      items.forEach((f, i) => {
        const typeName = fieldTypeName(f);
        const options = (f as any).property?.options as Array<{ name: string }> | undefined;
        const optStr = options ? options.map(o => o.name).join(', ') : '-';
        lines.push(`| ${i + 1} | ${f.field_name} | ${typeName} | ${optStr} |`);
      });

      lines.push('');

      const filePath = join(outputDir, `${name}.md`);
      writeFileSync(filePath, lines.join('\n'), 'utf-8');
      console.log(`  ✅ ${items.length} 个字段 → ${filePath}`);
    } catch (e: any) {
      console.log(`  ❌ 失败: ${e.message}`);
    }
    console.log('');
  }
}

/** 按分组批量拉取并生成汇总文档 */
export async function fetchSchemaGrouped(
  groups: Record<string, string[]>,
  outputDir: string,
) {
  mkdirSync(outputDir, { recursive: true });

  // 先拉取所有表的字段详情
  const allNames = Object.values(groups).flat();
  const results: Record<string, Array<{ name: string; type: string; options: string }>> = {};

  for (const name of allNames) {
    console.log(`📋 正在拉取: ${name}`);
    try {
      const tableId = await resolveTableId(name);
      const resp = await client.bitable.v1.appTableField.list({
        path: { app_token: baseToken, table_id: tableId },
        params: { page_size: 100 },
      });

      const items = resp.data?.items ?? [];
      results[name] = items.map((f: any) => {
        const options = (f as any).property?.options as Array<{ name: string }> | undefined;
        return {
          name: f.field_name ?? '?',
          type: fieldTypeName(f),
          options: options ? options.map(o => o.name).join(', ') : '-',
        };
      });

      // 单独写入每张表的 md
      const lines = buildTableMd(name, tableId, results[name]);
      const filePath = join(outputDir, `${name}.md`);
      writeFileSync(filePath, lines.join('\n'), 'utf-8');
      console.log(`  ✅ ${items.length} 个字段 → ${filePath}`);
    } catch (e: any) {
      console.log(`  ❌ 失败: ${e.message}`);
      results[name] = [];
    }
    console.log('');
  }

  // 生成汇总文档
  const summaryLines: string[] = [
    '# 飞书多维表格字段总览',
    '',
    `> 生成时间: ${new Date().toLocaleString('zh-CN')}`,
    '',
  ];

  for (const [groupName, names] of Object.entries(groups)) {
    summaryLines.push(`## ${groupName}`, '');
    for (const name of names) {
      const fields = results[name] ?? [];
      summaryLines.push(`### ${name}`, '');
      summaryLines.push(`| # | 字段名 | 类型 | 选项 |`);
      summaryLines.push(`|---|--------|------|------|`);
      fields.forEach((f, i) => {
        summaryLines.push(`| ${i + 1} | ${f.name} | ${f.type} | ${f.options} |`);
      });
      summaryLines.push('');
    }
  }

  const summaryPath = join(outputDir, '字段总览.md');
  writeFileSync(summaryPath, summaryLines.join('\n'), 'utf-8');
  console.log(`📄 汇总文档 → ${summaryPath}`);
}

function buildTableMd(
  name: string,
  tableId: string,
  fields: Array<{ name: string; type: string; options: string }>,
): string[] {
  const lines: string[] = [
    `# ${name}`,
    '',
    `_table_id: ${tableId}_`,
    '',
    `| # | 字段名 | 类型 | 选项 |`,
    `|---|--------|------|------|`,
  ];
  fields.forEach((f, i) => {
    lines.push(`| ${i + 1} | ${f.name} | ${f.type} | ${f.options} |`);
  });
  lines.push('');
  return lines;
}

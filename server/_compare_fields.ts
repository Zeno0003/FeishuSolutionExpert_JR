import 'dotenv/config';
import { Client } from '@larksuiteoapi/node-sdk';

const c = new Client({ appId: process.env.FEISHU_APP_ID!, appSecret: process.env.FEISHU_APP_SECRET! });
const token = process.env.BASE_TOKEN!;
const sourceTableId = 'tblvMHqaEeQ8k8TZ';
const targetTableId = 'tblkkmVhswToatKe';

async function getFieldOptions(tableId: string, label: string) {
  const r = await c.bitable.v1.appTableField.list({
    path: { app_token: token, table_id: tableId },
    params: { page_size: 100 },
  });

  const result: Record<string, { type: string; options: string[] }> = {};

  for (const f of r.data?.items ?? []) {
    const type = f.ui_type;
    if (type === 'MultiSelect' || type === 'SingleSelect') {
      // Try to extract options from property field
      const prop = (f as any).property;
      const optNames: string[] = [];
      if (prop?.options) {
        for (const opt of prop.options) {
          optNames.push(opt.name ?? opt.text ?? JSON.stringify(opt));
        }
      }
      result[f.field_name!] = { type, options: optNames };
    }
  }

  console.log(`\n=== ${label} ===`);
  for (const [name, info] of Object.entries(result)) {
    console.log(`  [${info.type}] ${name}: ${info.options.length > 0 ? info.options.join(', ') : '(无选项数据)'}`);
  }

  return result;
}

async function main() {
  const sourceFields = await getFieldOptions(sourceTableId, '辅助填表_采购收货(芳)');
  const targetFields = await getFieldOptions(targetTableId, '采购收货表');

  // 比较共同字段的选项差异
  console.log('\n=== 字段选项对比 ===');
  const commonKeys = Object.keys(sourceFields).filter(k => targetFields[k]);
  for (const key of commonKeys) {
    const src = sourceFields[key].options;
    const tgt = targetFields[key].options;
    const srcOnly = src.filter(o => !tgt.includes(o));
    const tgtOnly = tgt.filter(o => !src.includes(o));
    if (srcOnly.length > 0 || tgtOnly.length > 0) {
      console.log(`\n  ⚠️  ${key} (${sourceFields[key].type}):`);
      if (srcOnly.length > 0) console.log(`    来源表独有: ${srcOnly.join(', ')}`);
      if (tgtOnly.length > 0) console.log(`    目标表独有: ${tgtOnly.join(', ')}`);
    } else {
      console.log(`\n  ✅ ${key}: 选项一致 (${src.length} 个)`);
    }
  }
}

main().catch(e => console.error(e));

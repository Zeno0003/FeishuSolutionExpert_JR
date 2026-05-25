/**
 * CLI 入口 — npm run split / import / fetch-schema
 */
import 'dotenv/config';
import path from 'path';
import { splitAccessories } from './commands/split';
import { fetchSchemaGrouped } from './commands/fetchSchema';

// 表分组定义：按飞书左侧目录结构组织
const TABLE_GROUPS: Record<string, string[]> = {
  '质检-入库': ['生成质检工资单', '生成采退表', '生成主仓入库单', '兼职工作日志'],
  '采购-收货': ['采购需求', '采购表', '采购收货表', '生成采购单', '辅助填表_采购收货(芳)'],
};

const cmd = process.argv[2];

async function main() {
  if (!cmd) {
    console.log('用法:');
    console.log('  npm run split                配件拆分');
    console.log('  npm run import <文件> <表名> 批量导入');
    console.log('  npm run fetch-schema         爬取业务表字段定义 → _data/');
    process.exit(1);
  }

  if (cmd === 'split') {
    console.log('正在执行配件拆分...\n');
    const result = await splitAccessories((p) => {
      if (p.total > 0 && p.current % 10 === 0) {
        process.stdout.write(`\r  处理中... ${p.current}/${p.total}  ✅ ${p.success}`);
      }
    });
    console.log(`\r✅ 完成！成功 ${result.success}/${result.total} 条`);
    if (result.errors.length > 0) {
      console.log('❌ 失败明细：');
      result.errors.forEach(e => console.log('  - ' + e));
    }
  } else if (cmd === 'import') {
    console.log('CLI 导入暂未实现，请使用 Web 界面（npm run dev）进行批量导入。');
  } else if (cmd === 'fetch-schema') {
    const outputDir = path.resolve(__dirname, '..', '..', '_data', 'tableSchemas');
    await fetchSchemaGrouped(TABLE_GROUPS, outputDir);
  } else {
    console.log(`未知命令: ${cmd}`);
  }
}

main().catch(e => { console.error('执行失败:', e.message); process.exit(1); });

/**
 * CLI 入口 — npm run split / npm run import
 */
import 'dotenv/config';
import { splitAccessories } from './commands/split';

const cmd = process.argv[2];

async function main() {
  if (!cmd) {
    console.log('用法: npm run split  或  npm run import <文件路径> <目标表名>');
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
  } else {
    console.log(`未知命令: ${cmd}`);
  }
}

main().catch(e => { console.error('执行失败:', e.message); process.exit(1); });

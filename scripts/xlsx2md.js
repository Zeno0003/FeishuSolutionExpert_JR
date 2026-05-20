// xlsx2md.js — 将 Excel 文件转成 Markdown 表格，便于 Read 工具直接阅读
//
// 用法:
//   node scripts/xlsx2md.js <xlsx路径>           → 单个文件，输出 .md 在同目录
//   node scripts/xlsx2md.js <xlsx路径> <md路径>  → 指定输出路径
//   node scripts/xlsx2md.js <目录路径>            → 转换目录下所有 .xlsx
//
// 示例:
//   node scripts/xlsx2md.js _business/质检表格.xlsx
//   node scripts/xlsx2md.js _business             → 转换 _business 下所有 Excel

const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// --- 核心：单文件转换 ---
function xlsxToMarkdown(xlsxPath, mdPath) {
  if (!mdPath) {
    mdPath = xlsxPath.replace(/\.xlsx$/i, '.md');
  }

  const wb = XLSX.readFile(xlsxPath);
  const lines = [];
  lines.push(`# ${path.basename(xlsxPath, '.xlsx')}`);
  lines.push('');
  lines.push(`> 由 \`${path.basename(xlsxPath)}\` 自动生成 | ${wb.SheetNames.length} 个子表`);
  lines.push('');

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    lines.push('---');
    lines.push('');
    lines.push(`## ${sheetName}`);
    lines.push('');

    // 去掉全空行
    const nonEmptyRows = data.filter(row => row.some(c => c !== ''));

    if (nonEmptyRows.length === 0) {
      lines.push('_(空表)_');
      lines.push('');
      continue;
    }

    // 去掉全空列
    const maxCol = Math.max(...nonEmptyRows.map(r => r.length));
    const colUsed = [];
    for (let c = 0; c < maxCol; c++) {
      colUsed[c] = nonEmptyRows.some(r => r[c] !== '' && r[c] !== undefined);
    }

    const filteredRows = nonEmptyRows.map(row =>
      row.filter((_, ci) => colUsed[ci])
    );

    // 计算每列最大宽度（用于对齐）
    const colWidths = [];
    for (let ci = 0; ci < (filteredRows[0]?.length || 0); ci++) {
      colWidths[ci] = Math.max(
        ...filteredRows.map(r => {
          const s = String(r[ci] ?? '');
          // 不计转义反斜杠的长度
          return Math.max(...s.split('\n').map(line => line.length));
        })
      );
      // 最小 3 字符宽
      if (colWidths[ci] < 3) colWidths[ci] = 3;
    }

    // 渲染表格
    for (let ri = 0; ri < filteredRows.length; ri++) {
      const row = filteredRows[ri];
      const cells = row.map((v, ci) => {
        const s = String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' / ');
        return s.padEnd(colWidths[ci], ' ');
      });

      lines.push(`| ${cells.join(' | ')} |`);

      // 表头后加分隔线
      if (ri === 0) {
        const sep = colWidths.map(w => '-'.repeat(w)).join(' | ');
        lines.push(`|-${sep}-|`);
      }
    }

    lines.push('');
  }

  fs.writeFileSync(mdPath, lines.join('\n'), 'utf-8');
  return mdPath;
}

// --- main ---
const input = process.argv[2];
const output = process.argv[3];

if (!input) {
  console.log('用法: node scripts/xlsx2md.js <xlsx路径 | 目录路径> [输出路径]');
  console.log('示例: node scripts/xlsx2md.js _business/质检表格.xlsx');
  console.log('      node scripts/xlsx2md.js _business              → 批量转换');
  process.exit(1);
}

const stat = fs.statSync(input);
if (stat.isDirectory()) {
  // 目录 → 转换所有 .xlsx
  const files = fs.readdirSync(input).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  if (files.length === 0) {
    console.log('目录下没有 .xlsx 文件');
    process.exit(1);
  }
  for (const f of files) {
    const xp = path.join(input, f);
    const mp = output ? path.join(output, f.replace(/\.xlsx$/i, '.md')) : undefined;
    const result = xlsxToMarkdown(xp, mp);
    console.log(`  ✓ ${result}`);
  }
  console.log(`完成：${files.length} 个文件`);
} else {
  // 单个文件
  const result = xlsxToMarkdown(input, output);
  console.log(`✓ ${result}`);
}

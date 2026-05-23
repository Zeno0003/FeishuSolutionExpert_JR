/**
 * Express 服务 + SSE 进度推送
 */
import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { splitAccessories } from './commands/split';
import { batchImport, previewFile } from './commands/import';
import { listTableNames, getFieldMap } from './client';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- SSE 工具 ----------
function sse(res: express.Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ---------- API：配件拆分 ----------
app.get('/api/split', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  let cancelled = false;
  req.on('close', () => { cancelled = true; });

  try {
    const result = await splitAccessories(
      (p) => { if (!cancelled) sse(res, 'progress', p); },
      () => !cancelled,
    );
    if (!cancelled) sse(res, 'done', result);
  } catch (e: any) {
    if (!cancelled) sse(res, 'error', { message: e.message });
  }
  res.end();
});

// ---------- API：上传文件预览 ----------
app.post('/api/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传文件' });
    const result = await previewFile(req.file.originalname, req.file.buffer);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- API：批量导入 ----------
app.post('/api/import', upload.single('file'), async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  try {
    if (!req.file) {
      sse(res, 'error', { message: '请上传文件' });
      return res.end();
    }

    const { tableName, mapping } = JSON.parse(req.body.config ?? '{}');
    if (!tableName || !mapping) {
      sse(res, 'error', { message: '缺少 tableName 或 mapping 参数' });
      return res.end();
    }

    const result = await batchImport(
      { tableName, filename: req.file.originalname, buffer: req.file.buffer, mapping },
      (p) => sse(res, 'progress', p),
    );
    sse(res, 'done', result);
  } catch (e: any) {
    sse(res, 'error', { message: e.message });
  }
  res.end();
});

// ---------- API：列出表名 ----------
app.get('/api/tables', async (_req, res) => {
  try {
    const names = await listTableNames();
    res.json(names);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- API：列出表字段 ----------
app.get('/api/tables/:name/fields', async (req, res) => {
  try {
    const fieldMap = await getFieldMap(req.params.name);
    const fields = Array.from(fieldMap.entries()).map(([name, id]) => ({ name, id }));
    res.json(fields);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- 启动 ----------
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

function validateEnv() {
  const missing: string[] = [];
  if (!process.env.FEISHU_APP_ID) missing.push('FEISHU_APP_ID');
  if (!process.env.FEISHU_APP_SECRET) missing.push('FEISHU_APP_SECRET');
  if (!process.env.BASE_TOKEN) missing.push('BASE_TOKEN');
  if (missing.length > 0) {
    console.error(`❌ 缺少必要的环境变量：${missing.join(', ')}`);
    console.error('请复制 .env.example 为 .env 并填写实际值');
    process.exit(1);
  }
}

validateEnv();

app.listen(PORT, () => {
  console.log(`🚀 飞书多维表格工具集已启动`);
  console.log(`   打开浏览器访问 http://localhost:${PORT}`);
});

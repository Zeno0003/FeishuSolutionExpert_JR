# 飞书多维表格 API 开发经验总结

> 基于「配件拆分」自研工具的开发、调试、踩坑全过程

---

## 一、应用配置与权限

### 1. 权限配置完整链路

飞书自建应用的权限不是开发者控制台配完就生效的，需要四步：

1. **开发者控制台** → 权限管理 → 添加 API 权限（格式 `base:{resource}:{action}`）
2. **发布版本** → 创建新版本并发布
3. **管理员审核** → 打开 `admin.feishu.cn` → 应用审核 → 通过授权
4. **Base 协作者** → 在 Base 右上角设置 → 添加文档应用（不是"添加协作者"）

缺少任何一步都可能导致 403 / 99991672 错误。

### 2. 本次用到的权限清单

| 权限 | 用途 |
|------|------|
| `base:app:read` | 列出 Base 中的表 |
| `base:table:read` | 读取表结构 |
| `base:field:read` | 读取字段定义 |
| `base:record:retrieve` | 读取记录列表 |
| `base:record:create` | 创建记录 |
| `base:record:update` | 更新记录 |

> `base:record:delete` 未配置，所以无法通过 API 清理测试数据。

---

## 二、SDK 调用规范

### SDK 包名

正确包名是 `@larksuiteoapi/node-sdk`，**不是** `@lark-base-open/js-sdk`（那是插件专属的）。

### 调用格式

```ts
client.bitable.v1.{resource}.{action}({
  path: { app_token, table_id, record_id },   // 路径参数统一放 path
  data: { fields: { ... } },                   // 请求体
  params: { page_size, filter, page_token },   // 查询参数
});
```

注意 `app_token` 和 `table_id` 在 `path` 对象里，不是顶层参数。

### 关联字段（DuplexLink, type:21）写入

```ts
fields: { '关联整机记录': [sourceRecordId] }
```

写入时传记录 ID 数组即可，关联自动双向生效。读取时返回的格式是对象数组：
```json
[{"record_ids":["recxxx"],"table_id":"tblxxx","text":"","text_arr":[""],"type":"text"}]
```

---

## 三、字段类型的坑

### 1. 复选框判断

飞书复选框 **未勾选 = 字段不存在**（不是 `false`）。

```ts
// ❌ 错误：会把未勾选的也匹配进来
filter = `CurrentValue.[已拆分] != true`

// ✅ 正确：只匹配未勾选
filter = `NOT(CurrentValue.[已拆分])`
```

### 2. MultiSelect / SingleSelect 选项不一致

来源表和目标表的同名字段，选项可能不一样。写入目标表不存在的选项 → `1254302 Permission denied`。

```ts
// 来源表 '供应商名称' (MultiSelect) → API 返回 ["蔡雨诗"]
// 目标表 '供应商名称' (MultiSelect) → 没有 "蔡雨诗" 这个选项
// 写入 ["蔡雨诗"] → 1254302
```

**排查方法**：用 `appTableField.list` 拉取两表字段定义，对比 `property.options`。

**应对策略**：
- 短期：两边手动对齐选项
- 长期：代码层面做降级处理，或自动检测差异并提示

### 3. 字段类型对照表（全量）

> **来源**：飞书开放平台官方文档 + `fetch-schema` 命令实测验证。type 1/2 是复合类型，渲染时优先用 `ui_type`。

| type | 名称 | 写入格式 |
|------|------|---------|
| 1 | Text / Barcode / Email | 字符串 |
| 2 | Number / Progress / Currency / Rating | 数字 |
| 3 | SingleSelect | 字符串 |
| 4 | MultiSelect | 字符串数组 |
| 5 | DateTime | 毫秒时间戳 |
| 7 | Checkbox | `true` / 不传 |
| 11 | User | `[{"id":"ou_xxx"}]` |
| 13 | Phone | 字符串 |
| 15 | Url | `{"link":"...","text":"..."}` |
| 17 | Attachment | `[{"file_token":"..."}]` |
| 18 | SingleLink | 记录 ID 字符串数组 |
| 19 | Lookup | 只读（查找引用） |
| 20 | Formula | 只读 |
| 21 | DuplexLink | 记录 ID 字符串数组 |
| 22 | Location | `{"location":...}` |
| 23 | GroupChat | 群组 ID |
| 1001 | CreatedTime | 只读（系统字段） |
| 1002 | ModifiedTime | 只读（系统字段） |
| 1003 | CreatedUser | 只读（系统字段） |
| 1004 | ModifiedUser | 只读（系统字段） |
| 1005 | AutoNumber | 只读（自动编号） |

> **踩坑**：批量导入的 JSON 字段中，若数字值被解析为字符串（如 `"5"` 而非 `5`），Number 类型字段可能写入失败。需在导入前校验类型并转换。

---

## 四、调试方法论

### 逐步隔离法

当一批记录只有某些失败时：

1. 先确认失败记录的 ID 和数据
2. 逐个字段测试写入（从最少字段开始，逐个添加）
3. 对比成功与失败记录的字段差异
4. 定位到具体字段后，再细分值的格式（字符串 vs 数组 vs 空值）

### 调试脚本模板

```ts
// _debug.ts 单文件，可直接 npx tsx _debug.ts 运行
import 'dotenv/config';
import { Client } from '@larksuiteoapi/node-sdk';

const c = new Client({ ... });
// 测试单个操作，打印详细错误
try {
  await c.bitable.v1.appTableRecord.create({ ... });
  console.log('✅');
} catch(e: any) {
  console.log('❌', e.response?.data?.code, e.response?.data?.msg);
}
```

---

## 五、架构决策记录

1. **串行处理 + 取消支持**：`for + await` 逐条处理，通过 `shouldContinue()` 回调 + `req.on('close')` 实现中途取消
2. **SSE 推送进度**：浏览器 `EventSource` 接收，`event: progress / done / error`
3. **表名→ID 缓存**：`Map<string, string>` 内存缓存，避免每次解析
4. **配置集中管理**：`src/config.ts` 存放表名、字段映射、配件定义，改动只需改一处
5. **测试数据清理**：调试脚本不要在生产表跑，或至少记录创建的记录 ID 方便回滚

---

## 六、字段爬取工具 (fetch-schema)

### 用途

一键拉取飞书多维表格中所有表的字段定义（名称、类型、选项值），输出为 Markdown 文档，用于业务方案重构前了解现有数据底座。

### 使用方式

```bash
npm run fetch-schema
```

输出到 `_data/tableSchemas/`：
- 每张表一个 `表名.md`
- `字段总览.md` — 按业务目录分组的汇总视图

### 配置

编辑 `server/src/cli.ts` 中的 `TABLE_GROUPS` 对象：

```ts
const TABLE_GROUPS: Record<string, string[]> = {
  '质检-入库': ['生成质检工资单', '生成采退表', ...],
  '采购-收货': ['采购需求', '采购表', ...],
};
```

key 为目录名（仅用于分组展示），value 为飞书多维表格中的**精确表名**。

### 经验教训

1. **type 1/2 是复合类型**：Text/Barcode/Email 都是 type=1，Number/Progress/Currency/Rating 都是 type=2。渲染字段类型时**优先用 `ui_type`**（如 `Barcode`、`Currency`），`type` 只作为兜底。
2. **Lookup (type=19) 大量出现**：在"生成X"类子表中，多数字段是通过关联引用从上游表查来的 Lookup 字段，这是飞书 MVP 方案的核心模式。
3. **AutoNumber (type=1005) 是系统自动编号**：只在读取时返回，创建记录时自动生成，不可手动写入。
4. **选项值是方案重构的关键输入**：SingleSelect/MultiSelect 的 `property.options` 直接告诉你当前业务用了哪些枚举值，这是新旧方案切换时最容易遗漏的数据。

---
## 七、待完善项

- [ ] MultiSelect/SingleSelect 选项不一致的自动检测与降级处理
- [ ] 拆分前对来源数据进行字段级校验，提前发现不兼容数据
- [ ] 增加 `base:record:delete` 权限，支持测试数据清理
- [ ] 记录翻页（`page_token`）目前未充分验证，大批量场景需测试

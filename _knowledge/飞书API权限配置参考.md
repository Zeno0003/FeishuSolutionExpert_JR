# 飞书 Bitable API 权限配置参考

> 适用项目：`server/` — 飞书多维表格工具集
> 更新：2026-05-23

## 一、需要开通的权限（精确版）

在飞书开发者后台 → 权限管理 → 多维表格分类，逐一搜索并勾选 **6 个权限**：

| # | 权限代码 | 中文名称 | 覆盖的 API | 代码用在哪 |
|---|----------|----------|-----------|------------|
| 1 | `base:app:read` | 获取多维表格信息 | `GET .../apps/{app_token}` | 验证 Base 访问权限、列出数据表 |
| 2 | `base:table:read` | 获取数据表信息 | `GET .../tables` | 启动时查所有表名→ID 映射 |
| 3 | `base:field:read` | 获取字段信息 | `GET .../tables/{id}/fields` | 批量导入时列出目标表字段 |
| 4 | `base:record:retrieve` | 根据条件搜索记录 | `GET .../tables/{id}/records`（带 filter） | 查待拆分记录：`待拆分=true AND 已拆分≠true` |
| 5 | `base:record:create` | 新增记录 | `POST .../tables/{id}/records` | 配件拆分写 L/R/C + 批量导入逐行写 |
| 6 | `base:record:update` | 更新记录 | `PUT .../tables/{id}/records/{id}` | 标记来源记录"已拆分=true" |

以上 6 个权限全部在「多维表格」分类下。

---

## 二、绝对不要勾的权限

以下权限虽然是多维表格分类下的，但本项目不需要：

- `base:record:delete` — 本项目不删数据
- `base:field:create` / `update` / `delete` — 本项目不改字段结构
- `base:table:create` / `update` / `delete` — 本项目不改表结构
- `base:view:*` — 本项目不操作视图
- `base:role:*` — 本项目不操作角色
- `base:dashboard:*` — 本项目不操作仪表盘
- `base:workflow:*` — 本项目不操作自动化流程
- `base:app:create` / `update` / `delete` / `copy` — 本项目不创建/修改/删除 Base
- `base:collaborator:*` — 本项目不管理协作者
- `base:form:*` — 本项目不操作表单

**原则**：权限开得越少越安全，只开必要的 5 个。

---

## 三、以后加新功能追什么权限

| 功能 | 需新增的权限 |
|------|------------|
| 批量创建记录（一次 500 条） | 无需新增，`base:record:create` 已覆盖 `batch_create` |
| 删除记录 | `base:record:delete` |
| 新建/删除字段 | `base:field:create` + `base:field:delete` |
| 群消息推送 | `im:message`（不在多维表格分类，在 IM 消息分类） |
| 审批流 | `approval:instance`（不在多维表格分类，在审批分类） |
| 文件上传 | `drive:drive`（不在多维表格分类，在云文档分类） |
| 通讯录 | `contact:contact`（不在多维表格分类，在通讯录分类） |

---

## 四、首次配置检查清单

- [ ] 飞书开放平台 → 创建企业自建应用
- [ ] 权限管理 → 搜索并勾选 5 个权限：
  - [ ] `base:app:read`
  - [ ] `base:table:read`
  - [ ] `base:field:read`
  - [ ] `base:record:retrieve`
  - [ ] `base:record:create`
  - [ ] `base:record:update`
- [ ] 应用发布 → 创建版本 → 申请发布 → 管理员审批通过
- [ ] `.env` 填写：
  - [ ] `FEISHU_APP_ID`（应用基本信息页）
  - [ ] `FEISHU_APP_SECRET`（同上）
  - [ ] `BASE_TOKEN`（飞书 Base 的 URL 中 `base/` 后面的那串）
- [ ] `config.ts` 表名/字段名与实际表格核对
- [ ] `npm run dev` → 打开 `localhost:3000` → 「批量导入」→ 点加载表列表，验证权限生效

---

## 五、权限 vs 代码 API 调用完整对照

```
base:app:read ──→
    client.ts           (隐式依赖：列出数据表需要先通过 Base 权限校验)

base:table:read ──→
    client.ts           GET /apps/{app_token}/tables                    列出所有表名

base:field:read ──→
    client.ts           GET /apps/{app_token}/tables/{table_id}/fields  列出字段名

base:record:retrieve ──→
    split.ts            GET /apps/{app_token}/tables/{table_id}/records  条件筛选查询
                        filter: AND(CurrentValue.[待拆分]=true,
                                     CurrentValue.[已拆分]!=true)

base:record:create ──→
    split.ts            POST /apps/{app_token}/tables/{table_id}/records  创建 L/R/C 记录
    import.ts           POST /apps/{app_token}/tables/{table_id}/records  逐行导入

base:record:update ──→
    split.ts            PUT /apps/{app_token}/tables/{table_id}/records/{id}  标记已拆分=true
```

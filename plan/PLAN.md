# Wetrace 群聊 JSON 同步与珠宝图片分类

## 总结

- 只生成 JSON 数据集和本地图片，不再提供 HTML、TXT、CSV。
- 支持按群聊、群成员、日期和消息类型同步。
- 图片 JSON 同时绑定数据集图片的绝对路径和相对路径。
- 同步后自动调用 Codex CLI，结合图片、图片文字及同群前后各 3 条文本消息分类。
- 分类分为两个固定维度：品类单选、工艺多选；不确定结果进入人工复核。

## 固定分类体系

品类单选，使用固定 ID：

| ID | 名称 |
|---|---|
| `plain_chain` | 素链 |
| `pendant` | 吊坠 |
| `bangle` | 手镯 |
| `bead_bracelet` | 手串 |
| `ring` | 戒指 |
| `bracelet` | 手链 |
| `earring` | 耳饰 |
| `collar` | 项圈 |
| `necklace_set` | 套链 |
| `accessory` | 配件 |

工艺多选，使用固定 ID：

| ID | 名称 |
|---|---|
| `plain_gold` | 素金 |
| `ancient_craft` | 古法 |
| `x5g` | x5G |
| `x3d` | x3D |
| `x5d` | x5D |
| `wedding` | 婚庆 |
| `platinum` | 铂金 |
| `white_silver` | 白银 |

- 首版不提供分类选项的新增、删除、改名或排序功能。
- 一张图片最多一个品类，可以有多个工艺，工艺 ID 必须去重。
- 自动识别无法确定品类时允许保存为空并进入待复核。
- 工艺可以为空，但必须区分：
  - `none`：明确没有匹配工艺。
  - `uncertain`：无法判断，需要人工复核。
- 人工最终确认时必须选择一个品类；工艺可以多选，也可以明确确认“无匹配工艺”。

## 同步与数据存储

数据集结构：

```text
dataset.json
conversations/<conversationId>.json
annotations/<conversationId>.json
classification/runs/<runId>.json
media/<conversationId>/<imageId>.<ext>
```

每张图片保存：

```json
{
  "imageId": "稳定图片ID",
  "absolutePath": "H:\\数据集\\media\\群聊ID\\图片ID.png",
  "relativePath": "media/群聊ID/图片ID.png",
  "pathStatus": "available",
  "sha256": "图片哈希"
}
```

- `absolutePath` 指向同步到数据集 `media` 目录后的图片，不保存不信源缓存路径。
- 主进程验证绝对路径确实位于当前数据集目录内，再提供给界面渲染。
- 数据集移动后，根据 `relativePath` 重新计算并原子更新 `absolutePath`。
- 增量同步使用稳定消息和图片 ID 去重，只追加新内容并重试缺失图片。
- 后续取消群聊、成员或缩短日期范围不会自动删除已保存的数据。
- JSON 是正式数据源；SQLite 仅作为可删除、可从 JSON 重建的查询缓存。

## 上下文与分类结果

每张图片的分类输入包括：

- 图片本身。
- 图片消息中可读的说明文字。
- 同群图片前最近 3 条有效文本消息。
- 同群图片后最近 3 条有效文本消息。
- 消息发送人、时间和原始顺序。

跳过系统通知、语音、视频、XML 原文和纯图片占位文本，不跨群聊读取上下文。

分类结果结构：

```json
{
  "imageId": "稳定图片ID",
  "state": "classified",
  "productCategory": {
    "id": "pendant",
    "decision": "selected"
  },
  "processes": {
    "ids": ["ancient_craft", "x5g"],
    "decision": "selected"
  },
  "recognizedText": {
    "value": "图片中识别出的文字",
    "source": "codex",
    "manuallyCorrected": false
  },
  "contextMessageIds": ["消息ID"],
  "evidence": ["visual", "image_text", "chat_context"],
  "reason": "简短分类依据",
  "source": "codex",
  "runId": "任务ID",
  "updatedAt": "ISO时间"
}
```

状态规则：

- `classified`：品类已确定，工艺为已选或明确无匹配。
- `needs_review`：品类不确定，或工艺判断为不确定。
- `failed`：Codex 命令、图片读取或结果解析失败。
- 人工修改识别文字、品类或工艺后标记为锁定，后续同步和自动识别不得覆盖。

## 界面与 Codex 任务

- 群聊选择页支持多选群聊，并为每个群保存独立成员、日期和文本/图片范围。
- 图片复核页按截图形式展示：
  - 品类使用单选按钮。
  - 工艺使用复选框。
  - 工艺为空时提供“确认无匹配工艺”选项。
- 支持按分类任务、品类、工艺、群聊、成员和状态筛选。
- 默认优先展示 `needs_review` 和 `failed` 图片，并支持批量设置工艺。
- 同步成功后自动分类新增和待处理图片，默认每批 8 张、串行执行。
- Codex 输出 Schema 强制：
  - 品类只能为空或选择一个固定 ID。
  - 工艺只能是固定 ID 数组。
  - 禁止创造新标签。
  - 必须返回图片文字及品类、工艺各自的判断状态。
- 首次分类前提示图片及前后消息会提交给 Codex 并消耗账户额度。
- CLI 不存在、未登录或分类失败时不回滚已经完成的 JSON 同步。[Codex 非交互模式](https://developers.openai.com/codex/noninteractive)

## 测试与验收

- 验证 10 个品类严格单选，8 个工艺支持多选、去重和空值确认。
- 验证非法分类 ID、多个品类、未知工艺或缺失判断状态会被拒绝并进入复核。
- 验证上下文严格来自同群前后各 3 条有效文本，顺序正确。
- 验证图片文字写入 JSON、人工修正后不会被覆盖。
- 验证绝对路径指向数据集图片，路径越界被拒绝，移动数据集后可以重新绑定。
- 验证增量同步去重、缺图重试、人工分类保留和旧数据不自动删除。
- 使用假 Codex 程序测试分类 Schema、进度、取消、失败和重试，不在自动测试中消耗真实额度。
- 验证界面和输出中不再存在 HTML、TXT、CSV 功能。
- 实施基于当前未提交的群聊记录功能继续扩展，不回滚现有修改；保持原文件编码、BOM 和换行格式，并遵守仓库要求不使用 `apply_patch`。

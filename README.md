# 微迹 Wetrace — 不信 PC 版聊天记录导出工具

> 群聊 SQLite 同步 · 本地图片数据集 · 珠宝分类复核

微迹（Wetrace）是一款 Windows 桌面工具，用于把不信 PC 版群聊同步为本地 SQLite 和图片数据集，并在界面中完成珠宝图片分类与人工复核。同步数据保存在本机；只有启用 Codex 自动分类时，才会在用户确认后提交所选图片及其群聊上下文。

---

## ⚠️ 免责声明

**本工具仅供个人学习、研究和技术交流。**

- 本工具为**第三方开源软件**，与腾讯不信（WeChat）**没有任何关联**，也未获得其授权或认可。
- 解密不信本地数据库涉及对不信客户端数据保护机制的技术研究，**仅供安全研究与学习目的**。请于下载后 24 小时内删除。
- 你导出的聊天记录**仅可用于个人备份与合法查阅**。请严格遵守所在地法律法规。
- **禁止**将本工具用于：
  - 窃取或窥探他人隐私
  - 未经授权访问他人账号数据
  - 任何非法用途或侵犯他人合法权益的行为
- 使用本工具即表示你确认**有权访问**目标账号的本地数据（即该账号为你本人所有或已获授权）。
- 因使用本工具产生的任何后果（包括但不限于数据丢失、账号异常、法律纠纷），**由使用者自行承担**，开发者不承担任何责任。
- 若不信官方要求，本仓库将配合关闭。

---

## 隐私承诺

- ✅ **单账号单目录** — 每个不信账号生成的数据库、群聊记录、图片和分类结果全部保存在各自指定目录
- ✅ **仅读写本地文件** — 操作范围仅限于你电脑上的不信数据目录和你指定的导出文件夹
- ✅ **不收集个人信息** — 无遥测、无埋点、无用户画像

---

## 功能特点

- 🔐 自动从本地不信进程提取数据库密钥（支持内存扫描 / DLL Hook 两种模式）
- 📂 按群聊、成员、日期和消息类型同步为 **SQLite**，图片复制到本地数据集
- 🏷️ 固定品类单选、工艺多选，支持 Codex 自动分类与人工复核锁定
- 👥 支持多账号切换，自动检测不信数据目录
- 💬 按会话筛选导出，支持搜索会话名称
- ⚡ 本地缓存解密库与会话扫描结果，重复扫描显著加速
- 🖥️ 图形界面（Electron），操作简单，步骤引导
- 🎙️ 支持语音转文字（SILK 解码 + 内置 Whisper 模型，全程本地识别）
- 📦 支持便携版和安装包两种分发方式

---

## 快速开始

### 方式一：下载便携版（推荐）

从 [Releases](https://github.com/city-of-star/Wetrace/releases) 页面下载 `微迹 Wetrace-2.2.1-portable.exe`（版本号以 Releases 为准），双击运行即可。

### 方式二：从源码运行

```bash
# 1. 克隆仓库
git clone https://github.com/city-of-star/Wetrace.git
cd Wetrace

# 2. 安装依赖
npm install

# 3. 启动
npm start
```

### 使用流程

1. **选择不信数据目录** — 自动检测或手动浏览 `xwechat_files` 文件夹
2. **选择账号 → 选择账号数据目录 → 扫描会话** — 首次可能需要几分钟；密钥与解密结果保存在该账号目录，再次扫描通常更快
3. **（新版不信）配合 Hook 捕获密钥** — 工具会自动重启不信，看到「Hook 已就绪」后点击「登录」
4. **进入群聊记录 → 点进群聊并确认读取 → 选择成员和范围** — 消息和图片自动保存到该账号的数据目录，筛选变化后自动增量补写

自动分类需要本机已安装并登录 Codex CLI。Wetrace 使用 [Codex 非交互模式](https://developers.openai.com/codex/noninteractive)提交每批最多 8 张图片；CLI 不可用或分类失败时，已经同步的 SQLite 和图片不会回滚。

扫描失败时，程序会自动保存诊断日志（不含聊天记录与密钥），可在失败提示中打开日志文件夹排查问题。

### 账号数据目录结构

群聊记录同步后的结构：

```
数据集/
├── dataset.db                          # 账号、扫描索引、分类体系、保存范围和分类任务
├── runtime/                            # 解密数据库、密钥缓存和群聊读取库
├── conversations/<conversationId>.db  # 消息、图片记录、上下文和人工注解
└── media/<conversationId>/<imageId>.* # 同步后的本地图片
```

---

## 技术原理

不信 PC 版将聊天记录存储在加密的 SQLite 数据库中。本工具通过以下方式获取解密密钥：


| 不信版本     | 方式       | 说明                           |
| -------- | -------- | ---------------------------- |
| < 4.1.10 | 内存扫描     | 不信登录后密钥明文存在于进程内存中，通过特征匹配定位   |
| ≥ 4.1.10 | DLL Hook | 密钥仅在登录瞬间出现，通过注入 DLL 拦截密钥派生过程 |


解密后的数据库保存在账号目录的 `db_storage_decrypted` 中，仅存在于本地磁盘，由用户完全控制。

若 Hook 捕获失败，也可将密钥 JSON 文件（如 `all_keys.json`、`keys.json`）放到账号目录，工具会自动尝试导入。

> 本项目是对不信客户端数据存储机制的技术研究。相关代码仅用于验证 SQLite 加密原理和 Windows 进程内存分析技术。

---

## 技术栈

- **运行时**: Node.js + Electron
- **数据库**: sql.js (SQLite compiled to WASM)
- **FFI**: koffi (调用 Windows API 和 Native DLL)
- **Native 模块**: C++ DLL (不信 Hook 模块，位于 `native/wexin-hook/`)
- **语音**: silk-wasm (SILK 解码) + @xenova/transformers (Whisper 本地转写)
- **压缩**: fzstd (消息内容解压)
- **打包**: electron-builder

---

## 打包发布

打包前需先编译 Hook DLL（仅首次或改过 native 代码后）：

```bash
npm run build:hook
```

若本机无法编译，可从 GitHub Actions 的 `wexin_hook-dll` 产物下载 DLL，放到 `assets/dll/` 目录（详见 `assets/dll/README.md`）。

便携版 exe：

```bash
npm run dist
```

安装包（NSIS）：

```bash
npm run dist:installer
```

产物在 `dist/` 目录，文件名类似 `微迹 Wetrace-2.1.0-portable.exe`（版本号以 `package.json` 为准）。

打包时会自动下载语音转文字模型（约 250MB）。若下载遇 SSL 证书错误，可尝试国内镜像：

```bash
# 方式一：HuggingFace 国内镜像（推荐）
set WETRACE_HF_ENDPOINT=https://hf-mirror.com
npm run download-whisper-model

# 方式二：临时跳过证书校验（仅下载模型时使用）
npm run download-whisper-model -- --insecure
```

---

## 项目结构

```
Wetrace/
├── electron/              # Electron 主进程与渲染进程
│   ├── main.js            # 主进程入口
│   ├── preload.js         # 上下文桥接
│   ├── renderer/          # 前端界面 (HTML/CSS/JS)
│   ├── scanWorker.js      # 会话扫描 Worker
│   ├── exportWorker.js    # 导出 Worker
│   └── profileWorker.js   # 账号资料 Worker
├── lib/                   # 核心逻辑
│   ├── exportCore.js      # 导出主流程
│   ├── decryptCore.js     # 解密调度
│   ├── keyScan.js         # 内存密钥扫描
│   ├── wxKeyHook.js       # DLL Hook 密钥捕获
│   ├── keyImport.js       # 密钥文件导入
│   ├── decryptDb.js       # 数据库解密
│   ├── conversationCache.js  # 会话扫描缓存
│   ├── voiceTranscription.js # 语音转文字
│   └── ...
├── native/wexin-hook/     # C++ Hook DLL 源码
├── assets/
│   ├── dll/               # 预编译 Hook DLL
│   └── models/            # Whisper 模型（打包时下载）
├── scripts/               # 构建脚本
├── .github/workflows/     # CI（含 Hook DLL 自动构建）
└── export.js              # CLI 导出入口
```

---

## License

本项目采用 [MIT License](LICENSE)。

> 注意：MIT 仅授权代码使用，**不意味着授权用于非法目的**。请务必阅读并遵守上方免责声明。

---

## 致谢

- [sql.js](https://github.com/sql-js/sql.js) — SQLite WASM 实现
- [koffi](https://github.com/Koromix/koffi) — Node.js FFI 库
- [Electron](https://www.electronjs.org/) — 跨平台桌面应用框架


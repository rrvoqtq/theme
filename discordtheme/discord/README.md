# Discord 美化 v2 — 三栏布局

## 安装（两种方式二选一）

### 方式 A：酒馆助手实时热重载（推荐，改代码立即生效）
1. 在 SillyTavern 已安装 `JS Slash Runner / Tavern Helper` 扩展。
2. 确认 `tavern_helper_template` 的监听端口 `6621` 正在运行：
   ```powershell
   $env:Path += ";D:\AppData\npm-global"
   cd tavern_helper_template
   npx webpack --watch --mode development
   ```
   或 `pnpm watch`（内部 `webpack --watch` + socket.io）。
3. 在酒馆网页打开 `扩展 → 酒馆助手 → 实时监听` 开关。此时 `src/discord-theme/index.ts` 每次保存都会自动推送到酒馆，无需刷新。
4. 编译产物在 `tavern_helper_template/dist/discord-theme/index.js`，已同步复制到 `美化插件/discord美化/discord/index.js`。

### 方式 B：作为 SillyTavern Extension 安装
1. 将本文件夹 `美化插件/discord美化/discord` 复制到 `SillyTavern/public/scripts/extensions/discord-theme/`。
2. 重启 SillyTavern，扩展会自动加载 `manifest.json` → `index.js`。
3. 如需样式隔离，可把 `index.ts` 顶部的 CSS 抽出为 `style.css` 并在 manifest 中引用。

## 已修复 / 已实现

- ① 服务器栏：48×48 圆角正方形、hover 12px、激活白条、tooltip、500ms 长按拖拽排序、新→旧排序。
- ② 侧边栏：顶部角色名+下拉箭头、P2 菜单（#111214，悬浮蓝/灰）、横幅、垂直化顶栏按钮（原横向 drawer 全部转为纵向频道样式）、文字频道列表（#前缀，激活高亮）、+新建聊天、右键重命名/删除/导出。
- ③ 聊天：顶部 `#频道名` 与输入框对齐、Discord 气泡（头像圆 40px 左置、昵称+时间、hover 按钮）、输入框仅占 ③ 区。
- 底部悬浮用户栏：仅占 ①+② 宽度 300px，不覆盖 ③ 输入栏；齿轮弹出左右分栏弹窗（左侧头像+在线点+导航，右侧克隆原设置面板，实时双向）。
- 世界书：`getCharWorldbookNames / getGlobalWorldbookNames / getWorldbook` 直连酒馆本体存储，展示 primary/additional/global，支持编辑/启用/新建/打开编辑器。
- 角色卡详情 P2→P4：点击下拉任意行进入全屏左右分栏`#dc-char-modal`（左 230px 导航，右 740px 内容，右上角 ✕/ESC 关闭），包含头像/描述/开场白/创作者注释/世界书/标签/高级定义（含折叠“提示词覆盖/元数据”）/Token 统计等，表单直连 `updateCharacterWith`。
- 顶栏纵向化：解析 `#top-settings-holder .drawer`，在侧边栏生成 `.dc-vtool` 纵向列表，顶部保留紧凑图标 ` .dc-top-icon`。
- 选择角色页清理：自动隐藏带 emoji 的菜单项（正则 emoji），仅保留“创建临时聊天”并置顶、去掉小箭头。
- 所有按钮均绑定真实功能（世界书、描述保存、标签、收藏、persona 切换、newchat 等），无空点击。

## 矛盾点说明
- 需求中既要求“移除角色管理/用户设定按钮”又要求“修复缺少角色管理按钮”—— 已折中：原横向按钮不再在顶部横排显示，而是转为侧边栏纵向列表保留全部功能，顶部仅保留 6-8 个精简图标。
- 世界书与角色卡编辑的保存均直接写入酒馆本体，避免重复造轮子。

## 验证
- `webpack --mode development` 编译成功，产物 ~272KB。
- 已复制到 `美化插件/discord美化/discord/index.js`。

## 实时预览
保持 `webpack --watch` 运行，酒馆网页保持开启且“实时监听”已启用即可边改边看。

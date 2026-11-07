# courseware-web

Vue 3 + TypeScript + Vite 课程门户。已实现登录、目录/课时检索、课程详情、修改密码、管理员用户与授权、课程仓库配置、同步任务、上架与版本回退。

```bash
npm ci
npm run dev
npm run build
```

本地入口为 `http://127.0.0.1:8814`，Vite 将 `/api/`、`/courses/` 和 `/health/` 代理到 `127.0.0.1:8008`。可用 `VITE_API_TARGET` 调整代理目标。安装包提供同源静态服务与代理，也可使用 Nginx，不把服务端会话 token 存入 localStorage。

课程名、封面、制作人、章节和统计来自 API。HTTP 类型来自 `courseware-api/openapi.json`，更新后执行 `npm run types`；不要手改 `src/api.generated.ts`。

界面采用本地系统字体与 lucide 图标，不依赖远程字体/CDN。CSS 颜色、排版与响应式样式位于 `src/tokens.css` 和 `src/style.css`。所有关键页面包含加载、空结果和错误状态，密码变更会要求重新登录。

## 浏览器验证

在完整 `courseware-dev` 工作区先准备原生 PostgreSQL 和本机 Chrome，然后执行：

```bash
npm run test:e2e
```

测试在 58174/58110 端口启动自己的前后端，使用 `courseware_e2e` 数据库，不改动开发库。覆盖桌面/手机上的搜索、课时交互、下载、登录退出、管理员建号与首次改密，以及登录和目录页的 axe 可访问性检查。截图写入根工作区 `.local/screenshots/`，失败信息和 trace 写入本仓库忽略的 `test-results/`。

## 安装包

发布为 `@farfarfun/courseware-web`，仅包含构建产物和服务 CLI，运行时不依赖 Vite 或源码。

```bash
npm install --global @farfarfun/courseware-web
courseware-web server start --port 8817 --backend http://127.0.0.1:8008
courseware-web server status
courseware-web server stop
courseware-web --version
```

配置首次生成于 `~/.farfarfun/courseware/frontend/config.json`，`CW_WEB_CONFIG_FILE` 或 `--config` 可覆盖；`server run` 前台运行，`restart` 重启。默认端口 8817 避免与 fundeploy 中 funlesson 冲突；既有开发/frpc 环境仍可使用 `--port 8814`。`/version.json` 返回实际包版本；`/api`、`/courses`、`/health` 均代理至后端，保留 Origin、会话 Cookie、Range 与授权错误。

`npm run test:cli` 验证独立服务的启动、停止、静态路由和代理。

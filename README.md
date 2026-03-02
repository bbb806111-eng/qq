# ShortDrama Studio Pro (Fullstack MVP)

已升级为可部署的全栈版本，包含：

- FastAPI 后端接口（登录、项目管理、生成服务）
- SQLite 数据库存储（用户、会话、项目、资产）
- 前端 SPA（调用真实后端 API）
- Docker 打包与部署文件

## 功能覆盖

1. 接 FastAPI 后端接口 ✅
2. 接入真实生成 API 接口层（当前为可替换 provider 的后端实现）✅
3. 项目保存到数据库 ✅
4. 登录与项目管理 ✅
5. 打包可部署版本 ✅

## 本地开发运行

### 1) 启动后端

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8001
```

### 2) 启动前端静态页

另开一个终端：

```bash
python3 -m http.server 8000
```

打开：

- 前端: http://127.0.0.1:8000
- 后端健康检查: http://127.0.0.1:8001/health

## Docker 部署

```bash
docker compose up --build
```

## 目录

- `index.html` / `styles.css` / `app.js`: 前端应用
- `backend/main.py`: FastAPI 服务
- `backend/requirements.txt`: 后端依赖
- `backend/app.db`: SQLite 数据库（运行时自动创建）
- `Dockerfile` / `docker-compose.yml`: 部署打包
- `PRODUCT_PRD.md`: 产品需求文档


## 预览 Not Found 排查

如果你在平台预览里看到 `Not Found`，通常是因为只启动了 API 服务但没有返回前端页面。当前版本已在 FastAPI 中提供 `/`、`/app.js`、`/styles.css` 路由，直接访问后端地址即可打开页面。
- 如果平台预览使用的是子路径（例如 `/preview/...`），后端已增加 SPA fallback，会自动回退到 `index.html`，不再出现空白页。

- 兼容 `/preview` 和 `/preview/*` 路径（很多在线预览容器会使用该前缀），避免再次出现 `Not Found`。

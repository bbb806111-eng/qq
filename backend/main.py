from datetime import datetime, timedelta
from typing import Optional, List
import hashlib
import os
import secrets
import sqlite3
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB_PATH = os.getenv("DB_PATH", "backend/app.db")
TOKEN_TTL_HOURS = 24


ROOT_DIR = Path(__file__).resolve().parent.parent
INDEX_FILE = ROOT_DIR / "index.html"
APP_JS_FILE = ROOT_DIR / "app.js"
STYLES_FILE = ROOT_DIR / "styles.css"

app = FastAPI(title="ShortDrama Studio API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with db_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                novel TEXT DEFAULT '',
                adapted_script TEXT DEFAULT '',
                structure_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                prompt TEXT DEFAULT '',
                image_url TEXT DEFAULT '',
                video_url TEXT DEFAULT '',
                data_json TEXT DEFAULT '{}',
                created_at TEXT NOT NULL,
                FOREIGN KEY(project_id) REFERENCES projects(id)
            );
            """
        )


@app.on_event("startup")
def startup():
    init_db()


class RegisterReq(BaseModel):
    username: str
    password: str


class LoginReq(BaseModel):
    username: str
    password: str


class ProjectCreateReq(BaseModel):
    name: str


class ProjectUpdateReq(BaseModel):
    name: Optional[str] = None
    novel: Optional[str] = None
    adapted_script: Optional[str] = None
    structure_json: Optional[dict] = None


class AdaptReq(BaseModel):
    text: str
    screen_mode: str = "竖屏"


class StoryboardReq(BaseModel):
    adapted_script: str


class AssetReq(BaseModel):
    storyboard: List[list]


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def create_token(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.utcnow() + timedelta(hours=TOKEN_TTL_HOURS)).isoformat()
    with db_conn() as conn:
        conn.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user_id, expires_at),
        )
    return token


def get_current_user_id(authorization: Optional[str] = Header(default=None)) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.replace("Bearer ", "", 1)
    with db_conn() as conn:
        row = conn.execute(
            "SELECT user_id, expires_at FROM sessions WHERE token = ?", (token,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid token")
    if datetime.fromisoformat(row["expires_at"]) < datetime.utcnow():
        raise HTTPException(status_code=401, detail="Token expired")
    return row["user_id"]



@app.get("/")
def web_index():
    if not INDEX_FILE.exists():
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(INDEX_FILE)


@app.get("/app.js")
def web_app_js():
    if not APP_JS_FILE.exists():
        raise HTTPException(status_code=404, detail="app.js not found")
    return FileResponse(APP_JS_FILE, media_type="application/javascript")


@app.get("/styles.css")
def web_styles():
    if not STYLES_FILE.exists():
        raise HTTPException(status_code=404, detail="styles.css not found")
    return FileResponse(STYLES_FILE, media_type="text/css")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/auth/register")
def register(req: RegisterReq):
    if len(req.username) < 3 or len(req.password) < 6:
        raise HTTPException(status_code=400, detail="用户名至少3位，密码至少6位")

    with db_conn() as conn:
        existing = conn.execute("SELECT id FROM users WHERE username = ?", (req.username,)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="用户名已存在")
        cur = conn.execute(
            "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
            (req.username, hash_password(req.password), datetime.utcnow().isoformat()),
        )
        user_id = cur.lastrowid
    token = create_token(user_id)
    return {"token": token, "username": req.username}


@app.post("/auth/login")
def login(req: LoginReq):
    with db_conn() as conn:
        user = conn.execute(
            "SELECT id, password_hash FROM users WHERE username = ?", (req.username,)
        ).fetchone()
    if not user or user["password_hash"] != hash_password(req.password):
        raise HTTPException(status_code=401, detail="账号或密码错误")
    token = create_token(user["id"])
    return {"token": token, "username": req.username}


@app.get("/projects")
def list_projects(user_id: int = Depends(get_current_user_id)):
    with db_conn() as conn:
        rows = conn.execute(
            "SELECT id, name, novel, adapted_script, structure_json, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC",
            (user_id,),
        ).fetchall()
    return [{**dict(r), "structure_json": r["structure_json"]} for r in rows]


@app.post("/projects")
def create_project(req: ProjectCreateReq, user_id: int = Depends(get_current_user_id)):
    now = datetime.utcnow().isoformat()
    with db_conn() as conn:
        cur = conn.execute(
            "INSERT INTO projects (user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (user_id, req.name, now, now),
        )
        pid = cur.lastrowid
    return {"id": pid, "name": req.name, "created_at": now, "updated_at": now}


@app.put("/projects/{project_id}")
def update_project(project_id: int, req: ProjectUpdateReq, user_id: int = Depends(get_current_user_id)):
    with db_conn() as conn:
        project = conn.execute(
            "SELECT id FROM projects WHERE id = ? AND user_id = ?", (project_id, user_id)
        ).fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="项目不存在")

        updates = []
        values = []
        if req.name is not None:
            updates.append("name = ?")
            values.append(req.name)
        if req.novel is not None:
            updates.append("novel = ?")
            values.append(req.novel)
        if req.adapted_script is not None:
            updates.append("adapted_script = ?")
            values.append(req.adapted_script)
        if req.structure_json is not None:
            updates.append("structure_json = ?")
            values.append(str(req.structure_json))

        updates.append("updated_at = ?")
        values.append(datetime.utcnow().isoformat())
        values.append(project_id)

        conn.execute(f"UPDATE projects SET {', '.join(updates)} WHERE id = ?", values)
    return {"ok": True}


@app.post("/generate/adapt")
def generate_adapt(req: AdaptReq, user_id: int = Depends(get_current_user_id)):
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="文本不能为空")
    highlights = []
    if any(k in text for k in ["震惊", "打脸", "反转", "碾压"]):
        highlights.append("打脸/反转点")
    if any(k in text for k in ["怒", "哭", "绝望", "热血", "燃"]):
        highlights.append("情绪高潮点")
    if any(k in text for k in ["一句话", "三秒", "当场"]):
        highlights.append("强钩子点")

    lines = [x for x in __import__('re').split(r"[，。！？\n]", text) if x][:6]
    adapted = "\n".join([
        f"【15秒节奏拆分 | {req.screen_mode}】",
        "0-3秒：主角处于劣势，制造悬念与冲突。",
        "3-8秒：核心爽点爆发，完成一次反制。",
        "8-12秒：加入情绪放大与关系升级。",
        "12-15秒：抛出新悬念，形成下一集钩子。",
        "",
        f"【爽点标记】{'、'.join(highlights) if highlights else '待补充'}",
        "【压缩对白草案】",
        *[f"{i+1}. {line[:18]}" for i, line in enumerate(lines)]
    ])
    return {"adapted_script": adapted, "highlights": highlights}


@app.post("/generate/storyboard")
def generate_storyboard(req: StoryboardReq, user_id: int = Depends(get_current_user_id)):
    if not req.adapted_script.strip():
        raise HTTPException(status_code=400, detail="改编脚本不能为空")
    storyboard = [
        ["S1", "3s", "近景", "推进", "人物居中+压迫构图", "冷色逆光", "雨夜天台，主角被围堵，电影质感", "主角抬眼，镜头推进，压迫氛围", "低频轰鸣+心跳"],
        ["S2", "4s", "中景", "手持轻晃", "对角线冲突", "高反差侧光", "反派挑衅，群像围观，紧张", "对峙爆发，快速切换表情", "人群嘈杂+挑衅笑声"],
        ["S3", "5s", "特写", "瞬时拉近", "眼神+道具特写", "高亮轮廓光", "主角一句话反转，全场震惊", "特写嘴角，反转台词，节奏拉满", "冲击音效+静音断点"],
        ["S4", "3s", "远景", "上摇", "留白构图", "闪电+背光", "师父现身，揭露阴谋钩子", "天台远景，神秘角色登场", "雷声+悬疑尾音"],
    ]
    return {"storyboard": storyboard}


@app.post("/generate/assets")
def generate_assets(req: AssetReq, user_id: int = Depends(get_current_user_id)):
    if not req.storyboard:
        raise HTTPException(status_code=400, detail="分镜不能为空")
    return {
        "characters": ["林夜｜22岁｜冷峻｜黑色机能风｜关键词：反差、压迫感", "师父｜40+｜神秘｜深色长衣｜关键词：权威、反转"],
        "scenes": ["雨夜天台｜夜晚｜暴雨｜高楼边缘｜赛博写实风", "废弃仓库回忆场｜阴天｜尘雾｜纵深通道｜暗黑现实风"],
        "props": ["裂纹手机（关键证据）", "黑伞（身份符号）", "金属徽章（组织线索）"],
    }

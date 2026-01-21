import json
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from jose import jwt

BASE_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = BASE_DIR / "public"
DATA_DIR = BASE_DIR / "data"

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()
ALLOWED_EMAIL_DOMAINS = [
    d.strip().lower()
    for d in os.getenv("ALLOWED_EMAIL_DOMAINS", "").split(",")
    if d.strip()
]
JWKS_CACHE = {"expires_at": 0, "keys": []}
SCRAPE_INTERVAL_SECONDS = 180
SCRAPE_STATE = {"running": False, "last_run": 0.0, "last_error": ""}
SCRAPE_LOCK = threading.Lock()


def get_jwks():
    if not SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL is not set.")
    if not SUPABASE_ANON_KEY:
        raise RuntimeError("SUPABASE_ANON_KEY is not set.")
    now = time.time()
    if JWKS_CACHE["expires_at"] > now and JWKS_CACHE["keys"]:
        return JWKS_CACHE["keys"]
    headers = {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    }
    base = SUPABASE_URL.rstrip("/")
    resp = requests.get(f"{base}/auth/v1/keys", headers=headers, timeout=15)
    if resp.status_code == 404:
        resp = requests.get(f"{base}/auth/v1/.well-known/jwks.json", headers=headers, timeout=15)
    resp.raise_for_status()
    keys = resp.json().get("keys", [])
    JWKS_CACHE["keys"] = keys
    JWKS_CACHE["expires_at"] = now + 600
    return keys


def get_email_domain(email: str) -> str:
    if not email or "@" not in email:
        return ""
    return email.split("@", 1)[1].lower()


def verify_token(
    authorization: str = Header(default=""),
    x_auth_token: str = Header(default="", alias="X-Auth-Token"),
    x_auth_debug: str = Header(default="", alias="X-Auth-Debug"),
):
    if not authorization and x_auth_token:
        authorization = f"Bearer {x_auth_token}"
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    token = authorization.split(" ", 1)[1].strip()
    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token header.")
    kid = unverified_header.get("kid")
    alg = unverified_header.get("alg") or "RS256"
    key = next((k for k in get_jwks() if k.get("kid") == kid), None)
    if not key:
        raise HTTPException(status_code=401, detail="Unknown token key.")
    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=[alg],
            options={"verify_aud": False, "verify_iss": False},
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Token verification failed.")
    if x_auth_debug == "1":
        return payload
    iss = (payload.get("iss") or "").rstrip("/")
    if not iss.startswith(SUPABASE_URL.rstrip("/")):
        raise HTTPException(status_code=401, detail="Invalid token issuer.")
    email = payload.get("email") or ""
    if ALLOWED_EMAIL_DOMAINS:
        if get_email_domain(email) not in ALLOWED_EMAIL_DOMAINS:
            raise HTTPException(status_code=403, detail="Email domain not allowed.")
    return payload


app = FastAPI()
app.mount("/static", StaticFiles(directory=PUBLIC_DIR), name="static")

def run_scrape_once():
    with SCRAPE_LOCK:
        if SCRAPE_STATE["running"]:
            return False
        SCRAPE_STATE["running"] = True
    try:
        from scrape import main as scrape_main

        scrape_main()
        SCRAPE_STATE["last_error"] = ""
        return True
    except Exception as exc:
        SCRAPE_STATE["last_error"] = str(exc)
        return False
    finally:
        SCRAPE_STATE["last_run"] = time.time()
        with SCRAPE_LOCK:
            SCRAPE_STATE["running"] = False


def start_scrape_thread():
    thread = threading.Thread(target=run_scrape_once, daemon=True)
    thread.start()
    return thread


def ensure_scrape_fresh(blocking: bool = False):
    data_file = DATA_DIR / "data.json"
    if not data_file.exists():
        if blocking:
            run_scrape_once()
        else:
            start_scrape_thread()
        return
    age = time.time() - data_file.stat().st_mtime
    if age >= SCRAPE_INTERVAL_SECONDS:
        if blocking:
            run_scrape_once()
        else:
            start_scrape_thread()


def scrape_loop():
    while True:
        run_scrape_once()
        time.sleep(SCRAPE_INTERVAL_SECONDS)


@app.on_event("startup")
def start_background_scrape():
    threading.Thread(target=scrape_loop, daemon=True).start()


def format_ts(epoch_seconds: float) -> str:
    if not epoch_seconds:
        return ""
    return datetime.fromtimestamp(epoch_seconds, tz=timezone.utc).isoformat()


@app.get("/")
def index():
    return FileResponse(PUBLIC_DIR / "index.html")


@app.get("/changelog")
def changelog():
    return FileResponse(PUBLIC_DIR / "changelog.html")


@app.get("/authors")
def authors():
    return FileResponse(PUBLIC_DIR / "authors.html")


@app.get("/config.js")
def config_js():
    content = (
        "window.SUPABASE_URL="
        + json.dumps(SUPABASE_URL)
        + ";\nwindow.SUPABASE_ANON_KEY="
        + json.dumps(SUPABASE_ANON_KEY)
        + ";\n"
    )
    return Response(content=content, media_type="application/javascript")


@app.get("/api/data")
def api_data(payload=Depends(verify_token)):
    ensure_scrape_fresh(blocking=False)
    data_file = DATA_DIR / "data.json"
    if not data_file.exists():
        ensure_scrape_fresh(blocking=True)
    if not data_file.exists():
        raise HTTPException(status_code=503, detail="data.json not available yet.")
    return json.loads(data_file.read_text(encoding="utf-8"))


@app.get("/api/changelog")
def api_changelog(payload=Depends(verify_token)):
    ensure_scrape_fresh(blocking=False)
    data_file = DATA_DIR / "changelog.json"
    if not data_file.exists():
        ensure_scrape_fresh(blocking=True)
    if not data_file.exists():
        raise HTTPException(status_code=503, detail="changelog.json not available yet.")
    return json.loads(data_file.read_text(encoding="utf-8"))


@app.get("/api/changelog.csv")
def api_changelog_csv(payload=Depends(verify_token)):
    ensure_scrape_fresh(blocking=False)
    data_file = DATA_DIR / "changelog.csv"
    if not data_file.exists():
        ensure_scrape_fresh(blocking=True)
    if not data_file.exists():
        raise HTTPException(status_code=503, detail="changelog.csv not available yet.")
    return FileResponse(data_file)


@app.get("/api/scrape-status")
def api_scrape_status(payload=Depends(verify_token)):
    data_file = DATA_DIR / "data.json"
    changelog_file = DATA_DIR / "changelog.json"
    status = {
        "running": SCRAPE_STATE["running"],
        "last_run": SCRAPE_STATE["last_run"],
        "last_run_iso": format_ts(SCRAPE_STATE["last_run"]),
        "last_error": SCRAPE_STATE["last_error"],
        "data_exists": data_file.exists(),
        "changelog_exists": changelog_file.exists(),
        "data_mtime": data_file.stat().st_mtime if data_file.exists() else 0.0,
        "data_mtime_iso": format_ts(
            data_file.stat().st_mtime if data_file.exists() else 0.0
        ),
        "data_generated_at": "",
    }
    if data_file.exists():
        try:
            payload = json.loads(data_file.read_text(encoding="utf-8"))
            status["data_generated_at"] = payload.get("generated_at", "")
        except Exception as exc:
            status["data_generated_at"] = f"error: {exc}"
    return status

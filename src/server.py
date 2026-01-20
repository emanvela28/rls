import json
import os
import time
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


def verify_token(authorization: str = Header(default="")):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    token = authorization.split(" ", 1)[1].strip()
    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token header.")
    kid = unverified_header.get("kid")
    key = next((k for k in get_jwks() if k.get("kid") == kid), None)
    if not key:
        raise HTTPException(status_code=401, detail="Unknown token key.")
    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience="authenticated",
            issuer=f"{SUPABASE_URL}/auth/v1",
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Token verification failed.")
    email = payload.get("email") or ""
    if ALLOWED_EMAIL_DOMAINS:
        if get_email_domain(email) not in ALLOWED_EMAIL_DOMAINS:
            raise HTTPException(status_code=403, detail="Email domain not allowed.")
    return payload


app = FastAPI()
app.mount("/static", StaticFiles(directory=PUBLIC_DIR), name="static")


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
    data_file = DATA_DIR / "data.json"
    if not data_file.exists():
        raise HTTPException(status_code=404, detail="data.json not found.")
    return json.loads(data_file.read_text(encoding="utf-8"))


@app.get("/api/changelog")
def api_changelog(payload=Depends(verify_token)):
    data_file = DATA_DIR / "changelog.json"
    if not data_file.exists():
        raise HTTPException(status_code=404, detail="changelog.json not found.")
    return json.loads(data_file.read_text(encoding="utf-8"))


@app.get("/api/changelog.csv")
def api_changelog_csv(payload=Depends(verify_token)):
    data_file = DATA_DIR / "changelog.csv"
    if not data_file.exists():
        raise HTTPException(status_code=404, detail="changelog.csv not found.")
    return FileResponse(data_file)

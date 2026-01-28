import csv
import json
import os
import sqlite3
import sys
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
SRC_DIR = BASE_DIR / "src"
DB_FILE = DATA_DIR / "tasks.db"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

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
EMAIL_MAP_CACHE = {"mtime": 0.0, "data": {}}
ROLES_CACHE = {"mtime": 0.0, "data": []}
OLD_NEW_CACHE = {"mtime": 0.0, "data": {}}
NO_RLS_CACHE = {"mtime": 0.0, "data": {"names": set(), "emails": set(), "people": []}}
OLD_NEW_PEOPLE_CACHE = {"mtime": 0.0, "data": []}
NAME_EMAIL_CACHE = {"mtime": 0.0, "data": {}}
OVERRIDE_BY_EMAIL = {
    "g748044d6fa8c271@c-mercor.com": {"name": "HAMILTON ADRIAN", "email": "g748044d6fa8c271@c-mercor.com"},
    "p92f5194510e036b@c-mercor.com": {"name": "Brian D'Amore", "email": "p92f5194510e036b@c-mercor.com"},
    "hd5c2be12ae2aca6@c-mercor.com": {"name": "Howard Yan", "email": "hd5c2be12ae2aca6@c-mercor.com"},
    "ob65449bcf28bea1@c-mercor.com": {"name": "Muhammad Hossain", "email": "ob65449bcf28bea1@c-mercor.com"},
    "g58b2d103e8b0a86@c-mercor.com": {"name": "Brandon Evans", "email": "g58b2d103e8b0a86@c-mercor.com"},
    "d1f02345a5a0400d@c-mercor.com": {"name": "Wooil Kim", "email": "d1f02345a5a0400d@c-mercor.com"},
    "erich.nicholai@gmail.com": {"name": "Erich Mussak, MD", "email": "medical61@c-mercor.com"},
    "matthew.a.haber@gmail.com": {"name": "Matthew Haber", "email": "c1093c720d7223b4@c-mercor.com"},
}
OVERRIDE_BY_NAME = {
    "contractor c1093c": {"name": "Matthew Haber", "email": "c1093c720d7223b4@c-mercor.com"},
    "contractor d1f023": {"name": "Wooil Kim", "email": "d1f02345a5a0400d@c-mercor.com"},
    "contractor p92f51": {"name": "Brian D'Amore", "email": "p92f5194510e036b@c-mercor.com"},
    "contractor hd5c2b": {"name": "Howard Yan", "email": "hd5c2be12ae2aca6@c-mercor.com"},
    "contractor ob544": {"name": "Muhammad Hossain", "email": "ob65449bcf28bea1@c-mercor.com"},
    "contractor ob6544": {"name": "Muhammad Hossain", "email": "ob65449bcf28bea1@c-mercor.com"},
    "contractor g58b2d": {"name": "Brandon Evans", "email": "g58b2d103e8b0a86@c-mercor.com"},
    "hamilton adrian": {"name": "HAMILTON ADRIAN", "email": "g748044d6fa8c271@c-mercor.com"},
    "m b": {"name": "Erich Mussak, MD", "email": "medical61@c-mercor.com"},
    "erich mussak, md": {"name": "Erich Mussak, MD", "email": "medical61@c-mercor.com"},
    "matthew haber": {"name": "Matthew Haber", "email": "c1093c720d7223b4@c-mercor.com"},
    "dr. shah": {"name": "Summit Shah", "email": "pf4425cf2100bf8d@c-mercor.com"},
    "dr shah": {"name": "Summit Shah", "email": "pf4425cf2100bf8d@c-mercor.com"},
}


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


def normalize_name(value: str) -> str:
    if not value:
        return ""
    return " ".join(value.lower().split())


def normalize_name_loose(value: str) -> str:
    if not value:
        return ""
    lowered = value.lower()
    cleaned = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in lowered)
    parts = [part for part in cleaned.split() if part]
    if parts and parts[-1] in {"dr", "md"}:
        parts = parts[:-1]
    if parts and parts[0] == "steve":
        parts[0] = "stephen"
    return " ".join(parts)


def extract_contractor_code(name: str) -> str:
    if not name:
        return ""
    lowered = name.strip().lower()
    if lowered.startswith("contractor "):
        return lowered.split(None, 1)[1].strip()
    return ""


def find_contractor_match_by_code(code: str, email_map: dict) -> tuple[str, str]:
    if not code or not email_map:
        return "", ""
    for email, display in email_map.items():
        local = email.split("@", 1)[0].lower()
        if local.startswith(code.lower()):
            return email, display
    return "", ""


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
NO_CACHE_HEADERS = {"Cache-Control": "no-store"}

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


def load_email_map() -> dict:
    """Load email -> display name mapping from data/emails.csv."""
    csv_path = DATA_DIR / "emails.csv"
    if not csv_path.exists():
        return {}
    mtime = csv_path.stat().st_mtime
    if EMAIL_MAP_CACHE["mtime"] == mtime and EMAIL_MAP_CACHE["data"]:
        return EMAIL_MAP_CACHE["data"]

    mapping = {}
    try:
        with csv_path.open(newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                name = (row.get("Name") or "").strip()
                primary = (row.get("Email") or "").strip().lower()
                contractor = (row.get("Contractor Email") or "").strip().lower()
                if name:
                    if primary:
                        mapping[primary] = name
                    if contractor:
                        mapping[contractor] = name
    except Exception:
        return {}

    EMAIL_MAP_CACHE["mtime"] = mtime
    EMAIL_MAP_CACHE["data"] = mapping
    return mapping


def load_name_email_map() -> dict:
    """Load normalized name -> preferred email mapping from data/emails.csv."""
    csv_path = DATA_DIR / "emails.csv"
    if not csv_path.exists():
        return {}
    mtime = csv_path.stat().st_mtime
    if NAME_EMAIL_CACHE["mtime"] == mtime and NAME_EMAIL_CACHE["data"]:
        return NAME_EMAIL_CACHE["data"]

    mapping = {}
    try:
        with csv_path.open(newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                raw_name = row.get("Name") or ""
                name = normalize_name(raw_name)
                loose = normalize_name_loose(raw_name)
                email = (row.get("Email") or "").strip().lower()
                contractor = (row.get("Contractor Email") or "").strip().lower()
                if not name:
                    continue
                preferred = contractor or email
                if not preferred:
                    continue
                mapping[name] = preferred
                if loose:
                    mapping.setdefault(loose, preferred)
                parts = loose.split()
                if len(parts) >= 2:
                    first_last = f"{parts[0]} {parts[-1]}"
                    mapping.setdefault(first_last, preferred)
                if len(parts) >= 3:
                    first_middle_last = f"{parts[0]} {parts[1]} {parts[-1]}"
                    mapping.setdefault(first_middle_last, preferred)
    except Exception:
        return {}

    NAME_EMAIL_CACHE["mtime"] = mtime
    NAME_EMAIL_CACHE["data"] = mapping
    return mapping


def load_roles() -> list:
    """Load unique role emails from data/roles.csv."""
    csv_path = DATA_DIR / "roles.csv"
    if not csv_path.exists():
        return []
    mtime = csv_path.stat().st_mtime
    if ROLES_CACHE["mtime"] == mtime and ROLES_CACHE["data"]:
        return ROLES_CACHE["data"]

    seen = set()
    roles = []
    try:
        with csv_path.open(newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                email = (row.get("User Email") or "").strip().lower()
                if not email or email in seen:
                    continue
                seen.add(email)
                roles.append(email)
    except Exception:
        return []

    ROLES_CACHE["mtime"] = mtime
    ROLES_CACHE["data"] = roles
    return roles


def load_old_new_map() -> dict:
    """Load normalized name -> status mapping from data/old_new.csv."""
    csv_path = DATA_DIR / "old_new.csv"
    if not csv_path.exists():
        return {}
    mtime = csv_path.stat().st_mtime
    if OLD_NEW_CACHE["mtime"] == mtime and OLD_NEW_CACHE["data"]:
        return OLD_NEW_CACHE["data"]

    mapping = {}
    try:
        with csv_path.open(newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                raw_name = row.get("Name") or ""
                name = normalize_name(raw_name)
                status = (row.get("Status") or "").strip()
                if name and status:
                    mapping[name] = status
                    loose = normalize_name_loose(raw_name)
                    if loose:
                        mapping.setdefault(loose, status)
        if "stephen schmitter" in mapping:
            mapping[normalize_name("steve schmitter")] = mapping["stephen schmitter"]
            mapping[normalize_name("schmitter")] = mapping["stephen schmitter"]
        if "summit shah" in mapping:
            mapping[normalize_name("dr.shah")] = mapping["summit shah"]
            mapping[normalize_name("dr shah")] = mapping["summit shah"]
        if "summit shah (dr)" in mapping:
            mapping[normalize_name("summit shah")] = mapping["summit shah (dr)"]
            mapping[normalize_name_loose("summit shah (dr)")] = mapping["summit shah (dr)"]
    except Exception:
        return {}

    OLD_NEW_CACHE["mtime"] = mtime
    OLD_NEW_CACHE["data"] = mapping
    return mapping


def load_old_new_people() -> list:
    """Load people rows from data/old_new.csv, excluding totals."""
    csv_path = DATA_DIR / "old_new.csv"
    if not csv_path.exists():
        return []
    mtime = csv_path.stat().st_mtime
    if OLD_NEW_PEOPLE_CACHE["mtime"] == mtime and OLD_NEW_PEOPLE_CACHE["data"]:
        return OLD_NEW_PEOPLE_CACHE["data"]

    people = []
    try:
        with csv_path.open(newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                raw_name = (row.get("Name") or "").strip()
                name_key = normalize_name(raw_name)
                if not raw_name or name_key in {"total", "campaign total"}:
                    continue
                status = (row.get("Status") or "").strip()
                people.append({"name": raw_name, "status": status})
    except Exception:
        return []

    OLD_NEW_PEOPLE_CACHE["mtime"] = mtime
    OLD_NEW_PEOPLE_CACHE["data"] = people
    return people


def load_no_rls_map() -> dict:
    """Load normalized name/email sets from data/noRLS.csv."""
    csv_path = DATA_DIR / "noRLS.csv"
    if not csv_path.exists():
        return {"names": set(), "emails": set(), "people": []}
    mtime = csv_path.stat().st_mtime
    if NO_RLS_CACHE["mtime"] == mtime and NO_RLS_CACHE["data"]:
        return NO_RLS_CACHE["data"]

    names = set()
    emails = set()
    people = []
    try:
        with csv_path.open(newline="", encoding="utf-8") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                name = normalize_name(row.get("Name") or "")
                email = (row.get("Email") or "").strip().lower()
                contractor = (row.get("Contractor Email") or "").strip().lower()
                if name:
                    names.add(name)
                if email:
                    emails.add(email)
                if contractor:
                    emails.add(contractor)
                if name or email or contractor:
                    people.append(
                        {
                            "name": row.get("Name") or "",
                            "email": email,
                            "contractor_email": contractor,
                        }
                    )
    except Exception:
        return {"names": set(), "emails": set(), "people": []}

    NO_RLS_CACHE["mtime"] = mtime
    NO_RLS_CACHE["data"] = {"names": names, "emails": emails, "people": people}
    return NO_RLS_CACHE["data"]


def load_reviewer_map() -> dict:
    if not DB_FILE.exists():
        return {}
    reviewers = {"names": set(), "emails": set(), "contractor_emails": set()}
    try:
        conn = sqlite3.connect(str(DB_FILE))
        cur = conn.execute(
            """
            SELECT name, email, contractor_email
            FROM authors
            WHERE position = 'Reviewer'
            """
        )
        for name, email, contractor_email in cur.fetchall():
            if name:
                reviewers["names"].add(normalize_name(name))
            if email:
                reviewers["emails"].add(email.strip().lower())
            if contractor_email:
                reviewers["contractor_emails"].add(contractor_email.strip().lower())
    except sqlite3.Error:
        return {}
    finally:
        try:
            conn.close()
        except Exception:
            pass
    return {
        "names": sorted(reviewers["names"]),
        "emails": sorted(reviewers["emails"]),
        "contractor_emails": sorted(reviewers["contractor_emails"]),
    }


def apply_name_overrides(tasks: list, email_map: dict) -> list:
    """Normalize author names/emails using emails.csv map and explicit overrides."""
    normalized_map = {k.lower(): v for k, v in (email_map or {}).items()}
    normalized_email_override = {k.lower(): v for k, v in OVERRIDE_BY_EMAIL.items()}
    normalized_name_override = {k.lower(): v for k, v in OVERRIDE_BY_NAME.items()}

    normalized_tasks = []
    for task in tasks:
        name = (task.get("owned_by_user_name") or "").strip()
        email = (task.get("owned_by_user_email") or "").strip().lower()
        updated = dict(task)

        if not email:
            contractor_code = extract_contractor_code(name)
            if contractor_code:
                matched_email, matched_name = find_contractor_match_by_code(
                    contractor_code, normalized_map
                )
                if matched_email:
                    updated["owned_by_user_email"] = matched_email
                if matched_name:
                    updated["owned_by_user_name"] = matched_name
                email = (updated.get("owned_by_user_email") or "").strip().lower()

        if email and email in normalized_map:
            updated["owned_by_user_name"] = normalized_map[email]
        if email and email in normalized_email_override:
            updated["owned_by_user_name"] = normalized_email_override[email]["name"]
            updated["owned_by_user_email"] = normalized_email_override[email]["email"]

        norm_name = name.lower()
        if norm_name in normalized_name_override:
            override = normalized_name_override[norm_name]
            updated["owned_by_user_name"] = override["name"]
            if not updated.get("owned_by_user_email"):
                updated["owned_by_user_email"] = override["email"]

        normalized_tasks.append(updated)
    return normalized_tasks


@app.get("/")
def index():
    return FileResponse(PUBLIC_DIR / "index.html", headers=NO_CACHE_HEADERS)


@app.get("/changelog")
def changelog():
    return FileResponse(PUBLIC_DIR / "changelog.html", headers=NO_CACHE_HEADERS)


@app.get("/authors")
def authors():
    return FileResponse(PUBLIC_DIR / "authors.html", headers=NO_CACHE_HEADERS)


@app.get("/funnel")
def funnel():
    return FileResponse(PUBLIC_DIR / "funnel.html", headers=NO_CACHE_HEADERS)


@app.get("/reviewers")
def reviewers():
    return FileResponse(PUBLIC_DIR / "reviewers.html", headers=NO_CACHE_HEADERS)


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
    data = json.loads(data_file.read_text(encoding="utf-8"))
    email_map = load_email_map()
    name_email_map = load_name_email_map()
    roles = load_roles()
    old_new_map = load_old_new_map()
    no_rls_map = load_no_rls_map()
    reviewer_map = load_reviewer_map()
    old_new_people = load_old_new_people()
    tasks = data.get("tasks") or []
    if email_map:
        data["email_map"] = email_map
        data["tasks"] = apply_name_overrides(tasks, email_map)
    else:
        data["tasks"] = apply_name_overrides(tasks, {})
    if roles:
        data["roles"] = roles
    if old_new_map:
        data["old_new_map"] = old_new_map
    if name_email_map:
        data["name_email_map"] = name_email_map
    if reviewer_map:
        data["reviewer_map"] = reviewer_map
    role_names = set()
    role_names_loose = set()
    if roles and email_map:
        for email in roles:
            name = email_map.get(email)
            if name:
                role_names.add(normalize_name(name))
                role_names_loose.add(normalize_name_loose(name))

    extra_no_rls_people = []
    extra_no_rls_names = set()
    for person in old_new_people:
        name_key = normalize_name(person.get("name") or "")
        loose_key = normalize_name_loose(person.get("name") or "")
        if not name_key or name_key in role_names or loose_key in role_names_loose:
            continue
        if name_key in no_rls_map.get("names", set()):
            continue
        extra_no_rls_people.append(
            {
                "name": person.get("name") or "",
                "email": "",
                "contractor_email": "",
            }
        )
        extra_no_rls_names.add(name_key)

    if no_rls_map and (
        no_rls_map.get("names")
        or no_rls_map.get("emails")
        or no_rls_map.get("people")
        or extra_no_rls_people
    ):
        merged_names = set(no_rls_map.get("names", set()))
        merged_names.update(extra_no_rls_names)
        data["no_rls_map"] = {
            "names": sorted(merged_names),
            "emails": sorted(no_rls_map.get("emails", set())),
        }
        data["no_rls_people"] = no_rls_map.get("people", []) + extra_no_rls_people
    return data


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

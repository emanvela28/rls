import warnings
warnings.filterwarnings("ignore", message="urllib3 v2 only supports OpenSSL")

import os
import csv
import json
import base64
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

URL = "https://api.studio.mercor.com/tasks/world/world_2cb0dbfca8494125bc1b71f0f3472a76/detailed"
BASE_DIR = Path(__file__).resolve().parent.parent
# Ensure relative paths below always resolve from repo root, regardless of cwd
os.chdir(BASE_DIR)
OUT_FILE = Path("data/data.txt")
OUT_JSON = Path("data/data.json")
OUT_CSV = Path("data/data.csv")
OUT_CHANGELOG_JSON = Path("data/changelog.json")
OUT_CHANGELOG_CSV = Path("data/changelog.csv")
OUT_SHEET_STATUS = Path("data/sheet_status.json")
OUT_TASK_SAMPLE = Path("data/task_sample.json")
DB_FILE = Path("data/tasks.db")
EMAILS_CSV = Path("data/emails.csv")
REVIEWER_CSV = Path("data/reviewer.csv")
USERS_URL_TEMPLATE = "https://api.studio.mercor.com/users/campaign/{campaign_id}"
AUTHOR_CUSTOM_FIELD_ID = "field_f149502069bd4fde84cc33a35373fd83"
CLAIMING_REVIEWER_FIELD_ID = "field_897068be526f4987bf05289c29e05cab"
SHEET_SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
OVERRIDE_BY_EMAIL = {
    "g748044d6fa8c271@c-mercor.com": {"name": "HAMILTON ADRIAN", "email": "g748044d6fa8c271@c-mercor.com"},
    "p92f5194510e036b@c-mercor.com": {"name": "Brian D'Amore", "email": "p92f5194510e036b@c-mercor.com"},
    "hd5c2be12ae2aca6@c-mercor.com": {"name": "Howard Yan", "email": "hd5c2be12ae2aca6@c-mercor.com"},
    "ob65449bcf28bea1@c-mercor.com": {"name": "Muhammad Hossain", "email": "ob65449bcf28bea1@c-mercor.com"},
    "g58b2d103e8b0a86@c-mercor.com": {"name": "Brandon Evans", "email": "g58b2d103e8b0a86@c-mercor.com"},
    "d1f02345a5a0400d@c-mercor.com": {"name": "Wooil Kim", "email": "d1f02345a5a0400d@c-mercor.com"},
    "erich.nicholai@gmail.com": {"name": "Erich Mussak, MD", "email": "erich.nicholai@gmail.com"},
    "matthew.a.haber@gmail.com": {"name": "Matthew Haber", "email": "matthew.a.haber@gmail.com"},
}
OVERRIDE_BY_NAME = {
    "contractor c1093c": {"name": "Matthew Haber", "email": "matthew.a.haber@gmail.com"},
    "contractor d1f023": {"name": "Wooil Kim", "email": "d1f02345a5a0400d@c-mercor.com"},
    "contractor p92f51": {"name": "Brian D'Amore", "email": "p92f5194510e036b@c-mercor.com"},
    "contractor hd5c2b": {"name": "Howard Yan", "email": "hd5c2be12ae2aca6@c-mercor.com"},
    "contractor ob544": {"name": "Muhammad Hossain", "email": "ob65449bcf28bea1@c-mercor.com"},
    "contractor ob6544": {"name": "Muhammad Hossain", "email": "ob65449bcf28bea1@c-mercor.com"},
    "contractor g58b2d": {"name": "Brandon Evans", "email": "g58b2d103e8b0a86@c-mercor.com"},
    "hamilton adrian": {"name": "HAMILTON ADRIAN", "email": "g748044d6fa8c271@c-mercor.com"},
    "m b": {"name": "Erich Mussak, MD", "email": "erich.nicholai@gmail.com"},
    "erich mussak, md": {"name": "Erich Mussak, MD", "email": "erich.nicholai@gmail.com"},
    "matthew haber": {"name": "Matthew Haber", "email": "matthew.a.haber@gmail.com"},
}


def load_api_key() -> str:
    # Reload .env each time the script runs (so API key updates are picked up)
    load_dotenv(override=True)
    return os.getenv("MERCOR_API_KEY", "").strip()


def load_campaign_id() -> str:
    # Required header for Mercor API; copy from request headers in DevTools
    load_dotenv(override=True)
    return os.getenv("MERCOR_CAMPAIGN_ID", "").strip()


def load_company_id() -> str:
    # Some endpoints also require X-Company-Id; copy from DevTools if needed
    load_dotenv(override=True)
    return os.getenv("MERCOR_COMPANY_ID", "").strip()


def init_db():
    conn = sqlite3.connect(str(DB_FILE))
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS task_state (
            task_id TEXT PRIMARY KEY,
            last_status TEXT,
            original_author TEXT,
            original_author_set_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS approvals_log (
            task_id TEXT PRIMARY KEY,
            task_name TEXT,
            original_author TEXT,
            original_author_email TEXT,
            approved_at TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS authors (
            name TEXT,
            email TEXT,
            contractor_email TEXT PRIMARY KEY,
            position TEXT
        )
        """
    )
    try:
        cur = conn.execute("PRAGMA table_info(authors)")
        cols = [row[1] for row in cur.fetchall()]
        if cols and "position" not in cols:
            try:
                conn.execute("ALTER TABLE authors ADD COLUMN position TEXT")
            except sqlite3.OperationalError:
                pass
    except sqlite3.Error:
        pass
    try:
        conn.execute("ALTER TABLE approvals_log ADD COLUMN original_author_email TEXT")
    except sqlite3.OperationalError:
        pass
    conn.commit()
    return conn


def load_task_state(conn):
    cur = conn.execute(
        "SELECT task_id, last_status, original_author FROM task_state"
    )
    state = {}
    for task_id, last_status, original_author in cur.fetchall():
        state[task_id] = {
            "last_status": last_status,
            "original_author": original_author,
        }
    return state


def persist_task_state(conn, task_id, last_status, original_author, set_at):
    conn.execute(
        """
        INSERT INTO task_state (task_id, last_status, original_author, original_author_set_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(task_id) DO UPDATE SET
          last_status=excluded.last_status,
          original_author=COALESCE(task_state.original_author, excluded.original_author),
          original_author_set_at=COALESCE(task_state.original_author_set_at, excluded.original_author_set_at)
        """,
        (task_id, last_status, original_author, set_at),
    )


def append_approval_log(
    conn,
    task_id,
    task_name,
    original_author,
    original_author_email,
    approved_at,
):
    conn.execute(
        """
        INSERT INTO approvals_log (task_id, task_name, original_author, original_author_email, approved_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(task_id) DO UPDATE SET
          task_name=excluded.task_name,
          original_author=CASE
            WHEN excluded.original_author != '' THEN excluded.original_author
            ELSE approvals_log.original_author
          END,
          original_author_email=CASE
            WHEN excluded.original_author_email != '' THEN excluded.original_author_email
            ELSE approvals_log.original_author_email
          END,
          approved_at=CASE
            WHEN excluded.approved_at != '' THEN excluded.approved_at
            ELSE approvals_log.approved_at
          END
        """,
        (task_id, task_name, original_author, original_author_email, approved_at),
    )


def load_approved_task_ids(conn):
    cur = conn.execute("SELECT task_id FROM approvals_log")
    return {row[0] for row in cur.fetchall()}


def normalize_name(name: str) -> str:
    if not name:
        return ""
    return " ".join(name.lower().split())


def normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def load_reviewer_lookup(csv_path: Path):
    lookup = {"emails": set(), "contractor_emails": set(), "names": set()}
    if not csv_path.exists():
        return lookup
    with csv_path.open(newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            name = normalize_name(row.get("Name") or "")
            email = normalize_email(row.get("Email") or "")
            contractor = normalize_email(row.get("Contractor Email") or "")
            if name:
                lookup["names"].add(name)
            if email:
                lookup["emails"].add(email)
            if contractor:
                lookup["contractor_emails"].add(contractor)
    return lookup


def upsert_authors_from_emails(conn, csv_path: Path) -> None:
    if not csv_path.exists():
        return
    reviewer_lookup = load_reviewer_lookup(REVIEWER_CSV)
    conn.execute("DELETE FROM authors")
    with csv_path.open(newline="", encoding="utf-8") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            contractor_email = normalize_email(row.get("Contractor Email") or "")
            if not contractor_email:
                continue
            name = (row.get("Name") or "").strip()
            email = normalize_email(row.get("Email") or "")
            is_reviewer = (
                contractor_email in reviewer_lookup["contractor_emails"]
                or email in reviewer_lookup["emails"]
                or normalize_name(name) in reviewer_lookup["names"]
            )
            position = "Reviewer" if is_reviewer else "Writer"
            conn.execute(
                """
                INSERT INTO authors (
                    name,
                    email,
                    contractor_email,
                    position
                )
                VALUES (?, ?, ?, ?)
                """,
                (name, email, contractor_email, position),
            )

def extract_contractor_code(name: str) -> str:
    if not name:
        return ""
    lowered = name.strip().lower()
    if lowered.startswith("contractor "):
        return lowered.split(None, 1)[1].strip()
    return ""


def find_contractor_match_by_code(code: str, contractor_email_map: dict):
    if not code:
        return None
    for contractor_email, info in contractor_email_map.items():
        local = contractor_email.split("@", 1)[0]
        if local.startswith(code):
            return info
    return None


def resolve_owner_name(task: dict) -> str:
    owned_by = (task.get("owned_by_user_name") or "").strip()
    if owned_by:
        return owned_by
    custom_fields = task.get("custom_fields") or {}
    if isinstance(custom_fields, dict):
        custom_owner = custom_fields.get(AUTHOR_CUSTOM_FIELD_ID)
        if isinstance(custom_owner, str) and custom_owner.strip():
            return custom_owner.strip()
    return ""


def extract_claiming_reviewer(task: dict) -> str:
    custom_fields = task.get("custom_fields") or {}
    if not isinstance(custom_fields, dict):
        return ""
    value = custom_fields.get(CLAIMING_REVIEWER_FIELD_ID)
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        cleaned = []
        for item in value:
            if isinstance(item, str) and item.strip():
                cleaned.append(item.strip())
            elif isinstance(item, dict):
                candidate = item.get("name") or item.get("value")
                if isinstance(candidate, str) and candidate.strip():
                    cleaned.append(candidate.strip())
        return ", ".join(cleaned)
    if isinstance(value, dict):
        candidate = value.get("name") or value.get("value")
        if isinstance(candidate, str):
            return candidate.strip()
    return ""


def load_sheet_config():
    load_dotenv(override=True)
    sheet_id = os.getenv("GOOGLE_SHEETS_ID", "").strip()
    sheet_tab = os.getenv("GOOGLE_SHEETS_TAB", "").strip() or "Append"
    creds_raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    backfill = os.getenv("GOOGLE_SHEETS_BACKFILL", "").strip().lower() in {
        "1",
        "true",
        "yes",
    }
    return sheet_id, sheet_tab, creds_raw, backfill


def parse_service_account_info(raw: str):
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        try:
            decoded = base64.b64decode(raw).decode("utf-8")
            return json.loads(decoded)
        except Exception:
            return None


def write_sheet_status(payload: dict):
    try:
        with open(OUT_SHEET_STATUS, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
    except Exception:
        pass


def append_sheet_rows(
    rows, sheet_id, sheet_tab, creds_info, replace: bool = False, dedupe: bool = True
):
    if not rows or not sheet_id or not creds_info:
        write_sheet_status(
            {
                "last_append_at": "",
                "last_append_count": 0,
                "last_error": "Missing sheet config or rows.",
            }
        )
        return False
    try:
        import gspread
        from google.oauth2.service_account import Credentials

        creds = Credentials.from_service_account_info(
            creds_info,
            scopes=SHEET_SCOPES,
        )
        client = gspread.authorize(creds)
        worksheet = client.open_by_key(sheet_id).worksheet(sheet_tab)
        if replace:
            worksheet.clear()
            worksheet.append_rows(rows, value_input_option="RAW")
        else:
            if dedupe:
                existing = worksheet.get_all_values()
                task_id_idx = -1
                if existing:
                    header = existing[0]
                    if "task_id" in header:
                        task_id_idx = header.index("task_id")
                if task_id_idx == -1:
                    task_id_idx = len(existing[0]) - 1 if existing else -1
                existing_ids = set()
                if task_id_idx >= 0:
                    for row in existing[1:]:
                        if len(row) > task_id_idx:
                            existing_ids.add(row[task_id_idx].strip())
                rows = [row for row in rows if row[-1] not in existing_ids]
            if rows:
                worksheet.append_rows(rows, value_input_option="RAW")
        write_sheet_status(
            {
                "last_append_at": datetime.now(timezone.utc).isoformat(),
                "last_append_count": len(rows),
                "last_error": "",
            }
        )
        return True
    except Exception as exc:
        err = f"{type(exc).__name__}: {exc}"
        print(f"Warning: failed to append to Google Sheet: {err}", file=sys.stderr)
        write_sheet_status(
            {
                "last_append_at": "",
                "last_append_count": 0,
                "last_error": err,
            }
        )
        return False


def load_contractor_email_map(path: str) -> dict:
    mapping = {}
    try:
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = (row.get("Name") or "").strip()
                contractor_email = (row.get("Contractor Email") or "").strip().lower()
                personal_email = (row.get("Email") or "").strip()
                if contractor_email and (personal_email or name):
                    mapping[contractor_email] = {
                        "name": name,
                        "email": personal_email,
                        "contractor_email": contractor_email,
                    }
    except FileNotFoundError:
        pass
    return mapping


def load_campaign_users(headers, campaign_id):
    url = USERS_URL_TEMPLATE.format(campaign_id=campaign_id)
    r = requests.get(url, headers=headers, timeout=60)
    if r.status_code == 401:
        raise SystemExit("401 Unauthorized while loading campaign users for email mapping.")
    r.raise_for_status()
    users = r.json()
    email_by_name = {}
    for u in users:
        first = u.get("first_name") or ""
        last = u.get("last_name") or ""
        full = normalize_name(f"{first} {last}".strip())
        email = u.get("email")
        if full and email:
            email_by_name[full] = email
    return email_by_name


def apply_email_overrides(email_by_name: dict) -> dict:
    # Manual fixes for names that do not match the campaign users list
    overrides = {
        "wooil kim": "d1f02345a5a0400d@c-mercor.com",
        "erich mussak": "medical61@c-mercor.com",
    }
    email_by_name.update(overrides)
    return email_by_name


def load_email_name_map(path: Path) -> dict:
    """Map email (personal or contractor) to display name from emails.csv."""
    mapping = {}
    try:
        with path.open(newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = (row.get("Name") or "").strip()
                email = (row.get("Email") or "").strip().lower()
                contractor = (row.get("Contractor Email") or "").strip().lower()
                if name:
                    if email:
                        mapping[email] = name
                    if contractor:
                        mapping[contractor] = name
    except FileNotFoundError:
        pass
    return mapping


def apply_name_overrides(tasks: list, email_name_map: dict, contractor_email_map: dict | None = None) -> list:
    """Normalize author names/emails using emails.csv map, contractor-to-personal, and explicit overrides."""
    norm_email_map = {k.lower(): v for k, v in (email_name_map or {}).items()}
    norm_email_override = {k.lower(): v for k, v in OVERRIDE_BY_EMAIL.items()}
    norm_name_override = {k.lower(): v for k, v in OVERRIDE_BY_NAME.items()}
    contractor_email_map = {k.lower(): v for k, v in (contractor_email_map or {}).items()}

    normalized = []
    for task in tasks:
        updated = dict(task)
        email = (task.get("owned_by_user_email") or "").strip().lower()
        # If this is a contractor email and we have a personal email, prefer the personal email.
        if email and email in contractor_email_map:
            email = contractor_email_map[email].strip().lower()
            updated["owned_by_user_email"] = email
        name = (task.get("owned_by_user_name") or "").strip()

        if email and email in norm_email_map:
            updated["owned_by_user_name"] = norm_email_map[email]
        if email and email in norm_email_override:
            updated["owned_by_user_name"] = norm_email_override[email]["name"]
            updated["owned_by_user_email"] = norm_email_override[email]["email"]

        norm_name = name.lower()
        if norm_name in norm_name_override:
            updated["owned_by_user_name"] = norm_name_override[norm_name]["name"]
            if not updated.get("owned_by_user_email"):
                updated["owned_by_user_email"] = norm_name_override[norm_name]["email"]

        normalized.append(updated)
    return normalized


def tsv_row(values):
    cleaned = []
    for v in values:
        if v is None:
            cleaned.append("")
        else:
            cleaned.append(str(v).replace("\t", " ").replace("\n", " "))
    return "\t".join(cleaned)


def table_rows(rows):
    # Build a fixed-width table with left-aligned columns
    cleaned_rows = []
    col_widths = []
    for row in rows:
        cleaned = []
        for i, v in enumerate(row):
            cell = "" if v is None else str(v).replace("\t", " ").replace("\n", " ")
            cleaned.append(cell)
            if len(col_widths) <= i:
                col_widths.append(len(cell))
            else:
                col_widths[i] = max(col_widths[i], len(cell))
        cleaned_rows.append(cleaned)
    formatted = []
    for row in cleaned_rows:
        padded = [cell.ljust(col_widths[i]) for i, cell in enumerate(row)]
        formatted.append("  ".join(padded))
    return formatted


def main():
    api_key = load_api_key()
    campaign_id = load_campaign_id()
    company_id = load_company_id()
    if not api_key:
        raise SystemExit(
            "Missing MERCOR_API_KEY.\n"
            "Update your .env file with:\n"
            "MERCOR_API_KEY=your_api_key_here"
        )
    if not campaign_id:
        raise SystemExit(
            "Missing MERCOR_CAMPAIGN_ID.\n"
            "Copy X-Campaign-Id from the browser request headers and add it to .env."
        )
    if not company_id:
        raise SystemExit(
            "Missing MERCOR_COMPANY_ID.\n"
            "Copy X-Company-Id from the browser request headers and add it to .env."
        )
    headers = {
        "Accept": "application/json",
        "User-Agent": "mercor-table/0.1",
        "Origin": "https://studio.mercor.com",
        "Referer": "https://studio.mercor.com/",
        "X-Campaign-Id": campaign_id,
    }
    headers["X-Company-Id"] = company_id
    headers["Authorization"] = f"Bearer {api_key}"

    users_email_by_name = load_campaign_users(headers, campaign_id)
    users_email_by_name = apply_email_overrides(users_email_by_name)
    r = requests.get(URL, headers=headers, timeout=60)

    # If 401, print the server message (e.g. "Token has expired") and exit
    if r.status_code == 401:
        try:
            msg = r.json()
        except Exception:
            msg = {"detail": r.text[:200]}
        raise SystemExit(f"401 Unauthorized: {msg}")
    # If 400, show details to diagnose auth or required headers
    if r.status_code == 400:
        try:
            msg = r.json()
        except Exception:
            msg = {"detail": r.text[:500]}
        raise SystemExit(f"400 Bad Request: {msg}")

    r.raise_for_status()
    payload = r.json()

    tasks = payload.get("tasks", [])
    if not isinstance(tasks, list):
        raise SystemExit("Unexpected JSON shape: payload['tasks'] is not a list")
    if tasks:
        sample_count = min(4, len(tasks))
        with open(OUT_TASK_SAMPLE, "w", encoding="utf-8") as f:
            json.dump(tasks[:sample_count], f, indent=2)
    contractor_email_map = load_contractor_email_map(EMAILS_CSV)
    email_name_map = load_email_name_map(EMAILS_CSV)
    conn = init_db()
    upsert_authors_from_emails(conn, EMAILS_CSV)
    tasks = apply_name_overrides(tasks, email_name_map, contractor_email_map)

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    state = load_task_state(conn)
    approved_ids = load_approved_task_ids(conn)
    sheet_id, sheet_tab, creds_raw, backfill = load_sheet_config()
    creds_info = parse_service_account_info(creds_raw)
    # contractor_email_map already loaded above for overrides
    if sheet_id and not creds_info:
        print(
            "Warning: GOOGLE_SERVICE_ACCOUNT_JSON is missing or invalid; skipping sheet append.",
            file=sys.stderr,
        )
    columns = [
        "task_name",
        "status_name",  # from task_status_defn.status_name
        "created_by_user_name",
        "updated_by_user_name",
        "owned_by_user_name",
        "owned_by_user_email",
        "verifier_count",
        "final_score",
        "has_gt_grade",
        "created_at",
        "updated_at",
        "task_id",
    ]

    lines = []
    lines.append("=== Mercor Tasks Snapshot ===")
    lines.append(f"Last Updated: {ts}")
    lines.append(f"URL: {URL}")
    lines.append(f"Rows Returned: {len(tasks)}")
    lines.append("")
    lines.append("=== Table ===")
    rows = [columns]

    json_tasks = []
    approval_rows = []
    new_sheet_rows = []
    for t in tasks:
        status_name = ""
        status_defn = t.get("task_status_defn") or {}
        if isinstance(status_defn, dict):
            status_name = status_defn.get("status_name", "")

        task_id = t.get("task_id")
        prev = state.get(task_id, {})
        prev_status = prev.get("last_status")
        if task_id:
            persist_task_state(
                conn,
                task_id,
                status_name,
                prev.get("original_author"),
                None,
            )

        if task_id and status_name in {"Approved", "QA Awaiting Review"}:
            approval_author = resolve_owner_name(t)
            approval_email = (t.get("owned_by_user_email") or "").strip()
            if not approval_email:
                approval_email = users_email_by_name.get(
                    normalize_name(approval_author), ""
                )
            approved_at = t.get("approved_at") or t.get("updated_at") or ts
            append_approval_log(
                conn,
                task_id,
                t.get("task_name"),
                approval_author,
                approval_email,
                approved_at,
            )
            if backfill or task_id not in approved_ids:
                sheet_author = approval_author
                sheet_email = approval_email
                contractor_match = None
                if approval_email:
                    contractor_match = contractor_email_map.get(approval_email.lower())
                else:
                    contractor_code = extract_contractor_code(approval_author)
                    contractor_match = find_contractor_match_by_code(
                        contractor_code, contractor_email_map
                    )
                if contractor_match:
                    sheet_author = contractor_match.get("name") or sheet_author
                    sheet_email = contractor_match.get("email") or sheet_email
                new_sheet_rows.append(
                    [
                        t.get("task_name") or "",
                        sheet_author,
                        sheet_email,
                        approved_at,
                        task_id,
                    ]
                )
                approved_ids.add(task_id)

        owned_by_name = resolve_owner_name(t)
        owned_by_email = (t.get("owned_by_user_email") or "").strip()
        if not owned_by_email:
            owned_by_email = users_email_by_name.get(normalize_name(owned_by_name), "")

        row = [
            t.get("task_name"),
            status_name,
            t.get("created_by_user_name"),
            t.get("updated_by_user_name"),
            owned_by_name,
            owned_by_email,
            t.get("verifier_count"),
            t.get("final_score"),
            t.get("has_gt_grade"),
            t.get("created_at"),
            t.get("updated_at"),
            task_id,
        ]
        rows.append(row)
        json_tasks.append(
            {
                "task_name": t.get("task_name"),
                "status_name": status_name,
                "created_by_user_name": t.get("created_by_user_name"),
                "updated_by_user_name": t.get("updated_by_user_name"),
                "owned_by_user_name": owned_by_name,
                "owned_by_user_email": owned_by_email,
                "verifier_count": t.get("verifier_count"),
                "final_score": t.get("final_score"),
                "has_gt_grade": t.get("has_gt_grade"),
                "created_at": t.get("created_at"),
                "updated_at": t.get("updated_at"),
                "approved_at": t.get("approved_at"),
                "task_id": task_id,
                "claiming_reviewer": extract_claiming_reviewer(t),
            }
        )

    lines.extend(table_rows(rows))
    if new_sheet_rows:
        sheet_rows = new_sheet_rows
        replace = False
        if backfill:
            header = ["task_name", "author_name", "author_email", "approved_at", "task_id"]
            sheet_rows = [header, *new_sheet_rows]
            replace = True
        append_sheet_rows(sheet_rows, sheet_id, sheet_tab, creds_info, replace=replace)

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(
            {
                "generated_at": ts,
                "url": URL,
                "rows_returned": len(tasks),
                "tasks": json_tasks,
            },
            f,
            indent=2,
        )

    with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        writer.writerows(rows[1:])

    cur = conn.execute(
        """
        SELECT task_name, original_author, original_author_email, approved_at, task_id
        FROM approvals_log
        ORDER BY approved_at DESC
        """
    )
    approval_rows = cur.fetchall()
    with open(OUT_CHANGELOG_JSON, "w", encoding="utf-8") as f:
        json.dump(
            [
                {
                    "task_name": row[0],
                    "original_author": row[1],
                    "original_author_email": row[2],
                    "approved_at": row[3],
                    "task_id": row[4],
                }
                for row in approval_rows
            ],
            f,
            indent=2,
        )

    with open(OUT_CHANGELOG_CSV, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(
            ["task_name", "original_author", "original_author_email", "approved_at", "task_id"]
        )
        writer.writerows(approval_rows)

    conn.commit()
    conn.close()

    print(f"Updated: {OUT_FILE}")
    print(f"Updated: {OUT_JSON}")
    print(f"Updated: {OUT_CSV}")
    print(f"Updated: {OUT_CHANGELOG_JSON}")
    print(f"Updated: {OUT_CHANGELOG_CSV}")


if __name__ == "__main__":
    main()

import warnings
warnings.filterwarnings("ignore", message="urllib3 v2 only supports OpenSSL")

import os
import csv
import json
import sqlite3
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

URL = "https://api.studio.mercor.com/tasks/world/world_2cb0dbfca8494125bc1b71f0f3472a76/detailed"
CLAIMABLE_URL = "https://api.studio.mercor.com/worlds/claimable?campaign_id={campaign_id}"
OUT_FILE = "data/data.txt"
OUT_JSON = "data/data.json"
OUT_CSV = "data/data.csv"
OUT_CHANGELOG_JSON = "data/changelog.json"
OUT_CHANGELOG_CSV = "data/changelog.csv"
DB_FILE = "data/tasks.db"
USERS_URL_TEMPLATE = "https://api.studio.mercor.com/users/campaign/{campaign_id}"


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
    conn = sqlite3.connect(DB_FILE)
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


def append_approval_log(conn, task_id, task_name, original_author, original_author_email, approved_at):
    conn.execute(
        """
        INSERT OR IGNORE INTO approvals_log (task_id, task_name, original_author, original_author_email, approved_at)
        VALUES (?, ?, ?, ?, ?)
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


def load_claimable_authors(headers, campaign_id):
    url = CLAIMABLE_URL.format(campaign_id=campaign_id)
    r = requests.get(url, headers=headers, timeout=60)
    if r.status_code == 401:
        raise SystemExit("401 Unauthorized while loading claimable tasks.")
    r.raise_for_status()
    payload = r.json()
    task_map = {}
    if isinstance(payload, list):
        items = payload
    else:
        items = payload.get("tasks", []) if isinstance(payload, dict) else []
    for item in items:
        task_id = item.get("task_id") or item.get("id")
        author_name = item.get("original_author_name") or ""
        author_id = item.get("original_author_id") or ""
        if task_id and author_name:
            task_map[task_id] = {
                "original_author_name": author_name,
                "original_author_id": author_id,
            }
    return task_map


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

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    conn = init_db()
    state = load_task_state(conn)
    approved_ids = load_approved_task_ids(conn)

    columns = [
        "task_name",
        "status_name",  # from task_status_defn.status_name
        "original_author",
        "original_author_email",
        "created_by_user_name",
        "updated_by_user_name",
        "owned_by_user_name",
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
    for t in tasks:
        status_name = ""
        status_defn = t.get("task_status_defn") or {}
        if isinstance(status_defn, dict):
            status_name = status_defn.get("status_name", "")

        task_id = t.get("task_id")
        prev = state.get(task_id, {})
        prev_status = prev.get("last_status")
        original_author = prev.get("original_author")
        newly_set = False
        if (
            not original_author
            and prev.get("last_status") == "Seed Status"
            and status_name
            and status_name != "Seed Status"
        ):
            updated_by = t.get("updated_by_user_name")
            if updated_by:
                original_author = updated_by
                newly_set = True

        if task_id:
            persist_task_state(
                conn,
                task_id,
                status_name,
                original_author,
                ts if newly_set else None,
            )

        if task_id and status_name == "Approved":
            if task_id not in approved_ids:
                approval_author = original_author or t.get("updated_by_user_name") or ""
                approval_email = users_email_by_name.get(normalize_name(approval_author), "")
                approved_at = t.get("updated_at") or ts
                append_approval_log(
                    conn,
                    task_id,
                    t.get("task_name"),
                    approval_author,
                    approval_email,
                    approved_at,
                )
                approved_ids.add(task_id)

        display_author = original_author
        if t.get("owned_by_user_name"):
            display_author = t.get("owned_by_user_name")
        display_author_email = users_email_by_name.get(
            normalize_name(display_author), ""
        )

        row = [
            t.get("task_name"),
            status_name,
            display_author or "",
            display_author_email,
            t.get("created_by_user_name"),
            t.get("updated_by_user_name"),
            t.get("owned_by_user_name"),
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
                "original_author": display_author,
                "original_author_email": display_author_email,
                "created_by_user_name": t.get("created_by_user_name"),
                "updated_by_user_name": t.get("updated_by_user_name"),
                "owned_by_user_name": t.get("owned_by_user_name"),
                "verifier_count": t.get("verifier_count"),
                "final_score": t.get("final_score"),
                "has_gt_grade": t.get("has_gt_grade"),
                "created_at": t.get("created_at"),
                "updated_at": t.get("updated_at"),
                "task_id": task_id,
            }
        )

    lines.extend(table_rows(rows))

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

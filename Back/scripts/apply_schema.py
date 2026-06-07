from pathlib import Path

from app.db import get_conn

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "database" / "schema.sql"

if __name__ == "__main__":
    sql = SCHEMA.read_text(encoding="utf-8")
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql)
    print(f"Schema aplicado: {SCHEMA}")

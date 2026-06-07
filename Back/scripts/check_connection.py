from app.db import fetch_one

if __name__ == "__main__":
    row = fetch_one("select now()::text as now, current_database() as db, current_user as user")
    print(row)

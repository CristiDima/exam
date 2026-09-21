"""Convert the old Docker/Flask app's SQLite history into a progress file
that can be loaded with "Import progress" on the Results Dashboard.

Usage:
    python3 scripts/export_flask_history.py path/to/quiz.db [bank-id] > epso-progress-from-docker.json

Only finished runs are exported (the old app also stored abandoned runs).
Dates are converted from the container's UTC time to local time.
"""
import json
import sqlite3
import sys
from datetime import datetime, timezone


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    db_path = sys.argv[1]
    bank = sys.argv[2] if len(sys.argv) > 2 else "data-management"

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    stats = {
        r["question_hash"]: {"times_answered": r["times_answered"], "times_wrong": r["times_wrong"]}
        for r in conn.execute("SELECT * FROM question_stats")
    }

    runs = []
    rows = conn.execute("""
        SELECT r.id, r.date, r.mode, r.time_seconds,
               COUNT(a.id) AS total, COALESCE(SUM(a.correct), 0) AS correct
        FROM runs r JOIN run_answers a ON a.run_id = r.id
        WHERE r.time_seconds > 0
        GROUP BY r.id ORDER BY r.id
    """)
    for r in rows:
        utc = datetime.fromisoformat(r["date"]).replace(tzinfo=timezone.utc)
        runs.append({
            "id": r["id"],
            "date": utc.astimezone().strftime("%Y-%m-%dT%H:%M:%S"),
            "bank": bank,
            "mode": r["mode"],
            "total": r["total"],
            "correct": r["correct"],
            "time_seconds": r["time_seconds"],
        })

    next_id = max((r["id"] for r in runs), default=0) + 1
    json.dump({"version": 1, "next_run_id": next_id, "stats": stats, "runs": runs}, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()

"""Саммари по переходам: Click + PostStats из SQLite."""
import sqlite3, datetime

DB = '/home/z/my-project/db/custom.db'
con = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
cur = con.cursor()

tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'")]
print('Таблицы:', tables)

total_rows = cur.execute("SELECT COUNT(*) FROM Click").fetchone()[0]
print(f'\nВсего строк в Click (уникальных visitors): {total_rows}')

print('\n--- Переходы по кодам (все записи Click) ---')
rows = cur.execute("""
    SELECT c.utmCode, COUNT(*) AS clicks, MIN(c.createdAt), MAX(c.createdAt)
    FROM Click c GROUP BY c.utmCode ORDER BY clicks DESC
""").fetchall()
for code, n, mn, mx in rows:
    def fmt(ts):
        if ts is None: return '—'
        try:
            return datetime.datetime.fromtimestamp(int(ts)/1000, datetime.timezone.utc).strftime('%m-%d %H:%M')
        except Exception:
            return str(ts)
    print(f'{code:<12} клики(уник.): {n:<4} первый: {fmt(mn)}  последний: {fmt(mx)}')

# даты в iso-формате?
sample = cur.execute("SELECT createdAt FROM Click LIMIT 1").fetchone()
print('\nФормат createdAt (пример):', sample)

print('\n--- PostStats (score) ---')
stats = cur.execute("SELECT utmCode, score, updatedAt FROM PostStats ORDER BY score DESC").fetchall()
for code, score, upd in stats:
    print(f'{code:<12} score={score:<6} updatedAt={upd}')
con.close()

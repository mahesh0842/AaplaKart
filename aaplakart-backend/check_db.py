"""Quick script to check database tables and orders."""
import aiosqlite
import asyncio

async def check():
    async with aiosqlite.connect('./aaplakart.db') as db:
        cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = await cursor.fetchall()
        print('Tables:', [t[0] for t in tables])
        for t in tables:
            cursor = await db.execute(f"SELECT COUNT(*) FROM {t[0]}")
            count = await cursor.fetchone()
            print(f'  {t[0]}: {count[0]} rows')

asyncio.run(check())

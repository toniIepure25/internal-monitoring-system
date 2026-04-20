"""Run seed.py only if the users table is empty (safe for repeated deploys)."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import async_session_factory


async def main():
    async with async_session_factory() as db:
        result = await db.execute(text("SELECT count(*) FROM users"))
        count = result.scalar()

    if count == 0:
        print("No users found — running seed...")
        from scripts.seed import seed
        await seed()
    else:
        print(f"Database already has {count} user(s) — skipping seed")


if __name__ == "__main__":
    asyncio.run(main())

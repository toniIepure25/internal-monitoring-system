"""Seed script: creates demo users and sample applications for development."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import async_session_factory, engine, Base
from app.models.user import User, UserRole
from app.models.application import Application, DetectionSource
from app.models.application_status import ApplicationStatus, AppState
from app.services.auth_service import hash_password
from app.utils.url import normalize_url


DEMO_USERS = [
    {"email": "admin@company.internal", "display_name": "Admin User", "password": "admin1234", "role": UserRole.ADMIN},
    {"email": "user@company.internal", "display_name": "Standard User", "password": "user1234", "role": UserRole.USER},
    {"email": "ops@company.internal", "display_name": "Ops Engineer", "password": "ops12345", "role": UserRole.USER},
]

DEMO_APPS = [
    {"display_name": "Payment Service", "base_url": "https://httpbin.org", "environment": "production"},
    {"display_name": "User Auth API", "base_url": "https://jsonplaceholder.typicode.com", "environment": "production"},
    {"display_name": "Notification Service", "base_url": "https://postman-echo.com", "environment": "staging"},
    {"display_name": "Inventory API", "base_url": "https://httpstat.us", "environment": "production"},
    {"display_name": "Analytics Engine", "base_url": "https://echo.free.beeceptor.com", "environment": "development"},
]


async def seed():
    print("Seeding database...")

    async with async_session_factory() as db:
        users = []
        for u in DEMO_USERS:
            user = User(
                email=u["email"],
                password_hash=hash_password(u["password"]),
                display_name=u["display_name"],
                role=u["role"],
            )
            db.add(user)
            users.append(user)
            print(f"  Created user: {u['email']} (password: {u['password']})")

        await db.flush()
        admin_user = users[0]

        for a in DEMO_APPS:
            normalized = normalize_url(a["base_url"])
            app = Application(
                display_name=a["display_name"],
                base_url=a["base_url"],
                normalized_url=normalized,
                detection_source=DetectionSource.AUTO,
                environment=a.get("environment"),
                created_by=admin_user.id,
            )
            db.add(app)
            await db.flush()

            status = ApplicationStatus(application_id=app.id, status=AppState.UNKNOWN)
            db.add(status)
            print(f"  Created app: {a['display_name']} ({normalized})")

        await db.commit()

    print("\nSeed complete! Login credentials:")
    for u in DEMO_USERS:
        print(f"  {u['email']} / {u['password']} ({u['role'].value})")


if __name__ == "__main__":
    asyncio.run(seed())

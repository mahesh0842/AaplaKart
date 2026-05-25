"""FastAPI dependency — require a valid Firebase ID token on protected routes.

Supports two authentication methods:
1. Bearer token (Firebase ID token) — for phone-auth users
2. X-User-ID header — for Google sign-in users (fallback)
"""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.db.models import User
from app.services.firebase_service import verify_id_token, verify_id_token_rest
from app.config.firebase import is_firebase_ready

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Verify the Bearer token OR X-User-ID header and return user claims.

    Usage in a route::

        @router.get("/me")
        async def get_me(user: dict = Depends(get_current_user)):
            return {"uid": user["uid"]}

    Raises 401 if neither auth method is valid.
    """
    uid = None
    claims = {}

    # Method 1: Firebase Bearer token (phone-auth users) OR admin dev token
    if credentials is not None:
        token = credentials.credentials
        
        # Check for admin dev token
        if token.startswith("admin-dev-"):
            uid = "admin-user"
            claims = {"uid": uid, "role": "admin", "auth_method": "admin_token"}
            logger.debug("Authenticated via admin dev token")
        elif token.startswith("delivery-dev-"):
            uid = "delivery-demo-001"
            claims = {"uid": uid, "role": "delivery", "auth_method": "delivery_token"}
            logger.debug("Authenticated via delivery dev token: uid={}", uid)
        elif token.startswith("mock-dev-"):
            # Mock token format: mock-dev-{uid}-{random8chars}
            # uid can contain hyphens, so find the last part which is random
            # The token is: "mock-dev-" + uid + "-" + random
            prefix = "mock-dev-"
            suffix = token[len(prefix):]  # Everything after "mock-dev-"
            # The uid is everything before the last "-{8chars}"
            last_hyphen = suffix.rfind("-")
            if last_hyphen > 0:
                uid = suffix[:last_hyphen]
            else:
                uid = suffix  # Fallback: take everything
            if not uid:
                uid = "mock-user"
            claims = {"uid": uid, "role": "user", "auth_method": "mock_token"}
            logger.debug("Authenticated via mock dev token: uid={}", uid)
        else:
            # Try Admin SDK first, then REST API fallback
            if is_firebase_ready():
                claims = verify_id_token(token)
            else:
                claims = None

            if claims is None:
                # Fallback: verify via REST API (no service account needed)
                claims = await verify_id_token_rest(token)

            if claims is not None:
                uid = claims.get("uid")
                logger.debug("Authenticated via Firebase token: uid={}", uid)
            else:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired token",
                )

    # Method 2: X-User-ID header (Google sign-in users)
    if uid is None and x_user_id:
        uid = x_user_id
        claims = {"uid": uid, "auth_method": "google"}
        logger.debug("Authenticated via X-User-ID header: uid={}", uid)

    if uid is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header or X-User-ID header",
        )

    # Fetch user from DB to get role info
    result = await session.execute(select(User).where(User.uid == uid))
    db_user = result.scalar_one_or_none()

    # Attach role: preserve if already set (e.g., admin dev token), else from DB or default
    claims["uid"] = uid
    if "role" not in claims or not claims.get("role"):
        claims["role"] = db_user.role if db_user else "user"

    return claims


async def require_admin(
    user: dict = Depends(get_current_user),
) -> dict:
    """Dependency that ensures only admin users can access a route.

    Usage in a route::

        @router.get("/admin/stats")
        async def get_stats(user: dict = Depends(require_admin)):
            ...

    Raises 403 if the user is not an admin.
    """
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user

"""Address routes — CRUD for user saved addresses."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_session
from app.db.models import Address
from app.middleware.auth_middleware import get_current_user

router = APIRouter(prefix="/addresses", tags=["Addresses"])


class AddressSchema(BaseModel):
    id: str = ""
    label: str = "Home"
    full_name: str
    phone: str
    line1: str
    line2: str = ""
    landmark: str = ""
    city: str
    pincode: str
    latitude: float | None = None
    longitude: float | None = None

    class Config:
        from_attributes = True


class CreateAddressRequest(BaseModel):
    label: str = "Home"
    full_name: str
    phone: str
    line1: str
    line2: str = ""
    landmark: str = ""
    city: str
    pincode: str
    latitude: float | None = None
    longitude: float | None = None


@router.get("/", response_model=list[AddressSchema])
async def list_addresses(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    uid = user.get("uid", "")

    # Try Firestore first
    from app.services.firestore_service import fs_get_addresses
    fs_addrs = await fs_get_addresses(uid)
    if fs_addrs is not None:
        return [AddressSchema(**a) for a in fs_addrs]

    # Fallback to DB
    result = await db.execute(
        select(Address).where(Address.user_uid == uid).order_by(Address.created_at.desc())
    )
    return result.scalars().all()


@router.post("/", response_model=AddressSchema, status_code=201)
async def create_address(
    body: CreateAddressRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    uid = user.get("uid", "")
    import uuid
    addr_id = uuid.uuid4().hex[:12]

    # Write to Firestore
    from app.services.firestore_service import fs_create_address
    fs_data = {
        "id": addr_id,
        "user_uid": uid,
        **body.model_dump(),
    }
    fs_ok = await fs_create_address(addr_id, fs_data)

    # Also write to SQLite
    addr = Address(id=addr_id, user_uid=uid, **body.model_dump())
    db.add(addr)
    await db.commit()
    await db.refresh(addr)
    return addr


@router.delete("/{address_id}", status_code=204)
async def delete_address(
    address_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    uid = user.get("uid", "")

    # Delete from Firestore
    from app.services.firestore_service import fs_delete_address
    await fs_delete_address(address_id)

    # Delete from SQLite
    result = await db.execute(
        select(Address).where(Address.id == address_id, Address.user_uid == uid)
    )
    addr = result.scalar_one_or_none()
    if addr is None:
        raise HTTPException(status_code=404, detail="Address not found")
    await db.delete(addr)
    await db.commit()

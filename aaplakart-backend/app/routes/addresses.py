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
    addr = Address(user_uid=uid, **body.model_dump())
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
    result = await db.execute(
        select(Address).where(Address.id == address_id, Address.user_uid == uid)
    )
    addr = result.scalar_one_or_none()
    if addr is None:
        raise HTTPException(status_code=404, detail="Address not found")
    await db.delete(addr)
    await db.commit()

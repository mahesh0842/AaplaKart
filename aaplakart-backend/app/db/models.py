"""SQLAlchemy ORM models for User, Address, Order, and OrderItem."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.db.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    return uuid.uuid4().hex[:12]


# ── User ───────────────────────────────────────────────────────────


class User(Base):
    __tablename__ = "users"

    uid = Column(String(128), primary_key=True)  # Firebase UID
    phone_number = Column(String(20), unique=True, nullable=False, index=True)
    email = Column(String(255), nullable=True)
    display_name = Column(String(255), nullable=True)
    photo_url = Column(String(512), nullable=True)
    role = Column(String(20), default="user", index=True)  # "user" | "admin"
    is_test_user = Column(Integer, default=0)  # bool
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    addresses = relationship("Address", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")


# ── Address ────────────────────────────────────────────────────────


class Address(Base):
    __tablename__ = "addresses"

    id = Column(String(20), primary_key=True, default=_new_uuid)
    user_uid = Column(String(128), ForeignKey("users.uid"), nullable=False, index=True)
    label = Column(String(50), nullable=True)  # e.g. Home, Office, Other
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False)
    line1 = Column(String(255), nullable=False)
    line2 = Column(String(255), nullable=True)
    landmark = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    pincode = Column(String(20), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    user = relationship("User", back_populates="addresses")


# ── Order ──────────────────────────────────────────────────────────


class Order(Base):
    __tablename__ = "orders"

    id = Column(String(20), primary_key=True, default=_new_uuid)  # e.g. AAPL-XXXXXXXX
    user_uid = Column(String(128), ForeignKey("users.uid"), nullable=False, index=True)
    status = Column(String(20), default="pending", index=True)  # pending, confirmed, preparing, out-for-delivery, delivered, cancelled
    subtotal = Column(Float, default=0)
    delivery_fee = Column(Float, default=0)
    total = Column(Float, default=0)
    payment_method = Column(String(20), default="cod")  # cod, online
    delivery_slot = Column(String(20), default="asap")
    delivery_slot_label = Column(String(50), default="ASAP")
    estimated_delivery = Column(DateTime, nullable=True)

    # Snapshot of the delivery address at order time
    address_full_name = Column(String(255), nullable=True)
    address_phone = Column(String(20), nullable=True)
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    address_landmark = Column(String(255), nullable=True)
    address_city = Column(String(100), nullable=True)
    address_pincode = Column(String(20), nullable=True)
    address_latitude = Column(Float, nullable=True)
    address_longitude = Column(Float, nullable=True)

    placed_at = Column(DateTime, default=_utcnow, index=True)  # index for fast ORDER BY
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    # ── Firestore batch-archive tracking ──
    synced_to_firestore = Column(Integer, default=0, index=True)  # 0=pending, 1=synced
    synced_at = Column(DateTime, nullable=True)  # when batch-synced to Firestore

    user = relationship("User", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


# Composite index for admin order listing (status + placed_at DESC)
from sqlalchemy import Index
Index("idx_orders_status_placed_at", Order.status, Order.placed_at.desc())


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(String(20), ForeignKey("orders.id"), nullable=False)
    product_id = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)
    weight = Column(String(50), nullable=True)
    image_path = Column(String(512), nullable=True)

    order = relationship("Order", back_populates="items")


# ── Shop / Delivery Hub ──────────────────────────────────────────


class Shop(Base):
    __tablename__ = "shops"

    id = Column(String(20), primary_key=True, default=_new_uuid)
    name = Column(String(255), nullable=False)
    address = Column(String(512), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    delivery_radius_km = Column(Float, default=6.0)
    phone = Column(String(20), nullable=True)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

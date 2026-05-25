"""
One-time migration + admin setup script.

Usage:
    cd backend
    python -m app.scripts.setup_admin

This script:
1. Adds the `role` column to the users table (if not already present)
2. Prompts for a phone number to promote to admin
   OR you can pass it directly: python -m app.scripts.setup_admin +919876543210
"""

from __future__ import annotations

import asyncio
import os
import sqlite3
import sys
from pathlib import Path


DB_PATH = Path(__file__).resolve().parent.parent.parent / "aaplakart.db"


def add_role_column() -> bool:
    """Add role column if it doesn't exist. Returns True if added."""
    if not DB_PATH.exists():
        print(f"❌ Database not found at {DB_PATH}")
        print("   Make sure the backend has been started at least once.")
        return False

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    # Check if role column already exists
    cursor.execute("PRAGMA table_info(users)")
    columns = [col[1] for col in cursor.fetchall()]

    if "role" in columns:
        print("✅ 'role' column already exists in users table.")
        conn.close()
        return True

    # Add the column
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'")
        conn.commit()
        print("✅ Added 'role' column to users table (default: 'user').")
    except Exception as e:
        print(f"❌ Failed to add column: {e}")
        conn.close()
        return False

    conn.close()
    return True


def set_admin(phone_number: str) -> bool:
    """Set a user as admin by phone number."""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    # Normalize phone number
    phone = phone_number.strip()
    if not phone.startswith("+"):
        phone = f"+{phone}"

    cursor.execute("SELECT uid, phone_number, display_name FROM users WHERE phone_number = ?", (phone,))
    user = cursor.fetchone()

    if not user:
        # Try without +
        if phone.startswith("+"):
            alt_phone = phone[1:]
            cursor.execute("SELECT uid, phone_number, display_name FROM users WHERE phone_number = ?", (alt_phone,))
            user = cursor.fetchone()

    if not user:
        print(f"❌ No user found with phone: {phone}")
        print("   Available users in DB:")
        cursor.execute("SELECT uid, phone_number, display_name, role FROM users")
        for row in cursor.fetchall():
            print(f"     {row[1]} | {row[2] or 'N/A'} | role={row[3] or 'user'} | uid={row[0]}")
        conn.close()
        return False

    uid, found_phone, display_name = user
    cursor.execute("UPDATE users SET role = 'admin' WHERE uid = ?", (uid,))
    conn.commit()

    print(f"✅ User promoted to ADMIN:")
    print(f"   Phone: {found_phone}")
    print(f"   Name:  {display_name or 'N/A'}")
    print(f"   UID:   {uid}")
    print(f"   Role:  admin")

    conn.close()
    return True


def list_users():
    """Show all users and their roles."""
    if not DB_PATH.exists():
        print(f"❌ Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()

    cursor.execute("SELECT uid, phone_number, display_name, role FROM users ORDER BY created_at DESC")
    users = cursor.fetchall()

    if not users:
        print("No users in database yet.")
    else:
        print(f"\n📋 All users ({len(users)}):")
        print("-" * 70)
        for uid, phone, name, role in users:
            role_str = role or "user"
            badge = "🔑 ADMIN" if role_str == "admin" else "👤 user"
            print(f"  {badge} | {phone} | {name or 'N/A'} | {uid[:12]}...")
        print("-" * 70)

    conn.close()


def main():
    print("=" * 50)
    print("  AaplaKart — Admin Setup Script")
    print("=" * 50)

    # Step 1: Ensure role column exists
    if not add_role_column():
        return

    # Step 2: Check for phone argument
    if len(sys.argv) > 1:
        phone = sys.argv[1]
        set_admin(phone)
        list_users()
        return

    # Step 3: Interactive mode
    list_users()

    print("\nEnter phone number to promote to admin")
    print("(e.g. +919876543210), or press Enter to skip:")
    phone = input("> ").strip()

    if phone:
        set_admin(phone)
        list_users()
    else:
        print("Skipped. No changes made.")
        print("\nTip: Run again with phone number as argument:")
        print("  python -m app.scripts.setup_admin +919876543210")


if __name__ == "__main__":
    main()

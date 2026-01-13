#!/usr/bin/env python3
"""
Fix Existing Users - Add Passwords to Old Users
Run this once to update all existing users with default password: temp123
"""

import psycopg2
from werkzeug.security import generate_password_hash

# Database connection
DB_CONFIG = {
    'dbname': 'parking_db',
    'user': 'postgres',
    'password': 'admin',
    'host': 'localhost',
    'port': 5432
}

def fix_users():
    """Update all users who have NULL passwords"""
    
    # Default password for all existing users
    default_password = 'temp123'
    hashed_password = generate_password_hash(default_password)
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Check how many users need fixing
        cur.execute("SELECT user_id, username, full_name FROM users WHERE password_hash IS NULL")
        users_to_fix = cur.fetchall()
        
        if not users_to_fix:
            print("✅ All users already have passwords!")
            return
        
        print(f"\n🔧 Found {len(users_to_fix)} users without passwords:")
        print("-" * 60)
        for user_id, username, full_name in users_to_fix:
            print(f"  • {username} ({full_name})")
        
        print("\n🔑 Setting default password 'temp123' for all users...")
        
        # Update all users with NULL passwords
        cur.execute("""
            UPDATE users 
            SET password_hash = %s 
            WHERE password_hash IS NULL
        """, (hashed_password,))
        
        conn.commit()
        
        print(f"\n✅ SUCCESS! Updated {cur.rowcount} users")
        print("\n📋 Login Credentials:")
        print("-" * 60)
        
        # Show all users with their credentials
        cur.execute("SELECT username, full_name, role FROM users ORDER BY role, username")
        all_users = cur.fetchall()
        
        for username, full_name, role in all_users:
            print(f"  {role.upper():12} | {username:15} | Password: temp123 | {full_name}")
        
        print("-" * 60)
        print("\n🔐 All users can now login with password: temp123")
        print("💡 Tip: Users should change their password after first login")
        
        cur.close()
        conn.close()
        
    except psycopg2.Error as e:
        print(f"\n❌ Database Error: {e}")
        return
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return

if __name__ == '__main__':
    print("=" * 60)
    print("🔧 FIXING EXISTING USERS - Adding Default Passwords")
    print("=" * 60)
    fix_users()
    print("\n✨ Done! Try logging in now!")
    print("=" * 60)
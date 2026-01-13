#!/usr/bin/env python3
"""
Fix Full Names - Make sure full_name = username for all users
"""

import psycopg2

# Correct database config matching app.py
DB_CONFIG = {
    'dbname': 'parking_system',  # ← Correct name
    'user': 'postgres',
    'password': 'postgres',      # ← Correct password
    'host': 'localhost',
    'port': 5432
}

def fix_full_names():
    """Set full_name = username for all users"""
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        print("\n" + "="*60)
        print("🔧 SYNCING full_name WITH username")
        print("="*60)
        print("\nSince we removed the full_name field from the UI,")
        print("we're setting full_name = username for everyone.\n")
        
        # Update ALL users to have full_name = username
        cur.execute("""
            UPDATE users 
            SET full_name = username 
            WHERE full_name IS NULL OR full_name != username
        """)
        
        conn.commit()
        
        print(f"✅ Updated {cur.rowcount} users")
        
        # Show final state
        cur.execute("""
            SELECT user_id, username, role, password_hash IS NOT NULL as has_pw
            FROM users 
            ORDER BY role, username
        """)
        all_users = cur.fetchall()
        
        print("\n📋 All Users:")
        print("-" * 60)
        print(f"{'ID':<5} {'Username':<20} {'Role':<12} {'Has Password':<15}")
        print("-" * 60)
        for user_id, username, role, has_pw in all_users:
            status = '✅' if has_pw else '❌ NO PASSWORD!'
            print(f"{user_id:<5} {username:<20} {role:<12} {status}")
        
        print("-" * 60)
        print("\n🔐 Login Credentials (password: temp123 for all):")
        print("-" * 60)
        for user_id, username, role, has_pw in all_users:
            if has_pw:
                print(f"  {username} / temp123")
        
        print("\n✨ Done! Everyone should be able to login now!")
        print("="*60 + "\n")
        
        cur.close()
        conn.close()
        
    except psycopg2.OperationalError as e:
        print(f"\n❌ Connection Error: {e}")
        print("\nTip: Make sure PostgreSQL is running!")
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == '__main__':
    fix_full_names()
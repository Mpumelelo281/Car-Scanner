#!/usr/bin/env python3
"""
Check Users Table - See what data exists
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

def check_users():
    """Check all users and their data"""
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        print("\n" + "="*80)
        print("👥 USERS TABLE INSPECTION")
        print("="*80)
        
        cur.execute("""
            SELECT 
                user_id,
                username,
                role,
                assigned_shift,
                supervisor_id,
                is_active,
                password_hash IS NOT NULL as has_password
            FROM users 
            ORDER BY role, username
        """)
        
        users = cur.fetchall()
        
        if not users:
            print("\n❌ No users found in database!")
            return
        
        print(f"\n📊 Found {len(users)} users:\n")
        print(f"{'ID':<5} {'Username':<20} {'Role':<12} {'Shift':<7} {'Sup ID':<7} {'Active':<8} {'Has PW':<8}")
        print("-"*80)
        
        for user in users:
            user_id, username, role, shift, sup_id, active, has_pw = user
            print(f"{user_id:<5} {username:<20} {role:<12} {str(shift or '-'):<7} {str(sup_id or '-'):<7} {'✅' if active else '❌':<8} {'✅' if has_pw else '❌':<8}")
        
        print("\n" + "="*80)
        
        # Check for issues
        issues = []
        for user in users:
            user_id, username, role, shift, sup_id, active, has_pw = user
            if not has_pw:
                issues.append(f"❌ {username}: No password set")
            if not active:
                issues.append(f"⚠️  {username}: User is inactive")
        
        if issues:
            print("\n🚨 ISSUES FOUND:")
            for issue in issues:
                print(f"  {issue}")
        else:
            print("\n✅ All users are ready to login!")
        
        print("="*80 + "\n")
        
        # Test login credentials
        print("🔐 LOGIN CREDENTIALS:")
        print("-"*80)
        for user in users:
            user_id, username, role, shift, sup_id, active, has_pw = user
            if active and has_pw:
                print(f"  Username: {username:<20} | Password: temp123 | Role: {role}")
        print("="*80 + "\n")
        
        cur.close()
        conn.close()
        
    except psycopg2.OperationalError as e:
        print(f"\n❌ Connection Error: {e}")
        print("\nTip: Make sure PostgreSQL is running!")
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == '__main__':
    check_users()
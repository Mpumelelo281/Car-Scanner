#!/usr/bin/env python3
"""
Create test users that can actually log in
"""

import psycopg
import bcrypt

DB_CONFIG = {
    'host': 'localhost',
    'dbname': 'parking_system',
    'user': 'postgres',
    'password': 'postgres'
}

def create_test_users():
    """Create active test users"""
    
    try:
        conn = psycopg.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        print("\n" + "="*60)
        print("👥 Creating Test Users")
        print("="*60)
        
        # Test users to create
        test_users = [
            {'username': 'testworker', 'role': 'worker', 'full_name': 'Test Worker', 'assigned_shift': 1},
            {'username': 'testsupervisor', 'role': 'supervisor', 'full_name': 'Test Supervisor', 'assigned_shift': 2},
            {'username': 'testadmin2', 'role': 'admin', 'full_name': 'Test Admin 2', 'assigned_shift': None},
        ]
        
        default_password = 'temp123'
        password_hash = bcrypt.hashpw(default_password.encode(), bcrypt.gensalt()).decode()
        
        for user_data in test_users:
            try:
                # Check if user exists
                cur.execute('SELECT user_id FROM users WHERE username = %s', (user_data['username'],))
                existing = cur.fetchone()
                
                if existing:
                    print(f"\n⚠️  User '{user_data['username']}' already exists (ID: {existing[0]})")
                    # Update to be active
                    cur.execute('UPDATE users SET is_active = TRUE WHERE username = %s', (user_data['username'],))
                    conn.commit()
                    print(f"   ✅ Activated existing user")
                else:
                    # Create new user
                    cur.execute('''
                        INSERT INTO users (username, password_hash, role, full_name, assigned_shift, is_active)
                        VALUES (%s, %s, %s, %s, %s, TRUE) RETURNING user_id
                    ''', (user_data['username'], password_hash, user_data['role'], 
                          user_data['full_name'], user_data['assigned_shift']))
                    
                    user_id = cur.fetchone()[0]
                    conn.commit()
                    print(f"\n✅ Created user: {user_data['username']} (ID: {user_id})")
                    print(f"   Role: {user_data['role']}")
                    print(f"   Password: {default_password}")
                    
            except psycopg.errors.UniqueViolation:
                conn.rollback()
                print(f"\n❌ Username '{user_data['username']}' already exists")
            except Exception as e:
                conn.rollback()
                print(f"\n❌ Error creating user '{user_data['username']}': {e}")
        
        # Also activate the most common test users
        print("\n" + "-"*60)
        print("🔄 Activating other test users...")
        
        users_to_activate = ['worker1', 'Lwa', 'Ambr', 'Sthe', 'Nto', 'Zee']
        for username in users_to_activate:
            cur.execute('UPDATE users SET is_active = TRUE WHERE username = %s', (username,))
        
        conn.commit()
        print("✅ Activated existing worker accounts")
        
        # Show all active users
        print("\n" + "="*60)
        print("📋 All ACTIVE Users (Can Login):")
        print("="*60)
        
        cur.execute('''
            SELECT user_id, username, role, full_name 
            FROM users 
            WHERE is_active = TRUE 
            ORDER BY role DESC, username
        ''')
        
        active_users = cur.fetchall()
        print(f"\n{'ID':<4} {'Username':<20} {'Role':<12} {'Full Name':<25}")
        print("-" * 65)
        
        for user_id, username, role, full_name in active_users:
            print(f"{user_id:<4} {username:<20} {role:<12} {full_name:<25}")
        
        print("\n" + "="*60)
        print("🔐 All new users have password: temp123")
        print("="*60)
        print("\n✅ Test users created/activated successfully!")
        print("\n📝 Try logging in with any of these credentials:")
        print("   - admin / admin123")
        print("   - testworker / temp123")
        print("   - testsupervisor / temp123")
        print("   - worker1 / temp123")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    create_test_users()

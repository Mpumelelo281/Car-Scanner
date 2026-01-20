"""
QUICK FIX - Check users and add admin if needed
"""

import psycopg
import bcrypt

DB_NAME = 'parking_system'
DB_USER = 'postgres'
DB_PASSWORD = 'postgres'
DB_HOST = 'localhost'

def quick_fix():
    try:
        conn = psycopg.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST
        )
        cur = conn.cursor()
        
        print("🔍 CHECKING YOUR DATABASE")
        print("="*60)
        
        # Count users
        cur.execute("SELECT COUNT(*) FROM users")
        user_count = cur.fetchone()[0]
        
        print(f"\n👥 Users in database: {user_count}")
        
        if user_count == 0:
            print("\n❌ NO USERS FOUND! This is why you can't login.")
            print("\n💡 Let me create an admin user for you...")
            
            # Create admin
            username = input("\nAdmin username [admin]: ").strip() or "admin"
            password = input("Admin password [admin123]: ").strip() or "admin123"
            
            password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
            
            cur.execute('''
                INSERT INTO users (username, password_hash, role, full_name, is_active)
                VALUES (%s, %s, 'admin', 'System Administrator', TRUE)
                RETURNING user_id
            ''', (username, password_hash))
            
            user_id = cur.fetchone()[0]
            conn.commit()
            
            print(f"\n✅ Admin created successfully! (ID: {user_id})")
            print(f"\n🔐 LOGIN CREDENTIALS:")
            print(f"   Username: {username}")
            print(f"   Password: {password}")
            print("\n✅ You can now login!")
            
        else:
            print("\n✅ Users found:")
            cur.execute("SELECT user_id, username, role, full_name, is_active FROM users ORDER BY user_id")
            users = cur.fetchall()
            
            for user in users:
                status = "✅ ACTIVE" if user[4] else "❌ INACTIVE"
                print(f"   {status} | ID:{user[0]} | {user[1]} ({user[2]}) - {user[3]}")
            
            print("\n⚠️  If you forgot passwords, we can reset them...")
            response = input("\nDo you want to reset a password? (y/n): ").lower()
            
            if response == 'y':
                username = input("\nEnter username to reset: ").strip()
                
                cur.execute("SELECT user_id FROM users WHERE username = %s", (username,))
                user = cur.fetchone()
                
                if user:
                    new_password = input(f"New password for {username}: ").strip()
                    password_hash = bcrypt.hashpw(new_password.encode(), bcrypt.gensalt()).decode()
                    
                    cur.execute("UPDATE users SET password_hash = %s WHERE username = %s", (password_hash, username))
                    conn.commit()
                    
                    print(f"\n✅ Password reset for {username}!")
                    print(f"   New password: {new_password}")
                else:
                    print(f"\n❌ User '{username}' not found!")
        
        # Check other tables
        print("\n📊 Other tables:")
        for table in ['cars', 'scans', 'holding_areas', 'vessels']:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()[0]
            print(f"   {table}: {count} records")
        
        print("\n" + "="*60)
        print("✅ CHECK COMPLETE!")
        print("="*60)
        
        print("\n🚀 Next steps:")
        print("   1. Start server: python app.py")
        print("   2. Open browser: http://localhost:5000")
        print("   3. Login with your credentials")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    quick_fix()
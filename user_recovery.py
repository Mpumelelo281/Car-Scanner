"""
EMERGENCY USER RECOVERY SCRIPT
This will recreate your users WITHOUT dropping existing data
"""

import psycopg
import bcrypt

DB_NAME = 'parking_system'
DB_USER = 'postgres'
DB_PASSWORD = 'postgres'
DB_HOST = 'localhost'

def recover_users():
    """Recreate users without losing car/scan data"""
    try:
        conn = psycopg.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST
        )
        cur = conn.cursor()
        
        print("🔍 Checking current database state...")
        
        # Check if users table exists
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            )
        """)
        users_table_exists = cur.fetchone()[0]
        
        if not users_table_exists:
            print("⚠️  Users table doesn't exist! Creating it...")
            
            # Create users table
            cur.execute('''
                CREATE TABLE users (
                    user_id SERIAL PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'supervisor', 'worker')),
                    full_name VARCHAR(100) NOT NULL,
                    assigned_shift INTEGER CHECK (assigned_shift BETWEEN 1 AND 2),
                    supervisor_id INTEGER REFERENCES users(user_id),
                    is_active BOOLEAN DEFAULT TRUE,
                    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            print("✅ Users table created")
        
        # Check if we have any users
        cur.execute("SELECT COUNT(*) FROM users")
        user_count = cur.fetchone()[0]
        
        if user_count == 0:
            print("\n📝 Creating default users...")
            
            # Create admin user
            admin_pass = bcrypt.hashpw('admin123'.encode(), bcrypt.gensalt()).decode()
            cur.execute('''
                INSERT INTO users (username, password_hash, role, full_name, is_active)
                VALUES ('admin', %s, 'admin', 'System Administrator', TRUE)
                RETURNING user_id
            ''', (admin_pass,))
            admin_id = cur.fetchone()[0]
            print(f"✅ Admin created (ID: {admin_id})")
            print("   Username: admin")
            print("   Password: admin123")
            
            # Create a supervisor
            supervisor_pass = bcrypt.hashpw('super123'.encode(), bcrypt.gensalt()).decode()
            cur.execute('''
                INSERT INTO users (username, password_hash, role, full_name, assigned_shift, is_active)
                VALUES ('supervisor1', %s, 'supervisor', 'Supervisor One', 1, TRUE)
                RETURNING user_id
            ''', (supervisor_pass,))
            supervisor_id = cur.fetchone()[0]
            print(f"✅ Supervisor created (ID: {supervisor_id})")
            print("   Username: supervisor1")
            print("   Password: super123")
            
            # Create a few workers
            worker_pass = bcrypt.hashpw('worker123'.encode(), bcrypt.gensalt()).decode()
            
            workers = [
                ('worker1', 'Worker One', 1),
                ('worker2', 'Worker Two', 1),
                ('worker3', 'Worker Three', 2),
            ]
            
            for username, fullname, shift in workers:
                cur.execute('''
                    INSERT INTO users (username, password_hash, role, full_name, assigned_shift, supervisor_id, is_active)
                    VALUES (%s, %s, 'worker', %s, %s, %s, TRUE)
                    RETURNING user_id
                ''', (username, worker_pass, fullname, shift, supervisor_id))
                worker_id = cur.fetchone()[0]
                print(f"✅ {fullname} created (ID: {worker_id})")
            
            print("\n   All workers password: worker123")
        else:
            print(f"\n✅ Found {user_count} existing users - no changes needed")
        
        # Fix any orphaned scans (scans with no worker)
        print("\n🔧 Checking for orphaned scans...")
        cur.execute("""
            SELECT COUNT(*) 
            FROM scans s 
            WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = s.worker_id)
        """)
        orphaned_count = cur.fetchone()[0]
        
        if orphaned_count > 0:
            print(f"⚠️  Found {orphaned_count} orphaned scans")
            
            # Get or create a default admin user
            cur.execute("SELECT user_id FROM users WHERE role = 'admin' LIMIT 1")
            admin = cur.fetchone()
            
            if admin:
                admin_id = admin[0]
                print(f"   Assigning orphaned scans to admin (ID: {admin_id})...")
                cur.execute("""
                    UPDATE scans 
                    SET worker_id = %s 
                    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = scans.worker_id)
                """, (admin_id,))
                print(f"✅ Fixed {orphaned_count} orphaned scans")
        else:
            print("✅ No orphaned scans found")
        
        conn.commit()
        
        # Show summary
        print("\n" + "="*60)
        print("📊 FINAL DATABASE STATE:")
        print("="*60)
        
        cur.execute("""
            SELECT role, COUNT(*) as count 
            FROM users 
            WHERE is_active = TRUE 
            GROUP BY role 
            ORDER BY role
        """)
        
        for row in cur.fetchall():
            print(f"   {row[0].upper()}: {row[1]} users")
        
        cur.execute("SELECT COUNT(*) FROM cars WHERE is_active = TRUE")
        car_count = cur.fetchone()[0]
        print(f"\n   CARS: {car_count} records")
        
        cur.execute("SELECT COUNT(*) FROM scans")
        scan_count = cur.fetchone()[0]
        print(f"   SCANS: {scan_count} records")
        
        print("\n" + "="*60)
        print("✅ RECOVERY COMPLETE!")
        print("="*60)
        
        print("\n🔐 LOGIN CREDENTIALS:")
        print("-" * 60)
        print("Admin:")
        print("  Username: admin")
        print("  Password: admin123")
        print("\nSupervisor:")
        print("  Username: supervisor1")
        print("  Password: super123")
        print("\nWorkers:")
        print("  Username: worker1, worker2, worker3")
        print("  Password: worker123 (for all)")
        print("-" * 60)
        
        cur.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    print("🚨 EMERGENCY USER RECOVERY")
    print("="*60)
    print("This will restore users WITHOUT deleting your cars/scans data")
    print("="*60)
    print()
    
    input("Press ENTER to continue...")
    print()
    
    if recover_users():
        print("\n✅ SUCCESS! You can now login to your system!")
        print("\n📝 Next steps:")
        print("1. Start your Flask server: python app.py")
        print("2. Login with: admin / admin123")
        print("3. Add your real users back through the UI")
    else:
        print("\n❌ Recovery failed. Please check the error messages above.")
import psycopg
from psycopg import sql
import bcrypt

# Database configuration
DB_NAME = 'parking_system'
DB_USER = 'postgres'
DB_PASSWORD = 'postgres'
DB_HOST = 'localhost'

def check_and_fix_database():
    """Check database and fix all issues"""
    try:
        conn = psycopg.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST
        )
        cur = conn.cursor()
        
        print("=" * 60)
        print("🔍 CHECKING DATABASE...")
        print("=" * 60)
        
        # CHECK 1: Does users table exist?
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            )
        """)
        users_exists = cur.fetchone()[0]
        
        if not users_exists:
            print("❌ Users table is MISSING!")
            print("🔧 Creating users table...")
            
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
                    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    phone VARCHAR(20),
                    email VARCHAR(100),
                    profile_image VARCHAR(500),
                    date_joined DATE DEFAULT CURRENT_DATE,
                    bio TEXT,
                    total_scans INTEGER DEFAULT 0,
                    last_scan_date DATE
                )
            ''')
            print("✅ Users table created!")
            conn.commit()
        else:
            print("✅ Users table exists")
        
        # CHECK 2: Does admin user exist?
        cur.execute("SELECT COUNT(*) FROM users WHERE username = 'admin'")
        admin_count = cur.fetchone()[0]
        
        if admin_count == 0:
            print("❌ Admin user is MISSING!")
            print("🔧 Creating admin user...")
            
            # Create admin user
            password_hash = bcrypt.hashpw('admin123'.encode(), bcrypt.gensalt()).decode()
            cur.execute('''
                INSERT INTO users (username, password_hash, role, full_name, is_active)
                VALUES ('admin', %s, 'admin', 'System Administrator', TRUE)
            ''', (password_hash,))
            print("✅ Admin user created!")
            print("   Username: admin")
            print("   Password: admin123")
            conn.commit()
        else:
            print("✅ Admin user exists")
        
        # CHECK 3: Does cars table exist?
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'cars'
            )
        """)
        cars_exists = cur.fetchone()[0]
        
        if not cars_exists:
            print("❌ Cars table is MISSING!")
            print("🔧 Creating cars table...")
            
            cur.execute('''
                CREATE TABLE cars (
                    car_id SERIAL PRIMARY KEY,
                    car_identifier VARCHAR(100) UNIQUE NOT NULL,
                    first_scan_time TIMESTAMP NOT NULL,
                    last_scan_time TIMESTAMP NOT NULL,
                    scan_count INTEGER DEFAULT 1,
                    status VARCHAR(20) NOT NULL CHECK (status IN ('green', 'amber', 'red')),
                    date DATE NOT NULL,
                    is_active BOOLEAN DEFAULT TRUE,
                    vessel_id INTEGER,
                    holding_area_id INTEGER,
                    stack_number VARCHAR(50),
                    is_in_holding BOOLEAN DEFAULT FALSE
                )
            ''')
            print("✅ Cars table created!")
            conn.commit()
        else:
            print("✅ Cars table exists")
            
            # CHECK 3A: Fix cars table status constraint
            print("🔧 Fixing cars table status constraint...")
            try:
                cur.execute('ALTER TABLE cars DROP CONSTRAINT IF EXISTS cars_status_check')
                cur.execute('''
                    ALTER TABLE cars 
                    ADD CONSTRAINT cars_status_check 
                    CHECK (status IN ('green', 'amber', 'red'))
                ''')
                print("✅ Status constraint fixed!")
                conn.commit()
            except Exception as e:
                print(f"⚠️  Status constraint: {e}")
            
            # CHECK 3B: Add holding area columns if missing
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'cars' 
                AND column_name IN ('vessel_id', 'holding_area_id', 'stack_number', 'is_in_holding')
            """)
            existing_cols = [row[0] for row in cur.fetchall()]
            
            if len(existing_cols) < 4:
                print("🔧 Adding holding area columns to cars table...")
                if 'vessel_id' not in existing_cols:
                    cur.execute('ALTER TABLE cars ADD COLUMN vessel_id INTEGER')
                if 'holding_area_id' not in existing_cols:
                    cur.execute('ALTER TABLE cars ADD COLUMN holding_area_id INTEGER')
                if 'stack_number' not in existing_cols:
                    cur.execute('ALTER TABLE cars ADD COLUMN stack_number VARCHAR(50)')
                if 'is_in_holding' not in existing_cols:
                    cur.execute('ALTER TABLE cars ADD COLUMN is_in_holding BOOLEAN DEFAULT FALSE')
                print("✅ Holding area columns added!")
                conn.commit()
        
        # CHECK 4: Does scans table exist?
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'scans'
            )
        """)
        scans_exists = cur.fetchone()[0]
        
        if not scans_exists:
            print("❌ Scans table is MISSING!")
            print("🔧 Creating scans table...")
            
            cur.execute('''
                CREATE TABLE scans (
                    scan_id SERIAL PRIMARY KEY,
                    car_id INTEGER REFERENCES cars(car_id) ON DELETE CASCADE,
                    worker_id INTEGER REFERENCES users(user_id),
                    scan_time TIMESTAMP NOT NULL,
                    shift_number INTEGER NOT NULL CHECK (shift_number BETWEEN 1 AND 2),
                    date DATE NOT NULL
                )
            ''')
            print("✅ Scans table created!")
            conn.commit()
        else:
            print("✅ Scans table exists")
        
        # CHECK 5: Create holding_areas table if missing
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'holding_areas'
            )
        """)
        holding_exists = cur.fetchone()[0]
        
        if not holding_exists:
            print("🔧 Creating holding_areas table...")
            cur.execute('''
                CREATE TABLE holding_areas (
                    holding_area_id SERIAL PRIMARY KEY,
                    area_name VARCHAR(100) NOT NULL,
                    area_code VARCHAR(20),
                    capacity INTEGER,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Insert default holding areas
            cur.execute('''
                INSERT INTO holding_areas (area_name, area_code) VALUES
                ('Holding Area A', 'HA-A'),
                ('Holding Area B', 'HA-B'),
                ('Holding Area C', 'HA-C')
            ''')
            print("✅ Holding areas table created with default areas!")
            conn.commit()
        
        # CHECK 6: Create vessels table if missing
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'vessels'
            )
        """)
        vessels_exists = cur.fetchone()[0]
        
        if not vessels_exists:
            print("🔧 Creating vessels table...")
            cur.execute('''
                CREATE TABLE vessels (
                    vessel_id SERIAL PRIMARY KEY,
                    vessel_name VARCHAR(200) NOT NULL,
                    vessel_type VARCHAR(50) DEFAULT 'ship',
                    arrival_date DATE,
                    departure_date DATE,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            print("✅ Vessels table created!")
            conn.commit()
        
        # CHECK 7: Create indexes if missing
        print("🔧 Creating indexes...")
        try:
            cur.execute('CREATE INDEX IF NOT EXISTS idx_cars_identifier ON cars(car_identifier)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_cars_status ON cars(status)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_cars_date ON cars(date)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_scans_car_id ON scans(car_id)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_scans_worker_id ON scans(worker_id)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_scans_date ON scans(date)')
            cur.execute('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)')
            print("✅ Indexes created!")
            conn.commit()
        except Exception as e:
            print(f"⚠️  Indexes: {e}")
        
        print("=" * 60)
        print("✅ DATABASE CHECK COMPLETE!")
        print("=" * 60)
        
        # Show summary
        cur.execute("SELECT COUNT(*) FROM users")
        user_count = cur.fetchone()[0]
        print(f"👥 Total users: {user_count}")
        
        cur.execute("SELECT COUNT(*) FROM cars WHERE date = CURRENT_DATE")
        car_count = cur.fetchone()[0]
        print(f"🚗 Cars today: {car_count}")
        
        print("\n🔐 LOGIN CREDENTIALS:")
        print("   URL: http://localhost:5000")
        print("   Username: admin")
        print("   Password: admin123")
        print("=" * 60)
        
        cur.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    print("\n🚀 M SCANNER DATABASE FIX TOOL")
    print("=" * 60)
    
    if check_and_fix_database():
        print("\n✅ ALL FIXES COMPLETED SUCCESSFULLY!")
        print("\nNext steps:")
        print("1. Start your Flask app: python app.py")
        print("2. Go to: http://localhost:5000")
        print("3. Login with: admin / admin123")
    else:
        print("\n❌ FIXES FAILED!")
        print("Please check the error messages above.")
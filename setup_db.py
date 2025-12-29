import psycopg
from psycopg import sql

# Database configuration
DB_NAME = 'parking_system'
DB_USER = 'postgres'
DB_PASSWORD = 'postgres'  # Change this to your PostgreSQL password
DB_HOST = 'localhost'

def create_database():
    """Create the database if it doesn't exist"""
    try:
        # Connect to PostgreSQL server
        conn = psycopg.connect(
            dbname='postgres',
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            autocommit=True
        )
        cur = conn.cursor()
        
        # Check if database exists
        cur.execute(f"SELECT 1 FROM pg_database WHERE datname = '{DB_NAME}'")
        exists = cur.fetchone()
        
        if not exists:
            cur.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(DB_NAME)))
            print(f"✅ Database '{DB_NAME}' created successfully")
        else:
            print(f"ℹ️  Database '{DB_NAME}' already exists")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Error creating database: {e}")
        return False
    return True

def create_tables():
    """Create all tables"""
    try:
        conn = psycopg.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST
        )
        cur = conn.cursor()
        
        # Drop existing tables
        cur.execute('DROP TABLE IF EXISTS scans CASCADE')
        cur.execute('DROP TABLE IF EXISTS cars CASCADE')
        cur.execute('DROP TABLE IF EXISTS users CASCADE')
        
        # Create users table
        cur.execute('''
            CREATE TABLE users (
                user_id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'supervisor', 'worker')),
                full_name VARCHAR(100) NOT NULL,
                assigned_shift INTEGER CHECK (assigned_shift BETWEEN 1 AND 4),
                supervisor_id INTEGER REFERENCES users(user_id),
                is_active BOOLEAN DEFAULT TRUE,
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create cars table
        cur.execute('''
            CREATE TABLE cars (
                car_id SERIAL PRIMARY KEY,
                car_identifier VARCHAR(100) UNIQUE NOT NULL,
                first_scan_time TIMESTAMP NOT NULL,
                last_scan_time TIMESTAMP NOT NULL,
                scan_count INTEGER DEFAULT 1,
                status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'normal', 'warning', 'overdue')),
                date DATE NOT NULL,
                is_active BOOLEAN DEFAULT TRUE
            )
        ''')
        
        # Create scans table
        cur.execute('''
            CREATE TABLE scans (
                scan_id SERIAL PRIMARY KEY,
                car_id INTEGER REFERENCES cars(car_id) ON DELETE CASCADE,
                worker_id INTEGER REFERENCES users(user_id),
                scan_time TIMESTAMP NOT NULL,
                shift_number INTEGER NOT NULL CHECK (shift_number BETWEEN 1 AND 4),
                date DATE NOT NULL
            )
        ''')
        
        # Create indexes
        cur.execute('CREATE INDEX idx_cars_identifier ON cars(car_identifier)')
        cur.execute('CREATE INDEX idx_cars_status ON cars(status)')
        cur.execute('CREATE INDEX idx_cars_date ON cars(date)')
        cur.execute('CREATE INDEX idx_scans_car_id ON scans(car_id)')
        cur.execute('CREATE INDEX idx_scans_worker_id ON scans(worker_id)')
        cur.execute('CREATE INDEX idx_scans_date ON scans(date)')
        cur.execute('CREATE INDEX idx_users_role ON users(role)')
        
        # Insert default admin user (password: admin123)
        import bcrypt
        password_hash = bcrypt.hashpw('admin123'.encode(), bcrypt.gensalt()).decode()
        
        cur.execute('''
            INSERT INTO users (username, password_hash, role, full_name, is_active)
            VALUES ('admin', %s, 'admin', 'System Administrator', TRUE)
        ''', (password_hash,))
        
        conn.commit()
        print("✅ All tables created successfully")
        print("✅ Default admin user created")
        print("   Username: admin")
        print("   Password: admin123")
        
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False

if __name__ == '__main__':
    print("🚀 Initializing Parking Management System Database...")
    print("=" * 60)
    
    if create_database():
        if create_tables():
            print("=" * 60)
            print("✅ Database setup completed successfully!")
            print("\n📝 Next steps:")
            print("1. Update DB_PASSWORD in app.py and setup_db.py if needed")
            print("2. Run: python app.py")
            print("3. Open: http://localhost:5000")
            print("4. Login with: admin / admin123")
        else:
            print("❌ Failed to create tables")
    else:
        print("❌ Failed to create database")
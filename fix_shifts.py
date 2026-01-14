#!/usr/bin/env python3
"""
Fix Shift Constraint - Allow Shift 5 (10PM-2AM)
Interactive version - asks for your password
"""

import psycopg2
import getpass

def fix_shift_constraint():
    """Update shift constraint to allow 1-5 instead of 1-4"""
    
    print("\n" + "="*60)
    print("🔧 FIX SHIFT CONSTRAINT")
    print("="*60 + "\n")
    
    # Ask for password
    print("Database connection info:")
    print("  Database: parking_system")
    print("  User: postgres")
    db_password = getpass.getpass("  Password: ")
    
    DB_CONFIG = {
        'dbname': 'parking_system',
        'user': 'postgres',
        'password': db_password,
        'host': 'localhost',
        'port': 5432
    }
    
    try:
        print("\n🔌 Connecting to database...")
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        print("✅ Connected!\n")
        
        # Drop old constraint
        print("1. Dropping old constraint (allows 1-4)...")
        cur.execute("""
            ALTER TABLE users 
            DROP CONSTRAINT IF EXISTS users_assigned_shift_check
        """)
        print("   ✅ Old constraint removed")
        
        # Add new constraint
        print("\n2. Adding new constraint (allows 1-5)...")
        cur.execute("""
            ALTER TABLE users 
            ADD CONSTRAINT users_assigned_shift_check 
            CHECK (assigned_shift BETWEEN 1 AND 5)
        """)
        print("   ✅ New constraint added")
        
        conn.commit()
        
        print("\n" + "="*60)
        print("✅ SUCCESS! Shift 5 is now allowed!")
        print("="*60)
        print("\nYou can now create workers with:")
        print("  • Shift 1 (6AM-10AM)")
        print("  • Shift 2 (10AM-2PM)")
        print("  • Shift 3 (2PM-6PM)")
        print("  • Shift 4 (6PM-10PM)")
        print("  • Shift 5 (10PM-2AM)  ← NOW ALLOWED!")
        print("="*60 + "\n")
        
        cur.close()
        conn.close()
        
    except psycopg2.OperationalError as e:
        print(f"\n❌ Connection Error: {e}")
        print("\n💡 Tips:")
        print("  1. Make sure PostgreSQL is running")
        print("  2. Check your password is correct")
        print("  3. Database name should be: parking_system")
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == '__main__':
    fix_shift_constraint()
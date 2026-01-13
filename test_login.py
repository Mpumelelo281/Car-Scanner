#!/usr/bin/env python3
"""
Test script to verify login works for non-admin users
"""

import psycopg
import bcrypt

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'dbname': 'parking_system',
    'user': 'postgres',
    'password': 'postgres'
}

def test_password_hash():
    """Test if bcrypt verification works correctly"""
    print("\n" + "="*60)
    print("🔐 Testing Password Hash Verification")
    print("="*60)
    
    # Simulate the password hashing that happens during user creation
    test_password = 'temp123'
    password_hash = bcrypt.hashpw(test_password.encode(), bcrypt.gensalt()).decode()
    
    print(f"\n✓ Created hash: {password_hash[:20]}...")
    print(f"  Hash type: {type(password_hash)}")
    
    # Simulate what happens in the database
    # The hash is stored as a string in the DB
    stored_hash = password_hash
    
    # Simulate retrieval from database and verification
    # Convert password_hash to bytes if it's a string
    password_hash_bytes = stored_hash
    if isinstance(password_hash_bytes, str):
        password_hash_bytes = password_hash_bytes.encode('utf-8')
    
    print(f"\n✓ Retrieved hash type: {type(password_hash_bytes)}")
    
    # Verify the password
    is_valid = bcrypt.checkpw(test_password.encode(), password_hash_bytes)
    print(f"\n✓ Password verification result: {is_valid}")
    
    if is_valid:
        print("  ✅ PASSWORD VERIFICATION WORKS!")
    else:
        print("  ❌ PASSWORD VERIFICATION FAILED!")
    
    return is_valid

def test_admin_user():
    """Test if admin user can log in"""
    print("\n" + "="*60)
    print("👤 Testing Admin User Login")
    print("="*60)
    
    try:
        conn = psycopg.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Check if admin user exists
        cur.execute('SELECT * FROM users WHERE username = %s', ('admin',))
        admin = cur.fetchone()
        conn.close()
        
        if not admin:
            print("\n❌ Admin user not found!")
            return False
        
        print(f"\n✓ Admin user found: {admin}")
        
        # Test password verification
        test_password = 'admin123'
        password_hash_bytes = admin[2]  # password_hash is the 3rd column
        
        if isinstance(password_hash_bytes, str):
            password_hash_bytes = password_hash_bytes.encode('utf-8')
        
        is_valid = bcrypt.checkpw(test_password.encode(), password_hash_bytes)
        
        if is_valid:
            print(f"✅ Admin login works! (admin / admin123)")
        else:
            print(f"❌ Admin password verification failed!")
        
        return is_valid
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_non_admin_user():
    """Test if a non-admin user can log in"""
    print("\n" + "="*60)
    print("👥 Testing Non-Admin User Login")
    print("="*60)
    
    try:
        conn = psycopg.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Find any non-admin user
        cur.execute('SELECT * FROM users WHERE role != %s LIMIT 1', ('admin',))
        user = cur.fetchone()
        conn.close()
        
        if not user:
            print("\n⚠️  No non-admin user found in database")
            print("   Create a test user first using the admin panel")
            return None
        
        print(f"\n✓ Non-admin user found: {user[1]} (role: {user[3]})")
        
        # Test password verification with the temp password used during creation
        test_password = 'temp123'
        password_hash_bytes = user[2]  # password_hash is the 3rd column
        
        if isinstance(password_hash_bytes, str):
            password_hash_bytes = password_hash_bytes.encode('utf-8')
        
        is_valid = bcrypt.checkpw(test_password.encode(), password_hash_bytes)
        
        if is_valid:
            print(f"✅ Non-admin user login works! ({user[1]} / temp123)")
        else:
            print(f"❌ Non-admin password verification failed!")
        
        return is_valid
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

if __name__ == '__main__':
    print("\n🧪 Running Login Fix Tests...")
    
    # Test basic bcrypt functionality
    test_password_hash()
    
    # Test admin user
    test_admin_user()
    
    # Test non-admin user
    test_non_admin_user()
    
    print("\n" + "="*60)
    print("✅ Tests completed!")
    print("="*60)

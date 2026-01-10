"""
Add Profile Fields to Users Table
Adds: phone, email, profile_image, date_joined, total_scans, status
"""

import psycopg
from datetime import datetime

conn = psycopg.connect(
    host='localhost',
    dbname='parking_system',
    user='postgres',
    password='postgres'
)

cur = conn.cursor()

print("\n" + "="*80)
print("📝 ADDING PROFILE FIELDS TO USERS TABLE")
print("="*80)

# Add new columns
columns_to_add = [
    ("phone", "VARCHAR(20)"),
    ("email", "VARCHAR(100)"),
    ("profile_image", "TEXT"),  # Will store URL or base64
    ("date_joined", "DATE DEFAULT CURRENT_DATE"),
    ("total_scans", "INTEGER DEFAULT 0"),
    ("last_scan_date", "DATE"),
    ("bio", "TEXT"),
]

for col_name, col_type in columns_to_add:
    try:
        cur.execute(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
        print(f"  ✅ Added column: {col_name}")
    except Exception as e:
        print(f"  ⚠️  {col_name} might already exist: {e}")

conn.commit()

# Update existing users with default profile data
print("\n📋 Updating existing users with default data...")

# Sample profile images (using UI Avatars service)
default_profiles = {
    'admin': {
        'phone': '+27 11 123 4567',
        'email': 'admin@mscanner.co.za',
        'profile_image': 'https://ui-avatars.com/api/?name=Admin+User&size=200&background=6366f1&color=fff&bold=true',
        'bio': 'System Administrator with full access to all features and settings.'
    },
    'mpumelelo': {
        'phone': '+27 82 456 7890',
        'email': 'mpumelelo.lelo@mscanner.co.za',
        'profile_image': 'https://ui-avatars.com/api/?name=Mpumelelo+Lelo&size=200&background=8b5cf6&color=fff&bold=true',
        'bio': 'Parking Supervisor overseeing all shifts and coordinating the team.'
    },
    'worker1': {
        'phone': '+27 83 111 2222',
        'email': 'worker1@mscanner.co.za',
        'profile_image': 'https://ui-avatars.com/api/?name=Worker+One&size=200&background=10b981&color=fff&bold=true',
        'bio': 'Shift 1 Worker (6AM-10AM) - Responsible for morning patrol and vehicle scanning.'
    },
    'worker2': {
        'phone': '+27 83 222 3333',
        'email': 'worker2@mscanner.co.za',
        'profile_image': 'https://ui-avatars.com/api/?name=Worker+Two&size=200&background=3b82f6&color=fff&bold=true',
        'bio': 'Shift 2 Worker (10AM-2PM) - Handles midday operations and vehicle monitoring.'
    },
    'worker3': {
        'phone': '+27 83 333 4444',
        'email': 'worker3@mscanner.co.za',
        'profile_image': 'https://ui-avatars.com/api/?name=Worker+Three&size=200&background=f59e0b&color=fff&bold=true',
        'bio': 'Shift 3 Worker (2PM-6PM) - Manages afternoon shift vehicle tracking.'
    },
    'worker4': {
        'phone': '+27 83 444 5555',
        'email': 'worker4@mscanner.co.za',
        'profile_image': 'https://ui-avatars.com/api/?name=Worker+Four&size=200&background=ef4444&color=fff&bold=true',
        'bio': 'Shift 4 Worker (6PM-10PM) - Oversees evening operations and security.'
    }
}

for username, profile_data in default_profiles.items():
    try:
        cur.execute("""
            UPDATE users 
            SET phone = %s, email = %s, profile_image = %s, bio = %s, date_joined = CURRENT_DATE
            WHERE username = %s
        """, (profile_data['phone'], profile_data['email'], profile_data['profile_image'], 
              profile_data['bio'], username))
        print(f"  ✅ Updated profile for: {username}")
    except Exception as e:
        print(f"  ⚠️  Error updating {username}: {e}")

conn.commit()

# Update total_scans for workers
print("\n📊 Calculating total scans for workers...")
cur.execute("""
    UPDATE users u
    SET total_scans = (
        SELECT COUNT(*) 
        FROM scans s 
        WHERE s.worker_id = u.user_id
    )
    WHERE role = 'worker'
""")
conn.commit()

print("\n✅ Profile fields added successfully!")
print("="*80)
print("\nNow you can:")
print("  1. View worker profiles with images")
print("  2. See contact information")
print("  3. Track performance statistics")
print("  4. Click on worker names to see full profile")
print("\n")

conn.close()
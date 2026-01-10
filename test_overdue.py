"""
Test Overdue Detection - Create Cars with Old Timestamps
This creates cars that appear to have been parked 15+ hours ago
"""

import psycopg
from psycopg.rows import dict_row
from datetime import datetime, timedelta

conn = psycopg.connect(
    host='localhost',
    dbname='parking_system',
    user='postgres',
    password='postgres',
    row_factory=dict_row
)

cur = conn.cursor()
now = datetime.now()
today = now.date()

print("\n" + "="*80)
print("🧪 TESTING OVERDUE DETECTION")
print("="*80)

# Get a worker
cur.execute("SELECT user_id, assigned_shift FROM users WHERE role = 'worker' LIMIT 1")
worker = cur.fetchone()

if not worker:
    print("\n❌ No worker found! Create workers first.")
    conn.close()
    exit()

print(f"\n✅ Using worker ID: {worker['user_id']}")

# Test scenarios
test_cars = [
    {
        'plate': 'TEST-15H',
        'hours_ago': 15,
        'expected': 'OVERDUE (15 hours)',
        'icon': '🚨'
    },
    {
        'plate': 'TEST-20H',
        'hours_ago': 20,
        'expected': 'OVERDUE (20 hours)',
        'icon': '🚨'
    },
    {
        'plate': 'TEST-6H',
        'hours_ago': 6,
        'expected': 'WARNING (6 hours)',
        'icon': '⚠️'
    },
    {
        'plate': 'TEST-2H',
        'hours_ago': 2,
        'expected': 'ACTIVE (2 hours)',
        'icon': '✅'
    }
]

print("\n📋 Creating test cars with backdated timestamps:\n")

for test in test_cars:
    plate = test['plate']
    hours_ago = test['hours_ago']
    
    # Calculate backdated time
    first_scan = now - timedelta(hours=hours_ago)
    last_scan = first_scan + timedelta(minutes=5)  # Scanned 5 min after first
    
    # Calculate status
    if hours_ago >= 12:
        status = 'overdue'
    elif hours_ago >= 4:
        status = 'warning'
    else:
        status = 'active'
    
    # Delete if exists
    cur.execute("DELETE FROM cars WHERE car_identifier = %s", (plate,))
    
    # Insert backdated car
    try:
        cur.execute('''
            INSERT INTO cars (car_identifier, first_scan_time, last_scan_time, 
                            scan_count, status, date, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, TRUE)
            RETURNING car_id
        ''', (plate, first_scan, last_scan, 1, status, today))
        
        car_id = cur.fetchone()['car_id']
        
        # Insert scan record
        cur.execute('''
            INSERT INTO scans (car_id, worker_id, scan_time, shift_number, date)
            VALUES (%s, %s, %s, %s, %s)
        ''', (car_id, worker['user_id'], first_scan, worker['assigned_shift'], today))
        
        conn.commit()
        
        # Calculate actual hours for display
        hours_passed = (now - first_scan).total_seconds() / 3600
        
        print(f"{test['icon']} {plate:15} | {hours_passed:.1f}h ago | Status: {status.upper():8} | {test['expected']}")
        
    except Exception as e:
        print(f"❌ Error creating {plate}: {e}")
        conn.rollback()

print("\n" + "="*80)
print("✅ TEST CARS CREATED!")
print("="*80)

print("\n📊 Verification Query:")
print("-"*80)

cur.execute("""
    SELECT 
        car_identifier,
        first_scan_time,
        ROUND(EXTRACT(EPOCH FROM (NOW() - first_scan_time))/3600, 1) as hours_parked,
        status,
        scan_count
    FROM cars 
    WHERE car_identifier LIKE 'TEST-%'
    ORDER BY first_scan_time
""")

results = cur.fetchall()

for row in results:
    hours = row['hours_parked']
    status_icon = '🚨' if hours >= 12 else '⚠️' if hours >= 4 else '✅'
    print(f"{status_icon} {row['car_identifier']:15} | {hours:6.1f}h | {row['status'].upper():8} | Scans: {row['scan_count']}")

print("\n" + "="*80)
print("🎯 WHAT TO DO NOW:")
print("="*80)
print("""
1. Restart your app: python app.py
2. Refresh browser: Ctrl + Shift + R
3. Login as admin or supervisor
4. You should see:
   - TEST-15H showing 15+ hours (RED 🚨 OVERDUE with flag)
   - TEST-20H showing 20+ hours (RED 🚨 OVERDUE with flag)
   - TEST-6H showing 6+ hours (ORANGE ⚠️ WARNING)
   - TEST-2H showing 2+ hours (GREEN ✅ ACTIVE)

5. The "Overdue By" column will show exact times like:
   - 🚨 15h 23m
   - 🚨 20h 45m
   - ⚠️ 6h 12m

6. Export to Excel - the red rows will have the 🚨 flag!

7. Wait 1 hour and refresh - the hours will increment automatically!

NOTE: The hours will keep incrementing as time passes because
we're calculating from first_scan_time to NOW.
""")

conn.close()
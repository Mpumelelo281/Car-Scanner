#!/usr/bin/env python3
"""
Test script to verify shift assignment for users
"""

import psycopg
import requests
import json

DB_CONFIG = {
    'host': 'localhost',
    'dbname': 'parking_system',
    'user': 'postgres',
    'password': 'postgres'
}

API_URL = "http://localhost:5000/api"

def test_shift_assignment():
    """Test creating users with different shifts"""
    
    print("\n" + "="*70)
    print("🧪 Testing Shift Assignment for Users")
    print("="*70)
    
    # First login as admin
    print("\n1️⃣  Logging in as admin...")
    try:
        response = requests.post(
            f"{API_URL}/login",
            json={"username": "admin", "password": "admin123"},
            timeout=5
        )
        
        if response.status_code != 200:
            print(f"❌ Admin login failed: {response.text}")
            return False
        
        admin_data = response.json()
        token = admin_data['token']
        print(f"✅ Admin logged in successfully")
        print(f"   Token: {token[:20]}...")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    # Create test users with shifts
    test_users = [
        {
            'username': 'shift1worker',
            'full_name': 'Shift 1 Worker',
            'password': 'shift1pass',
            'role': 'worker',
            'assigned_shift': 1,
            'supervisor_id': None
        },
        {
            'username': 'shift2supervisor',
            'full_name': 'Shift 2 Supervisor',
            'password': 'shift2pass',
            'role': 'supervisor',
            'assigned_shift': 2,
            'supervisor_id': None
        },
        {
            'username': 'shift5worker',
            'full_name': 'Shift 5 Worker (Night)',
            'password': 'shift5pass',
            'role': 'worker',
            'assigned_shift': 5,
            'supervisor_id': None
        }
    ]
    
    print("\n2️⃣  Creating users with shift assignments...")
    print("-" * 70)
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    }
    
    for user_data in test_users:
        try:
            response = requests.post(
                f"{API_URL}/users",
                json=user_data,
                headers=headers,
                timeout=5
            )
            
            if response.status_code == 201:
                result = response.json()
                print(f"\n✅ Created user: {user_data['username']}")
                print(f"   Role: {user_data['role']}")
                print(f"   Shift: {user_data['assigned_shift'] if user_data['assigned_shift'] else 'None'}")
                print(f"   User ID: {result['user_id']}")
            else:
                print(f"\n❌ Failed to create {user_data['username']}: {response.text}")
        except Exception as e:
            print(f"\n❌ Error creating {user_data['username']}: {e}")
    
    # Verify shifts in database
    print("\n3️⃣  Verifying shifts in database...")
    print("-" * 70)
    
    try:
        conn = psycopg.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Get all users with shifts
        cur.execute('''
            SELECT user_id, username, role, assigned_shift, full_name
            FROM users
            WHERE username IN ('shift1worker', 'shift2supervisor', 'shift5worker')
            ORDER BY assigned_shift
        ''')
        
        results = cur.fetchall()
        
        if results:
            print(f"\n{'ID':<5} {'Username':<20} {'Role':<12} {'Shift':<8} {'Full Name':<25}")
            print("-" * 70)
            for user_id, username, role, shift, full_name in results:
                shift_display = f"Shift {shift}" if shift else "None"
                print(f"{user_id:<5} {username:<20} {role:<12} {shift_display:<8} {full_name:<25}")
        else:
            print("⚠️  No test users found in database")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Database error: {e}")
        return False
    
    # Test login with one of the shifted users
    print("\n4️⃣  Testing login with shifted user...")
    print("-" * 70)
    
    try:
        response = requests.post(
            f"{API_URL}/login",
            json={"username": "shift1worker", "password": "shift1pass"},
            timeout=5
        )
        
        if response.status_code == 200:
            user_data = response.json()['user']
            print(f"\n✅ Login successful for shift1worker")
            print(f"   User ID: {user_data['user_id']}")
            print(f"   Assigned Shift: {user_data['assigned_shift']}")
            print(f"   Role: {user_data['role']}")
        else:
            print(f"\n❌ Login failed: {response.text}")
    except Exception as e:
        print(f"\n❌ Error: {e}")
    
    print("\n" + "="*70)
    print("✅ Shift assignment test completed!")
    print("="*70)

if __name__ == '__main__':
    test_shift_assignment()

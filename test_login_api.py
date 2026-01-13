#!/usr/bin/env python3
"""
Test the login endpoint directly
"""

import requests
import json

API_URL = "http://localhost:5000/api"

def test_login():
    """Test login endpoint with admin credentials"""
    
    print("\n" + "="*60)
    print("🧪 Testing Login Endpoint")
    print("="*60)
    
    # Test 1: Admin login
    print("\n1️⃣  Testing Admin Login (admin / admin123)...")
    try:
        response = requests.post(
            f"{API_URL}/login",
            json={"username": "admin", "password": "admin123"},
            timeout=5
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            print("   ✅ Admin login successful!")
            return True
        else:
            print(f"   ❌ Admin login failed!")
    except requests.exceptions.ConnectionError:
        print("   ❌ Connection error - Flask app not running!")
        return False
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False
    
    # Test 2: Worker login
    print("\n2️⃣  Testing Worker Login (worker1 / temp123)...")
    try:
        response = requests.post(
            f"{API_URL}/login",
            json={"username": "worker1", "password": "temp123"},
            timeout=5
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            print("   ✅ Worker login successful!")
        else:
            print(f"   ❌ Worker login failed!")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test 3: Invalid login
    print("\n3️⃣  Testing Invalid Login (admin / wrongpass)...")
    try:
        response = requests.post(
            f"{API_URL}/login",
            json={"username": "admin", "password": "wrongpass"},
            timeout=5
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 401:
            print("   ✅ Correctly rejected invalid credentials!")
        else:
            print(f"   ⚠️  Unexpected response!")
    except Exception as e:
        print(f"   ❌ Error: {e}")

if __name__ == '__main__':
    test_login()
    print("\n" + "="*60)
    print("✅ Test completed!")
    print("="*60)

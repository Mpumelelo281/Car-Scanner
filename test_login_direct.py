#!/usr/bin/env python3
"""
Test the login endpoint directly
"""

from app import app
import json

def test_login():
    """Test login endpoint"""
    with app.test_client() as client:
        print("\n" + "="*60)
        print("Testing Login Endpoint")
        print("="*60)
        
        # Test 1: Admin login
        print("\n1️⃣  Testing Admin Login...")
        response = client.post(
            '/api/login',
            data=json.dumps({'username': 'admin', 'password': 'admin123'}),
            content_type='application/json'
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.get_json()}")
        
        # Test 2: Worker login  
        print("\n2️⃣  Testing Worker Login...")
        response = client.post(
            '/api/login',
            data=json.dumps({'username': 'worker1', 'password': 'temp123'}),
            content_type='application/json'
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {response.get_json()}")

if __name__ == '__main__':
    try:
        test_login()
        print("\n✅ Tests completed!")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

#!/usr/bin/env python3
"""
Test Login - Debug login issues
"""

import requests
import json

API_URL = "http://localhost:5000/api"

def test_login(username, password):
    """Test login with given credentials"""
    
    print(f"\n{'='*60}")
    print(f"🔐 Testing Login: {username}")
    print(f"{'='*60}")
    
    try:
        response = requests.post(
            f"{API_URL}/login",
            json={'username': username, 'password': password},
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"\n📡 Response Status: {response.status_code}")
        print(f"📋 Response Headers: {dict(response.headers)}")
        
        try:
            data = response.json()
            print(f"\n✅ Response JSON:")
            print(json.dumps(data, indent=2))
            
            if response.status_code == 200:
                print(f"\n🎉 LOGIN SUCCESS!")
                print(f"   Username: {data.get('user', {}).get('username')}")
                print(f"   Role: {data.get('user', {}).get('role')}")
                print(f"   Token: {data.get('token', '')[:50]}...")
                return True
            else:
                print(f"\n❌ LOGIN FAILED: {data.get('error')}")
                return False
                
        except json.JSONDecodeError as e:
            print(f"\n❌ Invalid JSON response!")
            print(f"   Raw response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"\n❌ ERROR: Cannot connect to server!")
        print(f"   Make sure app is running: python app.py")
        return False
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return False

if __name__ == '__main__':
    print("🧪 LOGIN TESTING TOOL")
    print("="*60)
    
    # Test credentials
    tests = [
        ('admin', 'admin123'),
        ('worker1', 'temp123'),
        ('mpumelelo', 'temp123'),
        ('invalid', 'wrong'),
    ]
    
    results = []
    for username, password in tests:
        success = test_login(username, password)
        results.append((username, success))
    
    print(f"\n{'='*60}")
    print("📊 SUMMARY")
    print(f"{'='*60}")
    for username, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"  {status} | {username}")
    print(f"{'='*60}")
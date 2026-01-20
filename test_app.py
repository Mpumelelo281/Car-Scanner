from app import app

print("Starting tests...")
with app.test_client() as client:
    print('Testing health endpoint...')
    r = client.get('/health')
    print(f'Health status: {r.status_code}')
    print(f'Health response: {r.get_json()}')
    
    print('\nTesting login endpoint...')
    r = client.post('/api/login', json={'username':'admin','password':'admin123'})
    print(f'Login status: {r.status_code}')
    resp = r.get_json()
    print(f'Has token: {"token" in resp}')
    print(f'Token sample: {resp.get("token", "N/A")[:50]}...')

print("Tests completed successfully!")

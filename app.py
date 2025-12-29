from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
from datetime import datetime, timedelta
import psycopg
from psycopg.rows import dict_row
import bcrypt
import jwt
from functools import wraps
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import io

app = Flask(__name__)
CORS(app)

app.config['SECRET_KEY'] = 'parking-system-secret-key-2025'
DB_CONFIG = {
    'host': 'localhost',
    'dbname': 'parking_system',
    'user': 'postgres',
    'password': 'postgres'
}

def get_db():
    return psycopg.connect(**DB_CONFIG, row_factory=dict_row)

SHIFTS = {
    1: {'start': 6, 'end': 10, 'name': '6AM-10AM'},
    2: {'start': 10, 'end': 14, 'name': '10AM-2PM'},
    3: {'start': 14, 'end': 18, 'name': '2PM-6PM'},
    4: {'start': 18, 'end': 22, 'name': '6PM-10PM'}
}

def get_current_shift():
    hour = datetime.now().hour
    for shift_num, times in SHIFTS.items():
        if times['start'] <= hour < times['end']:
            return shift_num
    return 1

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token:
            return jsonify({'error': 'Token missing'}), 401
        try:
            token = token.split(' ')[1] if ' ' in token else token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = data
        except:
            return jsonify({'error': 'Invalid token'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

def role_required(roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(current_user, *args, **kwargs):
            if current_user['role'] not in roles:
                return jsonify({'error': 'Unauthorized'}), 403
            return f(current_user, *args, **kwargs)
        return decorated_function
    return decorator

# HTML Routes
@app.route('/')
def index():
    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')

# AUTH
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    conn = get_db()
    cur = conn.cursor()
    cur.execute('SELECT * FROM users WHERE username = %s AND is_active = TRUE', (username,))
    user = cur.fetchone()
    conn.close()
    
    if user and bcrypt.checkpw(password.encode(), user['password_hash'].encode()):
        token = jwt.encode({
            'user_id': user['user_id'],
            'username': user['username'],
            'role': user['role'],
            'full_name': user['full_name'],
            'assigned_shift': user['assigned_shift'],
            'supervisor_id': user['supervisor_id']
        }, app.config['SECRET_KEY'], algorithm='HS256')
        
        return jsonify({
            'token': token,
            'user': {
                'user_id': user['user_id'],
                'username': user['username'],
                'role': user['role'],
                'full_name': user['full_name'],
                'assigned_shift': user['assigned_shift']
            }
        })
    
    return jsonify({'error': 'Invalid credentials'}), 401

# USER MANAGEMENT
@app.route('/api/users', methods=['GET'])
@token_required
@role_required(['admin', 'supervisor'])
def get_users(current_user):
    conn = get_db()
    cur = conn.cursor()
    
    if current_user['role'] == 'supervisor':
        cur.execute('''
            SELECT user_id, username, role, full_name, assigned_shift, is_active, created_date
            FROM users WHERE supervisor_id = %s
        ''', (current_user['user_id'],))
    else:
        cur.execute('''
            SELECT u.user_id, u.username, u.role, u.full_name, u.assigned_shift, 
                   u.supervisor_id, u.is_active, u.created_date, s.full_name as supervisor_name
            FROM users u
            LEFT JOIN users s ON u.supervisor_id = s.user_id
            WHERE u.role != 'admin'
        ''')
    
    users = cur.fetchall()
    conn.close()
    return jsonify([dict(u) for u in users])

@app.route('/api/users', methods=['POST'])
@token_required
@role_required(['admin'])
def create_user(current_user):
    data = request.json
    password_hash = bcrypt.hashpw('temp123'.encode(), bcrypt.gensalt()).decode()
    
    conn = get_db()
    cur = conn.cursor()
    try:
        cur.execute('''
            INSERT INTO users (username, password_hash, role, full_name, assigned_shift, supervisor_id)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING user_id
        ''', (data['username'], password_hash, data['role'], data['full_name'], 
              data.get('assigned_shift'), data.get('supervisor_id')))
        user_id = cur.fetchone()['user_id']
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({'message': 'User created', 'user_id': user_id}), 201
    except psycopg.errors.UniqueViolation:
        conn.rollback()
        cur.close()
        conn.close()
        return jsonify({'error': 'Username already exists'}), 400
    except Exception as e:
        conn.rollback()
        cur.close()
        conn.close()
        print(f"Error creating user: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<int:user_id>', methods=['PUT'])
@token_required
@role_required(['admin'])
def update_user(current_user, user_id):
    data = request.json
    conn = get_db()
    cur = conn.cursor()
    
    fields = []
    values = []
    for field in ['full_name', 'assigned_shift', 'supervisor_id', 'is_active', 'role']:
        if field in data:
            fields.append(f"{field} = %s")
            values.append(data[field])
    
    if fields:
        values.append(user_id)
        cur.execute(f"UPDATE users SET {', '.join(fields)} WHERE user_id = %s", values)
        conn.commit()
    
    conn.close()
    return jsonify({'message': 'User updated'})

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@token_required
@role_required(['admin'])
def delete_user(current_user, user_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute('UPDATE users SET is_active = FALSE WHERE user_id = %s', (user_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'User deactivated'})

# SCANNING
@app.route('/api/scan', methods=['POST'])
@token_required
def scan_car(current_user):
    data = request.json
    car_identifier = data.get('car_identifier', '').strip().upper()
    
    if not car_identifier:
        return jsonify({'error': 'Car identifier required'}), 400
    
    conn = get_db()
    cur = conn.cursor()
    now = datetime.now()
    today = now.date()
    shift_number = get_current_shift()
    
    cur.execute('SELECT * FROM cars WHERE car_identifier = %s AND is_active = TRUE', (car_identifier,))
    car = cur.fetchone()
    
    if car:
        car_id = car['car_id']
        scan_count = car['scan_count'] + 1
        hours_parked = (now - car['first_scan_time']).total_seconds() / 3600
        
        if hours_parked >= 12:
            status = 'overdue'
        elif hours_parked >= 4:
            status = 'warning'
        else:
            status = 'active'
        
        cur.execute('''
            UPDATE cars SET last_scan_time = %s, scan_count = %s, status = %s
            WHERE car_id = %s
        ''', (now, scan_count, status, car_id))
    else:
        cur.execute('''
            INSERT INTO cars (car_identifier, first_scan_time, last_scan_time, scan_count, status, date)
            VALUES (%s, %s, %s, 1, 'active', %s) RETURNING car_id
        ''', (car_identifier, now, now, today))
        car_id = cur.fetchone()['car_id']
    
    cur.execute('''
        INSERT INTO scans (car_id, worker_id, scan_time, shift_number, date)
        VALUES (%s, %s, %s, %s, %s)
    ''', (car_id, current_user['user_id'], now, shift_number, today))
    
    conn.commit()
    
    cur.execute('''
        SELECT c.*, u.full_name as last_worker
        FROM cars c
        LEFT JOIN scans s ON c.car_id = s.car_id AND s.scan_time = c.last_scan_time
        LEFT JOIN users u ON s.worker_id = u.user_id
        WHERE c.car_id = %s
    ''', (car_id,))
    updated_car = cur.fetchone()
    conn.close()
    
    return jsonify({'message': 'Scan recorded successfully', 'car': dict(updated_car)})

# CAR DATA
@app.route('/api/cars', methods=['GET'])
@token_required
def get_cars(current_user):
    shift = request.args.get('shift', type=int)
    date_filter = request.args.get('date', datetime.now().date().isoformat())
    status_filter = request.args.get('status')
    
    conn = get_db()
    cur = conn.cursor()
    
    base_query = '''
        SELECT DISTINCT c.*, 
               (SELECT u.full_name FROM scans s 
                JOIN users u ON s.worker_id = u.user_id 
                WHERE s.car_id = c.car_id 
                ORDER BY s.scan_time DESC LIMIT 1) as last_worker
        FROM cars c
        WHERE c.date = %s AND c.is_active = TRUE
    '''
    params = [date_filter]
    
    if current_user['role'] == 'worker':
        base_query += ' AND EXISTS (SELECT 1 FROM scans s WHERE s.car_id = c.car_id AND s.shift_number = %s)'
        params.append(current_user['assigned_shift'])
    elif shift:
        base_query += ' AND EXISTS (SELECT 1 FROM scans s WHERE s.car_id = c.car_id AND s.shift_number = %s)'
        params.append(shift)
    
    if status_filter:
        base_query += ' AND c.status = %s'
        params.append(status_filter)
    
    base_query += ' ORDER BY c.last_scan_time DESC'
    
    cur.execute(base_query, params)
    cars = cur.fetchall()
    conn.close()
    return jsonify([dict(c) for c in cars])

@app.route('/api/dashboard', methods=['GET'])
@token_required
def get_dashboard(current_user):
    conn = get_db()
    cur = conn.cursor()
    today = datetime.now().date()
    
    if current_user['role'] == 'worker':
        cur.execute('''
            SELECT 
                COUNT(DISTINCT c.car_id) as total_cars,
                COUNT(DISTINCT CASE WHEN c.status = 'overdue' THEN c.car_id END) as overdue_cars,
                COUNT(DISTINCT CASE WHEN c.status = 'warning' THEN c.car_id END) as warning_cars,
                COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.car_id END) as active_cars,
                COUNT(s.scan_id) as total_scans
            FROM cars c
            JOIN scans s ON c.car_id = s.car_id
            WHERE s.shift_number = %s AND s.date = %s AND s.worker_id = %s
        ''', (current_user['assigned_shift'], today, current_user['user_id']))
    elif current_user['role'] == 'supervisor':
        cur.execute('''
            SELECT 
                COUNT(DISTINCT c.car_id) as total_cars,
                COUNT(DISTINCT CASE WHEN c.status = 'overdue' THEN c.car_id END) as overdue_cars,
                COUNT(DISTINCT CASE WHEN c.status = 'warning' THEN c.car_id END) as warning_cars,
                COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.car_id END) as active_cars,
                COUNT(s.scan_id) as total_scans
            FROM cars c
            JOIN scans s ON c.car_id = s.car_id
            JOIN users u ON s.worker_id = u.user_id
            WHERE s.date = %s AND u.supervisor_id = %s
        ''', (today, current_user['user_id']))
    else:
        cur.execute('''
            SELECT 
                COUNT(DISTINCT car_id) as total_cars,
                COUNT(DISTINCT CASE WHEN status = 'overdue' THEN car_id END) as overdue_cars,
                COUNT(DISTINCT CASE WHEN status = 'warning' THEN car_id END) as warning_cars,
                COUNT(DISTINCT CASE WHEN status = 'active' THEN car_id END) as active_cars
            FROM cars WHERE date = %s AND is_active = TRUE
        ''', (today,))
    
    stats = cur.fetchone()
    
    cur.execute('SELECT COUNT(*) as count FROM users WHERE is_active = TRUE AND role = %s', ('worker',))
    worker_stats = cur.fetchone()
    
    conn.close()
    return jsonify({**dict(stats), 'active_workers': worker_stats['count']})

# EXCEL EXPORT
@app.route('/api/export', methods=['GET'])
@token_required
def export_excel(current_user):
    shift = request.args.get('shift', type=int)
    worker_id = request.args.get('worker_id', type=int)
    date_filter = request.args.get('date', datetime.now().date().isoformat())
    
    conn = get_db()
    cur = conn.cursor()
    
    query = '''
        SELECT c.car_identifier, c.first_scan_time, c.last_scan_time, c.scan_count,
               c.status, c.date, u.full_name as worker_name, s.shift_number,
               EXTRACT(EPOCH FROM (c.last_scan_time - c.first_scan_time))/3600 as hours_parked
        FROM cars c
        JOIN scans s ON c.car_id = s.car_id
        JOIN users u ON s.worker_id = u.user_id
        WHERE c.date = %s
    '''
    params = [date_filter]
    
    if shift:
        query += ' AND s.shift_number = %s'
        params.append(shift)
    
    if worker_id:
        query += ' AND s.worker_id = %s'
        params.append(worker_id)
    
    query += ' ORDER BY c.first_scan_time'
    
    cur.execute(query, params)
    data = cur.fetchall()
    conn.close()
    
    wb = Workbook()
    ws = wb.active
    ws.title = "Parking Report"
    
    headers = ['Car ID', 'First Scan', 'Last Scan', 'Scans', 'Hours Parked', 
               'Status', 'Worker', 'Shift', 'Date']
    ws.append(headers)
    
    header_fill = PatternFill(start_color='366092', end_color='366092', fill_type='solid')
    header_font = Font(bold=True, color='FFFFFF')
    
    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center')
    
    for row in data:
        status_display = row['status'].upper()
        ws.append([
            row['car_identifier'],
            row['first_scan_time'].strftime('%Y-%m-%d %H:%M:%S'),
            row['last_scan_time'].strftime('%Y-%m-%d %H:%M:%S'),
            f"{row['scan_count']}x",
            f"{row['hours_parked']:.1f}h",
            status_display,
            row['worker_name'],
            f"Shift {row['shift_number']}",
            str(row['date'])
        ])
    
    for row_idx, row in enumerate(ws.iter_rows(min_row=2, max_row=ws.max_row), start=2):
        status = row[5].value
        if 'OVERDUE' in status:
            for cell in row:
                cell.fill = PatternFill(start_color='FF0000', end_color='FF0000', fill_type='solid')
                cell.font = Font(color='FFFFFF', bold=True)
        elif 'WARNING' in status:
            for cell in row:
                cell.fill = PatternFill(start_color='FFA500', end_color='FFA500', fill_type='solid')
    
    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            if cell.value:
                max_length = max(max_length, len(str(cell.value)))
        ws.column_dimensions[column].width = max_length + 2
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"parking_report_{date_filter}"
    if shift:
        filename += f"_shift{shift}"
    if worker_id:
        filename += f"_worker{worker_id}"
    filename += ".xlsx"
    
    return send_file(output, download_name=filename, as_attachment=True, 
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
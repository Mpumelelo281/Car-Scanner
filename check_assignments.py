#!/usr/bin/env python3
"""
Test that shifts and supervisor assignment are being saved correctly
"""

import psycopg

DB_CONFIG = {
    'host': 'localhost',
    'dbname': 'parking_system',
    'user': 'postgres',
    'password': 'postgres'
}

def check_user_assignments():
    """Check if shifts and supervisors are properly assigned"""
    
    try:
        conn = psycopg.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        print("\n" + "="*80)
        print("📋 User Shift and Supervisor Assignments")
        print("="*80)
        
        cur.execute('''
            SELECT 
                u.user_id,
                u.username,
                u.role,
                u.full_name,
                u.assigned_shift,
                COALESCE(s.full_name, 'None') as supervisor_name,
                u.is_active
            FROM users u
            LEFT JOIN users s ON u.supervisor_id = s.user_id
            WHERE u.is_active = TRUE
            ORDER BY u.role DESC, u.assigned_shift, u.username
        ''')
        
        users = cur.fetchall()
        
        print(f"\n{'ID':<4} {'Username':<20} {'Role':<12} {'Full Name':<20} {'Shift':<8} {'Supervisor':<20}")
        print("-" * 80)
        
        for user_id, username, role, full_name, assigned_shift, supervisor_name, is_active in users:
            shift_str = f"Shift {assigned_shift}" if assigned_shift else "None"
            print(f"{user_id:<4} {username:<20} {role:<12} {full_name:<20} {shift_str:<8} {supervisor_name:<20}")
        
        print("\n" + "="*80)
        print("✅ Shift and Supervisor Assignments Check Complete")
        print("="*80)
        
        # Count by role
        cur.execute('''
            SELECT role, COUNT(*) as count 
            FROM users 
            WHERE is_active = TRUE 
            GROUP BY role
        ''')
        
        print("\n📊 User Count by Role:")
        for role, count in cur.fetchall():
            print(f"   {role}: {count}")
        
        # Count workers with supervisors
        cur.execute('''
            SELECT COUNT(*) as count 
            FROM users 
            WHERE role = 'worker' AND supervisor_id IS NOT NULL AND is_active = TRUE
        ''')
        
        workers_with_supervisors = cur.fetchone()[0]
        cur.execute('''SELECT COUNT(*) FROM users WHERE role = 'worker' AND is_active = TRUE''')
        total_workers = cur.fetchone()[0]
        
        print(f"\n👥 Workers with Supervisor Assignment: {workers_with_supervisors}/{total_workers}")
        
        # Count workers with shifts
        cur.execute('''
            SELECT COUNT(*) as count 
            FROM users 
            WHERE role = 'worker' AND assigned_shift IS NOT NULL AND is_active = TRUE
        ''')
        
        workers_with_shifts = cur.fetchone()[0]
        print(f"⏰ Workers with Shift Assignment: {workers_with_shifts}/{total_workers}")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    check_user_assignments()

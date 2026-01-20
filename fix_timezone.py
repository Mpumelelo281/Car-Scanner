import psycopg

DB_CONFIG = {
    'host': 'localhost',
    'dbname': 'parking_system',
    'user': 'postgres',
    'password': 'postgres'
}

def fix_timezone_columns():
    """Convert TIMESTAMP columns to TIMESTAMP WITH TIME ZONE"""
    try:
        conn = psycopg.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        print("=" * 70)
        print("FIXING TIMEZONE COLUMNS")
        print("=" * 70)
        
        # List of tables and columns to fix
        migrations = [
            ('cars', 'first_scan_time'),
            ('cars', 'last_scan_time'),
            ('scans', 'scan_time'),
            ('holding_areas', 'created_date'),
        ]
        
        for table, column in migrations:
            print(f"\nProcessing {table}.{column}...")
            
            try:
                # Check current type
                cur.execute(f"""
                    SELECT data_type FROM information_schema.columns 
                    WHERE table_name = '{table}' AND column_name = '{column}'
                """)
                result = cur.fetchone()
                
                if result:
                    current_type = result[0]
                    print(f"  Current type: {current_type}")
                    
                    # Only convert if it's TIMESTAMP without timezone
                    if current_type == 'timestamp without time zone':
                        # Convert the column
                        cur.execute(f"""
                            ALTER TABLE {table} 
                            ALTER COLUMN {column} TYPE TIMESTAMP WITH TIME ZONE
                            USING {column} AT TIME ZONE 'Africa/Johannesburg'
                        """)
                        print(f"  ✓ Converted to TIMESTAMP WITH TIME ZONE")
                        conn.commit()
                    elif current_type == 'timestamp with time zone':
                        print(f"  ✓ Already TIMESTAMP WITH TIME ZONE - skipping")
                    else:
                        print(f"  ? Unknown type: {current_type}")
                else:
                    print(f"  ! Column not found")
                    
            except Exception as e:
                print(f"  ✗ Error: {e}")
                conn.rollback()
        
        print("\n" + "=" * 70)
        print("TIMEZONE CONVERSION COMPLETE")
        print("=" * 70)
        
        # Verify the changes
        print("\nVerifying changes:")
        cur.execute("""
            SELECT table_name, column_name, data_type
            FROM information_schema.columns 
            WHERE table_name IN ('cars', 'scans', 'holding_areas')
            AND column_name LIKE '%time%' OR column_name LIKE '%date%'
            ORDER BY table_name, column_name
        """)
        
        for row in cur.fetchall():
            table, col, dtype = row
            print(f"  {table}.{col}: {dtype}")
        
        conn.close()
        print("\n✓ All changes completed successfully!")
        
    except Exception as e:
        print(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    fix_timezone_columns()

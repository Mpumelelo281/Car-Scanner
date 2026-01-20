#!/usr/bin/env python3
"""
Test Shift Calculation
"""
from datetime import datetime

def get_current_shift_OLD():
    """OLD logic - might have issues"""
    hour = datetime.now().hour
    
    # Handle overnight shift (22:00 - 02:00)
    if hour >= 22 or hour < 2:
        return 5
    
    # Handle regular shifts
    SHIFTS = {
        1: {'start': 6, 'end': 10},
        2: {'start': 10, 'end': 14},
        3: {'start': 14, 'end': 18},
        4: {'start': 18, 'end': 22},
    }
    
    for shift_num, times in SHIFTS.items():
        start = times['start']
        end = times['end']
        if start <= hour < end:
            return shift_num
    
    return 1  # Default

def get_current_shift_NEW():
    """NEW logic - handles edge cases better"""
    hour = datetime.now().hour
    
    # Shift 5: 22:00 - 05:59 (overnight - extended to 6AM)
    if hour >= 22 or hour < 6:
        return 5
    
    # Shift 1: 6AM - 10AM
    elif 6 <= hour < 10:
        return 1
    
    # Shift 2: 10AM - 2PM
    elif 10 <= hour < 14:
        return 2
    
    # Shift 3: 2PM - 6PM
    elif 14 <= hour < 18:
        return 3
    
    # Shift 4: 6PM - 10PM
    elif 18 <= hour < 22:
        return 4
    
    else:
        return 1  # Fallback

# Test all hours
print("="*60)
print("SHIFT CALCULATION TEST")
print("="*60)
print(f"\nCurrent time: {datetime.now().strftime('%I:%M %p')} (Hour: {datetime.now().hour})")
print(f"OLD Logic: Shift {get_current_shift_OLD()}")
print(f"NEW Logic: Shift {get_current_shift_NEW()}")
print("\n" + "="*60)
print("TESTING ALL HOURS:")
print("="*60)

for hour in range(24):
    # Simulate each hour
    class FakeTime:
        def hour(self):
            return hour
    
    # Test OLD
    if hour >= 22 or hour < 2:
        old_shift = 5
    elif 6 <= hour < 10:
        old_shift = 1
    elif 10 <= hour < 14:
        old_shift = 2
    elif 14 <= hour < 18:
        old_shift = 3
    elif 18 <= hour < 22:
        old_shift = 4
    else:
        old_shift = 1
    
    # Test NEW
    if hour >= 22 or hour < 6:
        new_shift = 5
    elif 6 <= hour < 10:
        new_shift = 1
    elif 10 <= hour < 14:
        new_shift = 2
    elif 14 <= hour < 18:
        new_shift = 3
    elif 18 <= hour < 22:
        new_shift = 4
    else:
        new_shift = 1
    
    time_str = f"{hour:02d}:00"
    problem = "⚠️  ISSUE!" if old_shift != new_shift else ""
    print(f"{time_str} | OLD: Shift {old_shift} | NEW: Shift {new_shift} {problem}")

print("\n" + "="*60)
print("RECOMMENDATION:")
print("="*60)
print("The issue is hours 2-5 AM (02:00-05:59):")
print("  - OLD logic puts them in Shift 1")
print("  - NEW logic puts them in Shift 5 (overnight)")
print("\nSince you're at 02:24 AM, you should be in Shift 5!")
print("This mismatch might be causing timing issues.")
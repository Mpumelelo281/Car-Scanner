import sys

with open('static/js/app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

open_count = 0
close_count = 0

for line_num, line in enumerate(lines, 1):
    for char in line:
        if char == '{':
            open_count += 1
        elif char == '}':
            close_count += 1
            if close_count > open_count:
                print(f"ERROR: Line {line_num} has extra closing brace!")
                print(f"Content: {line.strip()}")
                print(f"Balance before: {open_count - close_count + 1}")
                sys.exit(1)

print(f"Final balance: Open={open_count}, Close={close_count}, Diff={open_count - close_count}")
if open_count - close_count == 1:
    print("There is 1 extra opening brace somewhere")
elif close_count - open_count == 1:
    print("There is 1 extra closing brace somewhere")

import os
import json
import re

def extract_functions(file_content, file_path):
    functions = []
    
    # Regular expressions for different function patterns
    patterns = [
        r'(?:function\s+(\w+)|(\w+)\s*[:=]\s*function|\b(?:async\s+)?(\w+)\s*[:=]\s*(?:async\s+)?\()\s*\((.*?)\)',
        r'(?:(\w+)\s*[:=]\s*\(.*?\)\s*=>)'
    ]
    
    for pattern in patterns:
        matches = re.finditer(pattern, file_content)
        for match in matches:
            func_name = next((g for g in match.groups() if g), None)
            if func_name:
                params = match.group(4) if len(match.groups()) > 3 else ''
                params = [p.strip() for p in params.split(',') if p.strip()]
                functions.append({
                    "name": func_name,
                    "parameters": params,
                    "line": file_content[:match.start()].count('\n') + 1
                })
    
    return functions

def process_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        return extract_functions(content, file_path)
    except Exception as e:
        print(f"Error reading file {file_path}: {e}")
        return []

def scan_directory(directory):
    catalog = {}
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith('.js'):
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, directory)
                catalog[relative_path] = process_file(file_path)
    return catalog

# Directory containing your JavaScript files
project_directory = '../'  # Adjust this path as needed

# Generate the catalog
function_catalog = scan_directory(project_directory)

# Save the catalog to a JSON file
with open('function_catalog.json', 'w', encoding='utf-8') as f:
    json.dump(function_catalog, f, indent=2)

print("Function catalog has been generated and saved to 'function_catalog.json'")

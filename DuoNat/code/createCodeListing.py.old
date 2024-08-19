import os
import json

# Configuration file to save the selected files
CONFIG_FILE = '_file_selection.json'

# Output file
OUTPUT_FILE = 'claude_code_listing.txt'

# Directories to skip
SKIP_DIRECTORIES = ['tools', 'sound', 'images', 'data/old']

# Directory to only include .js files
CODE_DIRECTORY = 'code'

# Directory for CSS files
STYLES_DIRECTORY = 'styles'

# Extensions to skip
SKIP_EXTENSIONS = {'.swp', '.old', '.png', '.mp3'}

# Files to always exclude
ALWAYS_EXCLUDE_FILES = {'package-lock.json', 'package.json', 'webpack.config.js'}

# Root directory to list files from (parent directory)
ROOT_DIRECTORY = '../'

# JSON files to include sample entries from
SAMPLE_JSON_FILES = ['data/taxonInfo.json', 'data/taxonSets.json', 'data/taxonHierarchy.json']

def save_selection(selection):
    with open(CONFIG_FILE, 'w') as f:
        json.dump(selection, f)

def load_selection():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    return []

def list_files(directory):
    file_list = []
    for root, dirs, files in os.walk(directory):
        # Skip the node_modules directory entirely
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        # Skip other directories you don't want to include
        if any(skip in root for skip in SKIP_DIRECTORIES) or root.startswith(os.path.join(directory, 'data')):
            continue
        for file in files:
            if any(file.endswith(ext) for ext in SKIP_EXTENSIONS) or file in ALWAYS_EXCLUDE_FILES:
                continue
            if os.path.relpath(root, directory).startswith(CODE_DIRECTORY) and not file.endswith('.js'):
                continue
            relative_path = os.path.relpath(os.path.join(root, file), directory)
            if relative_path.startswith('../'):
                relative_path = relative_path[3:]  # Remove '../' from the beginning
            file_list.append(relative_path)
    return file_list

def display_selection(selection, all_files):
    print("\nSelect files to include in the listing (Enter the number to toggle selection):")
    css_files = [file for file in all_files if file.startswith(STYLES_DIRECTORY)]
    non_css_files = [file for file in all_files if not file.startswith(STYLES_DIRECTORY)]
    
    status = "[x]" if all(file in selection for file in css_files) else "[ ]"
    print(f" 0. {status} {STYLES_DIRECTORY}/ (CSS files)")
    
    for i, file in enumerate(non_css_files):
        status = "[x]" if file in selection else "[ ]"
        print(f"{i + 1:2}. {status} {file}")
    print("\nPress 's' to create the listing. 'q' to quit.\n")

def append_file_contents(file, output_file):
    file_path = os.path.join(ROOT_DIRECTORY, file)
    with open(file_path, 'r') as f:
        content = f.read()
    with open(output_file, 'a') as out_f:
        out_f.write(f"\n#==> Listing for {file}:\n\n")
        out_f.write(content)
        out_f.write("\n\n")

def append_json_sample(file, output_file):
    file_path = os.path.join(ROOT_DIRECTORY, file)
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    sample_data = dict(list(data.items())[:2])
    
    with open(output_file, 'a') as out_f:
        out_f.write(f"\n#==> {file} (Sample entries)\n\n")
        out_f.write("#==> These are two sample entries of this file:\n\n")
        json.dump(sample_data, out_f, indent=2)
        out_f.write("\n\n")

def main():
    all_files = list_files(ROOT_DIRECTORY)
    css_files = [file for file in all_files if file.startswith(STYLES_DIRECTORY)]
    non_css_files = [file for file in all_files if not file.startswith(STYLES_DIRECTORY)]
    selected_files = load_selection()

    save_file = False  # Flag to control file saving

    while True:
        display_selection(selected_files, all_files)
        user_input = input("Your choice: ").strip()

        if user_input.lower() == 's':
            save_selection(selected_files)
            save_file = True  # Set flag to save file
            break
        elif user_input.lower() == 'q':
            break
        elif user_input == '0':
            if all(file in selected_files for file in css_files):
                selected_files = [file for file in selected_files if not file.startswith(STYLES_DIRECTORY)]
            else:
                selected_files.extend(file for file in css_files if file not in selected_files)
        elif user_input.isdigit():
            index = int(user_input) - 1
            if 0 <= index < len(non_css_files):
                file = non_css_files[index]
                if file in selected_files:
                    selected_files.remove(file)
                else:
                    selected_files.append(file)
        else:
            print("Invalid input. Please try again.")
    if save_file:
        # Generate the final listing
        with open(OUTPUT_FILE, 'w') as out_f:
            out_f.write("")  # Clear the output file

        with open(OUTPUT_FILE, 'a') as out_f:
            out_f.write(f"This file provides up to date listings of relevant parts of my code base. These are up-to-date versions, so everything you see in here will be exactly like this in my project. Every file is indicated with '# <file name>' at the start. Be aware that there may be other files in my code that are not included. If you need them, please tell me so during the conversation. Do not just make up stuff instead.\n\n")

        for file in selected_files:
            append_file_contents(file, OUTPUT_FILE)
            print(f"Added content from: {file}")

        # Add sample entries from specified JSON files
        for json_file in SAMPLE_JSON_FILES:
            append_json_sample(json_file, OUTPUT_FILE)
            print(f"Added sample entries from: {json_file}")

if __name__ == "__main__":
    main()

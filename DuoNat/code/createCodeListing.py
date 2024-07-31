import os
import json

# Configuration file to save the selected files
CONFIG_FILE = 'file_selection.json'

# Output file
OUTPUT_FILE = 'claude_code_listing.txt'

# Directories to skip
SKIP_DIRECTORIES = ['tools', 'sound', 'images', 'data/old']

# Directory to only include .js files
CODE_DIRECTORY = 'code'

# Directory to allow select/deselect
STYLES_DIRECTORY = 'styles'

# Extensions to skip
SKIP_EXTENSIONS = {'.swp', '.old', '.png', '.mp3'}

# Files to always exclude
ALWAYS_EXCLUDE_FILES = {'package-lock.json', 'package.json', 'webpack.config.js'}

# Root directory to list files from (parent directory)
ROOT_DIRECTORY = '../'

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
    for root, _, files in os.walk(directory):
        if any(skip in root for skip in SKIP_DIRECTORIES):
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
    directories = set(os.path.dirname(file) for file in all_files)
    if STYLES_DIRECTORY in directories:
        status = "[x]" if all(file.startswith(STYLES_DIRECTORY) for file in selection) else "[ ]"
        print(f" 0. {status} {STYLES_DIRECTORY}/")
    for i, file in enumerate(all_files):
        status = "[x]" if file in selection else "[ ]"
        print(f"{i + 1:2}. {status} {file}")
    print("\nPress 's' to create the listing.\n")

def append_file_contents(file, output_file):
    file_path = os.path.join(ROOT_DIRECTORY, file)
    with open(file_path, 'r') as f:
        content = f.read()
    with open(output_file, 'a') as out_f:
        out_f.write(f"\n# {file}\n\n")
        out_f.write(content)
        out_f.write("\n\n")

def main():
    all_files = list_files(ROOT_DIRECTORY)
    selected_files = load_selection()

    while True:
        display_selection(selected_files, all_files)
        user_input = input("Your choice: ").strip()

        if user_input.lower() == 's':
            save_selection(selected_files)
            break
        elif user_input.lower() == 'q':
            break
        elif user_input == '0' and STYLES_DIRECTORY in set(os.path.dirname(file) for file in all_files):
            style_files = [file for file in all_files if file.startswith(STYLES_DIRECTORY)]
            if all(file in selected_files for file in style_files):
                selected_files = [file for file in selected_files if not file.startswith(STYLES_DIRECTORY)]
            else:
                selected_files.extend(file for file in style_files if file not in selected_files)
        elif user_input.isdigit():
            index = int(user_input) - 1
            if 0 <= index < len(all_files):
                file = all_files[index]
                if file in selected_files:
                    selected_files.remove(file)
                else:
                    selected_files.append(file)
        else:
            print("Invalid input. Please try again.")

    # Generate the final listing
    with open(OUTPUT_FILE, 'w') as out_f:
        out_f.write("")  # Clear the output file

    for file in selected_files:
        append_file_contents(file, OUTPUT_FILE)
        print(f"Added content from: {file}")

if __name__ == "__main__":
    main()

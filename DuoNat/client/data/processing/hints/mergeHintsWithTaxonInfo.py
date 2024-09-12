import json
import os
import shutil

def merge_taxon_info():
    # Define file paths
    taxon_info_path = '../../taxonInfo.json'
    taxon_hints_path = 'taxonHints.json'
    backup_path = '../../taxonInfo.json.old'

    # Create a backup of the original taxonInfo.json
    shutil.copy2(taxon_info_path, backup_path)

    # Read taxonInfo.json
    with open(taxon_info_path, 'r') as f:
        taxon_info = json.load(f)

    # Read taxonHints.json
    with open(taxon_hints_path, 'r') as f:
        taxon_hints = json.load(f)

    # Merge taxonHints into taxonInfo
    for taxon_id, taxon_data in taxon_info.items():
        taxon_name = taxon_data['taxonName']
        if taxon_name in taxon_hints:
            if 'hints' not in taxon_data:
                taxon_data['hints'] = []
            taxon_data['hints'].extend(taxon_hints[taxon_name]['hints'])

    # Write the updated taxonInfo back to the file
    with open(taxon_info_path, 'w') as f:
        json.dump(taxon_info, f, indent=2)

    print(f"Merged taxonHints.json into {taxon_info_path}")
    print(f"Backup created at {backup_path}")

if __name__ == "__main__":
    merge_taxon_info()

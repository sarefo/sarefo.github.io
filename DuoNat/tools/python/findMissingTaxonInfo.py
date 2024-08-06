import json
from typing import Dict, Any

def check_empty_fields(data: Dict[str, Any]) -> Dict[str, list]:
    empty_fields = []
    
    # Check if taxonName is empty
    if not data.get('taxonName'):
        empty_fields.append('taxonName')
    
    # Check if vernacularName is empty
##    if not data.get('vernacularName'):
##        empty_fields.append('vernacularName')
    
    # Check if ancestryIds is empty
    if not data.get('ancestryIds'):
        empty_fields.append('ancestryIds')
    
    # Check if rank is empty
    if not data.get('rank'):
        empty_fields.append('rank')
    
    # Check if taxonFacts is empty or missing
    if 'taxonFacts' not in data or not data['taxonFacts']:
        empty_fields.append('taxonFacts')
    
    # Check if range is empty
    if not data.get('range'):
        empty_fields.append('range')
    
    return empty_fields

def main():
    file_path = '../../data/taxonInfo.json'
    
    try:
        with open(file_path, 'r') as file:
            taxon_data = json.load(file)
    except FileNotFoundError:
        print(f"Error: File '{file_path}' not found.")
        return
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in file '{file_path}'.")
        return

    for taxon_id, taxon_info in taxon_data.items():
        empty_fields = check_empty_fields(taxon_info)
        
        if empty_fields:
            print(f"ID: {taxon_id}")
            print(f"Taxon Name: {taxon_info.get('taxonName', 'N/A')}")
            print(f"Missing Fields: {', '.join(empty_fields)}")
            print("-" * 40)

if __name__ == "__main__":
    main()

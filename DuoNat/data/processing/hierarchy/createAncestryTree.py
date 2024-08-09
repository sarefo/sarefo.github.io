import json
import os
import requests
import time

def load_json(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)

def save_json(data, file_path):
    with open(file_path, 'w') as file:
        json.dump(data, file, indent=2)

def fetch_taxon_details(taxon_id):
    url = f"https://api.inaturalist.org/v1/taxa/{taxon_id}"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        if data['results']:
            result = data['results'][0]
            return {
                'taxonName': result['name'],
                'vernacularName': result.get('preferred_common_name', 'n/a'),
                'rank': result['rank'],
            }
    return None

def merge_taxonomy_data(file_a_path, file_b_path, output_path):
    data_a = load_json(file_a_path)
    data_b = load_json(file_b_path)

    merged_data = {}

    for taxon_id, taxon_info in data_b.items():
        ancestry_ids = taxon_info['ancestryIds']
        
        for i in range(len(ancestry_ids)):
            current_id = str(ancestry_ids[i])
            parent_id = str(ancestry_ids[i-1]) if i > 0 else None
            
            if current_id not in merged_data:
                if current_id in data_a:
                    merged_data[current_id] = data_a[current_id].copy()
                else:
                    merged_data[current_id] = {
                        'taxonName': taxon_info['taxonName'] if current_id == taxon_id else f"Unknown_{current_id}",
                        'vernacularName': taxon_info.get('vernacularName', "n/a") if current_id == taxon_id else f"Unknown_{current_id}",
                        'rank': taxon_info['rank'] if current_id == taxon_id else "Unknown",
                    }
            
            merged_data[current_id]['parentId'] = parent_id

    for taxon_id, taxon_info in data_a.items():
        if taxon_id not in merged_data:
            merged_data[taxon_id] = taxon_info.copy()

    # Ensure "Life" (ID 48460) is included with null parentId
    if "48460" in merged_data:
        merged_data["48460"]["parentId"] = None
    else:
        merged_data["48460"] = {
            "taxonName": "Life",
            "vernacularName": "Life",
            "rank": "Domain",
            "parentId": None
        }

    # Ensure "Animalia" (ID 1) is included with correct parentId
    if "1" in merged_data:
        merged_data["1"]["parentId"] = "48460"
    else:
        merged_data["1"] = {
            "taxonName": "Animalia",
            "vernacularName": "Animals",
            "rank": "Kingdom",
            "parentId": "48460"
        }

    # Fetch unknown taxa from iNat API
    unknown_taxa = [taxon_id for taxon_id, info in merged_data.items() 
                    if info['rank'] == 'Unknown' or 'Unknown_' in info['taxonName']]
    
    print(f"Fetching details for {len(unknown_taxa)} unknown taxa from iNat API...")
    for i, taxon_id in enumerate(unknown_taxa):
        print(f"Fetching details for taxon {i+1}/{len(unknown_taxa)}: ID {taxon_id}")
        details = fetch_taxon_details(taxon_id)
        if details:
            merged_data[taxon_id].update(details)
        time.sleep(0.5)  # To avoid hitting API rate limits

    save_json(merged_data, output_path)

    print(f"Merged taxonomy data saved to {output_path}")
    print(f"Total number of taxa: {len(merged_data)}")

# File paths
file_a_path = '../../taxonHierarchy.json'
file_b_path = '../../taxonInfo.json'
output_path = '../../merged_taxonomy.json'

# Run the merger
merge_taxonomy_data(file_a_path, file_b_path, output_path)

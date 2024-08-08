import json
import requests
import time

def load_json(filename):
    with open(filename, 'r') as file:
        return json.load(file)

def save_json(data, filename):
    with open(filename, 'w') as file:
        json.dump(data, file, indent=4)

def fetch_taxon_details(taxon_id):
    """Fetch taxon details from iNat API"""
    url = f"https://api.inaturalist.org/v1/taxa/{taxon_id}"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        if data['results']:
            result = data['results'][0]
            return {
                "name": result['name'],
                "vernacularName": result.get('preferred_common_name', '').capitalize(),
                "rank": result['rank'].capitalize()
            }
    return None

def update_hierarchy():
    """
    This script updates the taxonHierarchy.json file by:
    1. Loading the current taxonHierarchy.json and taxonInfo.json files
    2. Adding new taxa from taxonInfo.json that aren't in taxonHierarchy.json
    3. Fetching vernacular names and ranks for new entries from iNat API
    4. Recalculating all parentIDs based on the latest information in taxonInfo.json
    5. Saving the updated hierarchy to taxonHierarchy.json.new

    This ensures that the taxonHierarchy.json file stays up-to-date with any changes
    in the taxonomic hierarchy, including new taxa and updated relationships.
    """
    # Load existing data
    current_hierarchy = load_json('../../taxonHierarchy.json')
    taxon_info = load_json('../../taxonInfo.json')
    
    # Create a new hierarchy dictionary
    updated_hierarchy = {}
    
    # First, copy all existing taxa from current_hierarchy
    for id, info in current_hierarchy.items():
        updated_hierarchy[id] = {
            "name": info["taxonName"],
            "vernacularName": info.get("vernacularName", ""),
            "rank": info["rank"],
            "parentId": None  # We'll recalculate this later
        }
    
    # Now, process taxonInfo.json to add new taxa and set all parentIDs
    for taxon_id, taxon_data in taxon_info.items():
        ancestry_ids = taxon_data["ancestryIds"]
        
        for i, current_id in enumerate(ancestry_ids):
            current_id = str(current_id)
            
            # If this taxon isn't in our hierarchy yet, add it
            if current_id not in updated_hierarchy:
                # Fetch details from iNat API
                taxon_details = fetch_taxon_details(current_id)
                if taxon_details:
                    updated_hierarchy[current_id] = taxon_details
                else:
                    updated_hierarchy[current_id] = {
                        "name": "Unknown",
                        "vernacularName": "",
                        "rank": "Unknown",
                        "parentId": None
                    }
                time.sleep(0.5)  # To avoid hitting API rate limits
            
            # Set the parentId
            if i > 0:
                parent_id = str(ancestry_ids[i-1])
                updated_hierarchy[current_id]["parentId"] = parent_id
            
            # If this is the last ID in the ancestry, it's the taxon itself
            if i == len(ancestry_ids) - 1:
                updated_hierarchy[current_id]["name"] = taxon_data["taxonName"]
                updated_hierarchy[current_id]["rank"] = taxon_data["rank"]
    
    return updated_hierarchy

# Update the hierarchy
updated_hierarchy = update_hierarchy()

# Save the result
save_json(updated_hierarchy, '../../taxonHierarchy.json.new')
print("Updated hierarchy saved to ancestryInfoNew.json")

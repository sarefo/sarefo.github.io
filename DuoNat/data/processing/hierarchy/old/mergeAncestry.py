import json

def load_json(filename):
    with open(filename, 'r') as file:
        return json.load(file)

def save_json(data, filename):
    with open(filename, 'w') as file:
        json.dump(data, file, indent=4)

def generate_hierarchy():
    ancestry_info = load_json('../ancestryInfo.json')
    taxon_info = load_json('../taxonInfo.json')
    
    hierarchy = {}
    
    # First, add all taxa from ancestryInfo.json
    for id, info in ancestry_info.items():
        hierarchy[id] = {
            "name": info["taxonName"],
            "vernacularName": info["vernacularName"],
            "rank": info["rank"],
            "parentId": None  # We'll set this later
        }
    
    # Now, use taxonInfo.json to set parent IDs
    for taxon_id, taxon_data in taxon_info.items():
        ancestry_ids = taxon_data["ancestryIds"]
        for i in range(len(ancestry_ids)):
            current_id = str(ancestry_ids[i])
            if current_id in hierarchy:
                if i > 0:
                    parent_id = str(ancestry_ids[i-1])
                    hierarchy[current_id]["parentId"] = parent_id
                
                # If this is the last ID in the ancestry, it's the taxon itself
                if i == len(ancestry_ids) - 1:
                    hierarchy[current_id]["name"] = taxon_data["taxonName"]
                    hierarchy[current_id]["rank"] = taxon_data["rank"]
    
    return hierarchy

# Generate the hierarchy
pre_generated_hierarchy = generate_hierarchy()

# Save the result
save_json(pre_generated_hierarchy, 'ancestry2.json')

print("Pre-generated hierarchy saved to ancestry2.json")

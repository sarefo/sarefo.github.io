import json
import time
import requests

# Function to fetch taxon data from iNaturalist API
def fetch_taxon_data(taxon_id):
    url = f"https://api.inaturalist.org/v1/taxa/{taxon_id}"
    response = requests.get(url)
    if response.status_code == 200:
        return response.json()["results"][0]
    else:
        return None

# Load the taxon information from the JSON file
with open('../../data/taxonInfo.json', 'r') as file:
    taxon_info = json.load(file)

# Extract unique ancestry IDs
ancestry_ids = set()
for taxon in taxon_info.values():
    ancestry_ids.update(taxon["ancestryIds"])

# Sort the ancestry IDs
sorted_ancestry_ids = sorted(ancestry_ids)

# Fetch taxon data and prepare the output structure
ancestry_info = {}
for ancestry_id in sorted_ancestry_ids:
    taxon_data = fetch_taxon_data(ancestry_id)
    if taxon_data:
        print(f"Fetched: {ancestry_id} - {taxon_data['name']}")
        ancestry_info[ancestry_id] = {
            "taxonName": taxon_data.get("name"),
            "vernacularName": taxon_data.get("preferred_common_name", ""),
            "rank": taxon_data.get("rank", "")
        }
    time.sleep(1)  # Pace the requests to avoid overloading the server

# Write the output to a new JSON file
with open('ancestryInfo.json', 'w') as file:
    json.dump(ancestry_info, file, indent=2)

print("Ancestry information has been written to ancestryInfo.json")

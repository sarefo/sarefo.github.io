import json
import time
import requests

# Load taxon info from file
with open('../../data/taxonInfo.json', 'r') as file:
    taxon_info = json.load(file)

# Extract unique ancestry IDs, ignoring the last one in each list
ancestry_ids = set()
for taxon_id, data in taxon_info.items():
    ancestry_ids.update(data['ancestryIds'][:-1])

# Print the number of unique ancestry IDs
print(f"Number of unique ancestry IDs: {len(ancestry_ids)}")

# Function to fetch taxon info from iNaturalist API
def fetch_taxon_info(taxon_id):
    url = f"https://api.inaturalist.org/v1/taxa/{taxon_id}"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        if 'results' in data and len(data['results']) > 0:
            taxon = data['results'][0]
            return {
                "taxonName": taxon.get('name', ''),
                "vernacularName": taxon.get('preferred_common_name', ''),
                "rank": taxon.get('rank', '')
            }
    return None

# Prepare the output data
output_data = {}

# Load existing data if the file exists
try:
    with open('ancestryInfo.json', 'r') as outfile:
        output_data = json.load(outfile)
except FileNotFoundError:
    output_data = {}

# Fetch and write data for each unique ancestry ID
with open('ancestryInfo.json', 'a') as outfile:
    for ancestry_id in sorted(ancestry_ids):
        if str(ancestry_id) not in output_data:
            taxon_info = fetch_taxon_info(ancestry_id)
            if taxon_info:
                output_data[str(ancestry_id)] = taxon_info
                print(f"Fetched info for taxon ID {ancestry_id}: {taxon_info['taxonName']}")
                # Append new data to the file
                with open('ancestryInfo.json', 'w') as outfile:
                    json.dump(output_data, outfile, indent=4)
                # Wait 2 seconds before the next request to avoid overloading the server
                time.sleep(2)

print("Finished fetching all ancestry info.")


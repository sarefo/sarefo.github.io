import requests
import json
import time

def fetch_taxon_info(taxon_name):
    url = "https://api.inaturalist.org/v1/taxa/autocomplete"
    params = {"q": taxon_name}
    response = requests.get(url, params=params)
    
    if response.status_code != 200:
        print(f"Failed to fetch data for {taxon_name}")
        return None

    data = response.json().get("results", [])
    
    if not data:
        print(f"No data found for {taxon_name}")
        return None

    taxon = data[0]  # Assuming the first result is the most relevant

    # Extracting required information
    taxon_id = taxon.get("id", "")
    taxon_name = taxon.get("name", "")
    vernacular_name = taxon.get("preferred_common_name", "")
    ancestry_ids = taxon.get("ancestor_ids", [])
    rank = taxon.get("rank", "")
    distribution_map_url = ""  # Placeholder as no direct API endpoint is known

    return taxon_id, {
        "taxonName": taxon_name,
        "vernacularName": vernacular_name,
        "ancestryIds": ancestry_ids,
        "rank": rank,
        "distributionMapUrl": distribution_map_url
    }

def read_taxa_file(file_path):
    with open(file_path, "r") as file:
        taxa = [line.strip() for line in file if line.strip()]
    return taxa

def write_json_file(data, output_path):
    with open(output_path, "w") as file:
        json.dump(data, file, indent=2)

def main(input_file, output_file):
    taxa = read_taxa_file(input_file)
    result = {}

    for taxon in taxa:
        print(f"Fetching data for: {taxon}")
        taxon_id, taxon_info = fetch_taxon_info(taxon)
        if taxon_info:
            result[taxon_id] = taxon_info
            write_json_file(result, output_file)
            print(f"Data for {taxon} (ID: {taxon_id}) saved to {output_file}")
        time.sleep(2)  # Wait for 2 seconds between requests to avoid overloading the server

if __name__ == "__main__":
    input_file = "../../data/taxa.txt"  # Replace with your input file path
    output_file = "../../data/taxa_info2.json"  # Replace with your output file path
    main(input_file, output_file)


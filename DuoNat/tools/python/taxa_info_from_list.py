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

def read_json_file(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)

def write_json_file(data, output_path):
    with open(output_path, "w") as file:
        json.dump(data, file, indent=2)

def get_unique_taxa(taxon_pairs):
    unique_taxa = set()
    for pair in taxon_pairs:
        unique_taxa.add(pair['taxon1'])
        unique_taxa.add(pair['taxon2'])
    return list(unique_taxa)

def main(taxon_pairs_file, taxa_info_file, output_file):
    taxon_pairs = read_json_file(taxon_pairs_file)
    taxa_info = read_json_file(taxa_info_file)
    
    unique_taxa = get_unique_taxa(taxon_pairs)
    existing_taxa_names = set(info['taxonName'] for info in taxa_info.values())
    
    taxa_to_fetch = set(unique_taxa) - existing_taxa_names
    
    for taxon in taxa_to_fetch:
        print(f"Fetching data for: {taxon}")
        taxon_id, taxon_info = fetch_taxon_info(taxon)
        if taxon_info:
            taxa_info[taxon_id] = taxon_info
            write_json_file(taxa_info, output_file)
            inat_taxon_name = taxon_info['taxonName']
            print(f"Data saved for taxon:")
            print(f"  - Original name in taxonPairs: {taxon}")
            print(f"  - Official name from iNaturalist: {inat_taxon_name}")
            print(f"  - ID: {taxon_id}")
            print("---")
        time.sleep(2)  # Wait for 2 seconds between requests to avoid overloading the server

    print(f"All taxa information updated and saved to {output_file}")

if __name__ == "__main__":
    taxon_pairs_file = "../../data/taxonPairs.json"
    taxa_info_file = "../../data/taxaInfo.json"
    output_file = "../../data/taxaInfo.json.new"
    main(taxon_pairs_file, taxa_info_file, output_file)

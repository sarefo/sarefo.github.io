import requests
import json

def fetch_taxon_observations(taxon_id, adult=None, sex=None):
    url = 'https://api.inaturalist.org/v1/observations'
    
    # Build the parameters for the request
    params = {
        'taxon_id': taxon_id,
        'per_page': 10,
        'order_by': 'created_at',
        'order': 'desc',
        'photo_license': 'cc-by,cc-by-nc,cc-by-sa,cc-by-nd,cc-by-nc-sa,cc-by-nc-nd,cc0',  # Only include photos with creative commons licenses
        'photos': True  # Ensure that the observations have photos
    }
    
    # Add life stage filter if provided
    if adult is not None:
        params['term_id'] = 1  # This is the ID for 'Life Stage' in iNaturalist
        params['term_value_id'] = 7 if adult else 8  # 7 for 'Adult', 8 for 'Juvenile'

    # Add sex filter if provided
    if sex:
        params['term_id'] = 9  # This is the ID for 'Sex' in iNaturalist
        params['term_value_id'] = {'male': 10, 'female': 11}.get(sex.lower())
    
    # Send the request to the iNaturalist API
    response = requests.get(url, params=params)
    data = response.json()
    
    # Extract URLs of photos from the observations
    photo_urls = []
    for observation in data['results']:
        for photo in observation['photos']:
            photo_urls.append(photo['url'])
            if len(photo_urls) >= 10:
                break
        if len(photo_urls) >= 10:
            break
    
    return photo_urls

# Example usage:
taxon_id = 228486 # Replace with your specific taxon ID
photos = fetch_taxon_observations(taxon_id, adult=True, sex=None)
print(json.dumps(photos, indent=2))


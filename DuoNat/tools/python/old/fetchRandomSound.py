import requests
import random

# Fetch random observations with sounds
url = "https://api.inaturalist.org/v1/observations?order_by=random&sounds=true"
response = requests.get(url)
data = response.json()

# Print the structure of the first observation to inspect the data
#if data['results']:
#    print(data['results'][0])

# Check if any observations have sounds and extract the sound URL
observations_with_sounds = [obs for obs in data['results'] if 'sounds' in obs]

if observations_with_sounds:
    # Choose a random observation from the list
    random_observation = random.choice(observations_with_sounds)
    # Print the structure of the selected observation
#    print(random_observation)
    # Extract the sound URL correctly
    # Here we assume the sound URL might be nested differently
    sound_url = random_observation['sounds'][0].get('file_url')  # or 'url', 'file', etc.
    if sound_url:
        print(f"Random Animal Sound URL: {sound_url}")
    else:
        print("Sound URL not found in the selected observation.")
else:
    print("No observations with sounds found.")

// iNat API

const api = (() => {
    return {

    // fetch from JSON file
    fetchTaxonPairs: async function () {
        try {
            const response = await fetch('./data/taxonPairs.json');
            if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
            return await response.json();
        } catch (error) { console.error("Could not fetch taxon pairs:", error); return []; }
    },

    // for user input of new taxon pairs
    validateTaxon: async function (taxonName) {
        try {
            const response = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(taxonName)}`);
            const data = await response.json();
            return data.results.length > 0 ? data.results[0] : null;
        } catch (error) {
            console.error('Error validating taxon:', error);
            return null;
        }
    },

    fetchRandomImage: async function (taxonName) {
        console.log(`Fetching random image for ${taxonName}`);
        const images = await this.fetchMultipleImages(taxonName, 12); // Fetch 12 images instead of 1
        if (images.length === 0) {
            console.error(`No images found for ${taxonName}`);
            return null;
        }
        const randomIndex = Math.floor(Math.random() * images.length);
        const result = images[randomIndex];
        console.log(`Fetched random image for ${taxonName}: ${result}`);
        return result;
    },

    fetchImageMetadata: async function (taxonName, count = 12) {
        console.log(`Fetching metadata for ${count} images of ${taxonName}`);
        try {
            const searchResponse = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${taxonName}`);
            const searchData = await searchResponse.json();
            if (searchData.results.length === 0) { throw new Error('Taxon not found'); }
            const taxonId = searchData.results[0].id;
            
            const taxonResponse = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`);
            const taxonData = await taxonResponse.json();
            if (taxonData.results.length === 0) { throw new Error('No details found for the taxon'); }
            const taxon = taxonData.results[0];
            
            let images = taxon.taxon_photos.map(photo => photo.photo.url.replace('square', 'medium'));
            
            const result = images.slice(0, Math.min(count, images.length));
            console.log(`Fetched metadata for ${result.length} images of ${taxonName}`);
            return result;
        } catch (error) {
            console.error(`Error fetching image metadata for ${taxonName}:`, error);
            return [];
        }
    },

    fetchRandomImageMetadata: async function (taxonName) {
        console.log(`Fetching random image metadata for ${taxonName}`);
        const images = await this.fetchImageMetadata(taxonName, 12); // Fetch metadata for 12 images
        if (images.length === 0) {
            console.error(`No image metadata found for ${taxonName}`);
            return null;
        }
        const randomIndex = Math.floor(Math.random() * images.length);
        const result = images[randomIndex];
        console.log(`Selected random image metadata for ${taxonName}: ${result}`);
        return result;
    },

    fetchMultipleImages: async function (taxonName, count = 12) {
        console.log(`Fetching ${count} images for ${taxonName}`);
        try {
            const searchResponse = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${taxonName}`);
            const searchData = await searchResponse.json();
            if (searchData.results.length === 0) { throw new Error('Taxon not found'); }
            const taxonId = searchData.results[0].id;
            
            const taxonResponse = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`);
            const taxonData = await taxonResponse.json();
            if (taxonData.results.length === 0) { throw new Error('No details found for the taxon'); }
            const taxon = taxonData.results[0];
            
            let images = taxon.taxon_photos.map(photo => photo.photo.url.replace('square', 'medium'));
            
            // If we don't have enough images, we'll just return what we have
            const result = images.slice(0, Math.min(count, images.length));
            console.log(`Fetched ${result.length} images for ${taxonName}`);
            return result;
        } catch (error) {
            console.error(`Error fetching images for ${taxonName}:`, error);
            return [];
        }
    },

        // fetch vernacular name of taxon from iNat
        fetchVernacular: async function (taxonName) {
            const baseUrl = 'https://api.inaturalist.org/v1/taxa/autocomplete';
            try {
                const response = await fetch(`${baseUrl}?q=${encodeURIComponent(taxonName)}`);
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    const taxon = data.results[0];
                    return taxon.preferred_common_name || null;
                } else {
                    return null;
                }
            } catch (error) {
                console.error('Error fetching vernacular name:', error);
                return null;
            }
        },

        // function to check if iNaturalist API is reachable
        isINaturalistReachable: async function () {
          try {
            const response = await fetch('https://api.inaturalist.org/v1/taxa?q=test');
            return response.ok;
          } catch (error) {
            console.error('Error pinging iNaturalist API:', error);
            return false;
          }
        },

        fetchTaxonId: async function(taxonName) {
            console.log(`Fetching taxon ID for ${taxonName}`);
            const response = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(taxonName)}&per_page=1`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (data.results.length === 0) throw new Error(`Taxon not found: ${taxonName}`);
            console.log(`Taxon ID for ${taxonName}:`, data.results[0].id);
            return data.results[0].id;
        },

        fetchTaxonAncestry: async function(taxonName) {
            console.log(`Fetching ancestry for ${taxonName}`);
            try {
                const taxonId = await this.fetchTaxonId(taxonName);
                const response = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                console.log(`API response for ${taxonName}:`, data);
                if (data.results.length === 0) throw new Error(`Taxon details not found: ${taxonName}`);
                const ancestry = data.results[0].ancestors || [];
                ancestry.push(data.results[0]); // Include the taxon itself in the ancestry
                console.log(`Ancestry for ${taxonName}:`, ancestry);
                return ancestry;
            } catch (error) {
                console.error("Error fetching taxon ancestry:", error);
                return [];
            }
        },

    }; 

})();

export default api;

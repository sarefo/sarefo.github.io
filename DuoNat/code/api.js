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
                const response = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(taxonName)}`);
                const data = await response.json();
                return data.results.length > 0 ? data.results[0] : null;
            } catch (error) {
                console.error('Error validating taxon:', error);
                return null;
            }
        },

        // fetch random image of taxon from iNat
        fetchRandomImage: async function (taxonName) {
            const images = await this.fetchMultipleImages(taxonName, 1);
            return images.length > 0 ? images[0] : null;
        },

        fetchMultipleImages: async function (taxonName, count = 12) {
            try {
                const searchResponse = await fetch(`https://api.inaturalist.org/v1/taxa?q=${taxonName}`);
                const searchData = await searchResponse.json();
                if (searchData.results.length === 0) { throw new Error('Taxon not found'); }
                const taxonId = searchData.results[0].id;
                
                const taxonResponse = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}`);
                const taxonData = await taxonResponse.json();
                if (taxonData.results.length === 0) { throw new Error('No details found for the taxon'); }
                const taxon = taxonData.results[0];
                
                let images = taxon.taxon_photos.map(photo => photo.photo.url.replace('square', 'medium'));
                
                // If we don't have enough images, we'll just return what we have
                return images.slice(0, Math.min(count, images.length));
            } catch (error) {
                console.error(error);
                return [];
            }
        },

        // fetch vernacular name of taxon from iNat
        fetchVernacular: async function (taxonName) {
            const baseUrl = 'https://api.inaturalist.org/v1/taxa';
            try {
                const response = await fetch(`${baseUrl}?q=${encodeURIComponent(taxonName)}`);
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    const taxon = data.results[0];
                    if (taxon && taxon.preferred_common_name) {
                        return taxon.preferred_common_name;
                    } else { return 'No vernacular name'; }
                } else { return 'Taxon not found'; }
            } catch (error) { console.error('Error fetching vernacular name:', error); return ""; }
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

    }; 

})();

export default api;

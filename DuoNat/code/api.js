// iNat API

import logger from './logger.js';

let taxaInfo = null;

const api = (() => {
    return {

        loadTaxaInfo: async function() {
            if (taxaInfo === null) {
                try {
                    const response = await fetch('./data/taxa_info.json');
                    taxaInfo = await response.json();
                } catch (error) {
                    logger.error('Error loading taxa_info.json:', error);
                    taxaInfo = {};
                }
            }
            return taxaInfo;
        },

        // fetch from JSON file
        fetchTaxonPairs: async function () {
            try {
                const response = await fetch('./data/taxonPairs.json');
                if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
                return await response.json();
            } catch (error) { logger.error("Could not fetch taxon pairs:", error); return []; }
        },

        // for user input of new taxon pairs
        validateTaxon: async function (taxonName) {
            try {
                const response = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(taxonName)}`);
                const data = await response.json();
                return data.results.length > 0 ? data.results[0] : null;
            } catch (error) {
                logger.error('Error validating taxon:', error);
                return null;
            }
        },

        fetchRandomImage: async function (taxonName) {
//            logger.debug(`Fetching random image for ${taxonName}`);
            const images = await this.fetchMultipleImages(taxonName, 12);
            if (images.length === 0) {
                logger.error(`No images found for ${taxonName}`);
                throw new Error(`No images found for ${taxonName}`);
            }
            const randomIndex = Math.floor(Math.random() * images.length);
            const result = images[randomIndex];
            logger.debug(`Fetched random image for ${taxonName}: ${result}`);
            return result;
        },

        fetchImageMetadata: async function (taxonName, count = 12) {
//            logger.debug(`Fetching metadata for ${count} images of ${taxonName}`);
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
//                logger.debug(`Fetched metadata for ${result.length} images of ${taxonName}`);
                return result;
            } catch (error) {
                logger.error(`Error fetching image metadata for ${taxonName}:`, error);
                return [];
            }
        },

        fetchRandomImageMetadata: async function (taxonName) {
//            logger.debug(`Fetching random image metadata for ${taxonName}`);
            const images = await this.fetchImageMetadata(taxonName, 12); // Fetch metadata for 12 images
            if (images.length === 0) {
                logger.error(`No image metadata found for ${taxonName}`);
                return null;
            }
            const randomIndex = Math.floor(Math.random() * images.length);
            const result = images[randomIndex];
//            logger.debug(`Selected random image metadata for ${taxonName}: ${result}`);
            return result;
        },

        fetchMultipleImages: async function (taxonName, count = 12) {
//            logger.debug(`Fetching ${count} images for ${taxonName}`);
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
//                logger.debug(`Fetched ${result.length} images for ${taxonName}`);
                return result;
            } catch (error) {
                logger.error(`Error fetching images for ${taxonName}:`, error);
                return [];
            }
        },

        // fetch vernacular name of taxon from iNat
        fetchVernacular: async function (taxonName) {
          const taxaInfo = await this.loadTaxaInfo();
          
          // Find the entry with matching taxonName
          const entry = Object.values(taxaInfo).find(info => info.taxonName.toLowerCase() === taxonName.toLowerCase());
          
          if (entry && entry.vernacularName) {
            if (entry.vernacularName == "none") return "";
            return entry.vernacularName;
          } else {
            logger.warn(`Vernacular name not found for ${taxonName} in local data`);
            // Optionally, you can still fallback to the API if not found locally
            return this.fetchVernacularFromAPI(taxonName);
          }
        },

        fetchVernacularFromAPI: async function (taxonName) {
          logger.debug("fetching vernacular from iNat");
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
            logger.error('Error fetching vernacular name:', error);
            return null;
          }
        },

        // function to check if iNaturalist API is reachable
        isINaturalistReachable: async function () {
            try {
                const response = await fetch('https://api.inaturalist.org/v1/taxa?q=test');
                return response.ok;
            } catch (error) {
                logger.error('Error pinging iNaturalist API:', error);
                return false;
            }
        },

        fetchTaxonId: async function (taxonName) {
            logger.debug(`Fetching taxon ID for ${taxonName}`);
            const response = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(taxonName)}&per_page=1`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (data.results.length === 0) throw new Error(`Taxon not found: ${taxonName}`);
            logger.debug(`Taxon ID for ${taxonName}:`, data.results[0].id);
            return data.results[0].id;
        },

        fetchTaxonDetails: async function (name) {
            try {
                const response = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(name)}&per_page=1&all_names=true`);
                const data = await response.json();
                if (data.results.length === 0) throw new Error(`Taxon not found: ${name}`);
                return data.results[0];
            } catch (error) {
                logger.error('Error fetching taxon details:', error);
                throw error;
            }
        },

        fetchAncestorDetails: async function (ancestorIds) {
            const ancestorDetails = new Map();
            for (const id of ancestorIds) {
                try {
                    const response = await fetch(`https://api.inaturalist.org/v1/taxa/${id}`);
                    const data = await response.json();
                    if (data.results.length > 0) {
                        ancestorDetails.set(id, data.results[0]);
                    }
                } catch (error) {
                    logger.error(`Error fetching ancestor details for ID ${id}:`, error);
                }
            }
//            logger.debug(`Fetching ancestry from iNat: ${Array.from(ancestorDetails.entries())}`);
            return ancestorDetails;
        }
    };

})();

export default api;

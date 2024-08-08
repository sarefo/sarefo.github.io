// iNat API

import logger from './logger.js';
import utils from './utils.js';

let taxonInfo = null;
let ancestryInfo = null;

const handleApiError = (error, context) => {
    logger.error(`API Error in ${context}:`, error);
    throw new Error(`Error in ${context}: ${error.message}`);
};

const api = (() => {
    return {

        loadTaxonInfo: async function () {
            try {
                if (taxonInfo === null) {
                    const response = await fetch('./data/taxonInfo.json');
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    taxonInfo = await response.json();
                }
                return taxonInfo;
            } catch (error) {
                handleApiError(error, 'loadTaxonInfo');
            }
        },

        /*     getVernacularName: async function(taxonName) {
                 try {
                     const taxonInfo = await this.loadTaxonInfo();
                     const taxonData = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === taxonName.toLowerCase());
                     return taxonData ? utils.capitalizeFirstLetter(taxonData.vernacularName) : '';
                 } catch (error) {
                     handleApiError(error, 'getVernacularName');
                 }
             },
     */
        // fetch from JSON file
        fetchTaxonPairs: async function () {
            try {
                const response = await fetch('./data/taxonSets.json');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const taxonSets = await response.json();
                return taxonSets.map(set => ({
                    taxon1: set.taxonNames[0],
                    taxon2: set.taxonNames[1],
                    setID: set.setID,
                    level: set.level,
                    setName: set.setName,
                    tags: set.tags,
                    range: set.range
                }));
            } catch (error) {
                handleApiError(error, 'fetchTaxonPairs');
            }
        },

        // for user input of new taxon pairs
        validateTaxon: async function (taxonName) {
            try {
                const response = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(taxonName)}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                return data.results.length > 0 ? data.results[0] : null;
            } catch (error) {
                handleApiError(error, 'validateTaxon');
            }
        },

        fetchRandomImage: async function (taxonName) {
            try {
                const images = await this.fetchMultipleImages(taxonName, 12);
                if (images.length === 0) {
                    throw new Error(`No images found for ${taxonName}`);
                }
                const randomIndex = Math.floor(Math.random() * images.length);
                const result = images[randomIndex];
                logger.debug(`Fetched random image for ${taxonName}: ${result}`);
                return result;
            } catch (error) {
                handleApiError(error, 'fetchRandomImage');
            }
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

        async fetchMultipleImages(taxonName, count = 12) {
            try {
                const searchResponse = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${taxonName}`);
                if (!searchResponse.ok) throw new Error(`HTTP error! status: ${searchResponse.status}`);
                const searchData = await searchResponse.json();
                if (searchData.results.length === 0) throw new Error('Taxon not found');
                const taxonId = searchData.results[0].id;

                const taxonResponse = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}?photos=true`);
                if (!taxonResponse.ok) throw new Error(`HTTP error! status: ${taxonResponse.status}`);
                const taxonData = await taxonResponse.json();
                if (taxonData.results.length === 0) throw new Error('No details found for the taxon');
                const taxon = taxonData.results[0];

                let images = taxon.taxon_photos.map(photo => photo.photo.url.replace('square', 'medium'));

                images = [...new Set(images)];
                images = images.sort(() => Math.random() - 0.5);

                return images.slice(0, Math.min(count, images.length));

            } catch (error) {
                handleApiError(error, 'fetchMultipleImages');
            }
        },

        // fetch vernacular name of taxon from local file or iNat
        fetchVernacular: async function (taxonName) {
            const taxonInfo = await this.loadTaxonInfo();

            // Find the entry with matching taxonName
            const entry = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === taxonName.toLowerCase());

            if (entry) {
                // Return the vernacularName even if it's an empty string
                return entry.vernacularName;
            } else {
                logger.warn(`Taxon not found in local data: ${taxonName}`);
                // Only fetch from API if the taxon is not in our local data at all
                return this.fetchVernacularFromAPI(taxonName);
            }
        },

        fetchVernacularFromAPI: async function (taxonName) {
            logger.debug("Fetching vernacular from iNat API for: " + taxonName);
            try {
                const baseUrl = 'https://api.inaturalist.org/v1/taxa/autocomplete';
                const response = await fetch(`${baseUrl}?q=${encodeURIComponent(taxonName)}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    const taxon = data.results[0];
                    return taxon.preferred_common_name || "";
                } else {
                    return "";
                }
            } catch (error) {
                handleApiError(error, 'fetchVernacularFromAPI');
                return "";
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

        checkWikipediaPage: async function (taxonName) {
            const encodedTaxonName = encodeURIComponent(taxonName);
            const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodedTaxonName}&format=json&origin=*`;

            try {
                const response = await fetch(apiUrl);
                const data = await response.json();
                const pages = data.query.pages;
                
                // If the page exists, it will have a positive page ID
                return !pages[-1];
            } catch (error) {
                logger.error('Error checking Wikipedia page:', error);
                return false;
            }
        },

        fetchTaxonId: async function (taxonName) {
            try {
                logger.debug(`Fetching taxon ID for ${taxonName}`);
                const response = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(taxonName)}&per_page=1`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                if (data.results.length === 0) throw new Error(`Taxon not found: ${taxonName}`);
                logger.debug(`Taxon ID for ${taxonName}:`, data.results[0].id);
                return data.results[0].id;
            } catch (error) {
                handleApiError(error, 'fetchTaxonId');
            }
        },

        fetchTaxonDetails: async function (name) {
            try {
                const response = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(name)}&per_page=1&all_names=true`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                if (data.results.length === 0) throw new Error(`Taxon not found: ${name}`);
                logger.debug('Fetched taxon details:', data.results[0]);
                return data.results[0];
            } catch (error) {
                handleApiError(error, 'fetchTaxonDetails');
            }
        },

        loadAncestryInfo: async function () {
            try {
                if (ancestryInfo === null) {
                    const response = await fetch('./data/ancestryInfo.json');
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    ancestryInfo = await response.json();
                }
                return ancestryInfo;
            } catch (error) {
                handleApiError(error, 'loadAncestryInfo');
            }
        },

        async getAncestryFromLocalData(taxonName) {
            const taxonInfo = await this.loadTaxonInfo();
            const taxonData = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === taxonName.toLowerCase());
            return taxonData ? taxonData.ancestryIds.map(id => parseInt(id)) : [];
        },

        fetchAncestorDetails: async function (ancestorIds) {
            try {
                const ancestorDetails = new Map();
                const localAncestryInfo = await this.loadAncestryInfo();

                for (const id of ancestorIds) {
                    const localData = localAncestryInfo[id];
                    if (localData) {
                        ancestorDetails.set(id, {
                            id: parseInt(id),
                            name: localData.taxonName,
                            rank: localData.rank,
                            preferred_common_name: localData.vernacularName
                        });
                        logger.debug(`Using local ancestry data for ID ${id}:`, localData);
                    } else {
                        const response = await fetch(`https://api.inaturalist.org/v1/taxa/${id}`);
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        const data = await response.json();
                        if (data.results.length > 0) {
                            ancestorDetails.set(id, data.results[0]);
                            logger.debug(`Fetched ancestry data from iNat for ID ${id}:`, data.results[0]);
                        }
                    }
                }
                return ancestorDetails;
            } catch (error) {
                handleApiError(error, 'fetchAncestorDetails');
            }
        },

    };

})();

export default api;

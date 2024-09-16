import config from './config.js';
import logger from './logger.js';
import state from './state.js';

import TaxonomyHierarchy from './taxonomyHierarchy.js';

import iNatDownDialog from './dialogs/iNatDownDialog.js';

const handleApiError = (error, context) => {
    logger.error(`API Error in ${context}:`, error);
    throw new Error(`Error in ${context}: ${error.message}`);
};

const api = (() => {
    let taxonomyHierarchy = null;
    let taxonInfo = null;
    let cachedTaxonPairs = null;

    return {
        taxonomy: {
            fetchTaxonInfoFromMongoDB: async function (taxonIdentifier, fields = null) {
                if (!config.useMongoDB) {
                    return null;
                }
                try {
                    let url;
                    if (isNaN(taxonIdentifier)) {
                        // If it's not a number, assume it's a name
                        url = `${config.serverUrl}/api/taxonInfo?taxonName=${encodeURIComponent(taxonIdentifier)}`;
                    } else {
                        // If it's a number, assume it's an ID
                        url = `${config.serverUrl}/api/taxonInfo/${taxonIdentifier}`;
                    }
                    
                    // Add fields parameter if specified
                    if (fields) {
                        url += `${url.includes('?') ? '&' : '?'}fields=${fields.join(',')}`;
                    }

                    const response = await fetch(url);
                    if (!response.ok) {
                        if (response.status === 404) {
                            logger.warn(`Taxon not found in MongoDB: ${taxonIdentifier}`);
                            return null;
                        }
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return await response.json();
                } catch (error) {
                    logger.error('Error fetching taxon info from MongoDB:', error);
                    return null;
                }
            },

            async fetchBulkTaxonInfo(taxonNames) {
                if (!config.useMongoDB) {
                    return null;
                }
                try {
                    const response = await fetch(`${config.serverUrl}/api/bulkTaxonInfo`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ taxonNames }),
                    });
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return await response.json();
                } catch (error) {
                    logger.error('Error fetching bulk taxon info from MongoDB:', error);
                    return null;
                }
            },

            loadTaxonInfo: async function () {
                if (!config.useMongoDB) {
                    if (taxonInfo === null) {
                        logger.debug('Loading taxon info from JSON file');
                        const response = await fetch('./data/taxonInfo.json');
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        taxonInfo = await response.json();
                    }
                    return taxonInfo;
                }
                // When using MongoDB, we'll fetch specific taxon info as needed
                logger.trace("dummy taxonInfo fetch: should not happen, but fine for now.");
                return {};
            },

            loadTaxonomyHierarchy: async function () {
                if (taxonomyHierarchy === null) {
                    let hierarchyData;

                    if (config.useMongoDB) {
                        try {
                            //logger.debug(`Fetching taxonomy hierarchy from ${config.serverUrl}/api/taxonHierarchy`);
                            const response = await fetch(`${config.serverUrl}/api/taxonHierarchy`);

                            //logger.debug(`Response status: ${response.status}`);
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            const contentType = response.headers.get("content-type");
                            //logger.debug(`Content-Type: ${contentType}`);
                            if (!contentType || !contentType.includes("application/json")) {
                                const text = await response.text();
                                logger.error('Unexpected response:', text.substring(0, 200));
                                throw new Error(`Unexpected content type: ${contentType}`);
                            }
                            hierarchyData = await response.json();
                            logger.debug(`Loaded hierarchyData with ${Object.keys(hierarchyData).length} entries`);
                        } catch (error) {
                            logger.error('Error fetching taxon hierarchy from MongoDB:', error);
                            throw error;
                        }
                    } else {
                        const hierarchyResponse = await fetch('./data/taxonHierarchy.json');
                        if (!hierarchyResponse.ok) {
                            throw new Error(`HTTP error! status: ${hierarchyResponse.status}`);
                        }
                        hierarchyData = await hierarchyResponse.json();
                    }

                    taxonomyHierarchy = new TaxonomyHierarchy(hierarchyData);

                    // Load additional taxon info if needed
                    const taxonInfoResponse = await fetch('./data/taxonInfo.json');
                    if (taxonInfoResponse.ok) {
                        const taxonInfo = await taxonInfoResponse.json();
                        Object.values(taxonInfo).forEach(taxon => {
                            taxonomyHierarchy.addTaxon(taxon);
                        });
                    }
                }
                return taxonomyHierarchy;
            },

            getTaxonomyHierarchy: function () {
                return taxonomyHierarchy;
            },

            // fetch from JSON file or MongoDB
            async fetchTaxonPairs() {
              try {
                if (config.useMongoDB) {
                  const response = await fetch(`${config.serverUrl}/api/taxonPairs`);
                  if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                  }
                  const data = await response.json();
                  console.log('Raw response from server:', data); // Add this line
                  
                  // Check if data.results exists and is an array
                  if (!Array.isArray(data.results)) {
                    throw new Error('Invalid response format: results is not an array');
                  }

                  return data.results.map(pair => ({
                    ...pair,
                    pairID: pair.pairID,
                    taxonA: pair.taxonNames[0],
                    taxonB: pair.taxonNames[1]
                  }));
                } else {
                  // Existing code for JSON file
                  const response = await fetch('./data/taxonPairs.json');
                  if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                  }
                  const taxonPairs = await response.json();
                  return Object.entries(taxonPairs).map(([pairID, pair]) => ({
                    ...pair,
                    pairID,
                    taxonA: pair.taxonNames[0],
                    taxonB: pair.taxonNames[1]
                  }));
                }
              } catch (error) {
                handleApiError(error, 'fetchTaxonPairs');
              }
            },

            async fetchPaginatedTaxonPairs(filters, searchTerm, page, pageSize) {
                if (config.useMongoDB) {
                    return this.fetchPaginatedTaxonPairsFromMongoDB(filters, searchTerm, page, pageSize);
                } else {
                    return this.fetchPaginatedTaxonPairsFromJSON(filters, searchTerm, page, pageSize);
                }
            },

            async fetchPaginatedTaxonPairsFromMongoDB(filters, searchTerm, page, pageSize) {
                try {
                    const response = await fetch(`${config.serverUrl}/api/taxonPairs`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            filters,
                            searchTerm,
                            page,
                            pageSize
                        }),
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();
                    return {
                        results: data.results,
                        totalCount: data.totalCount,
                        hasMore: data.hasMore
                    };
                } catch (error) {
                    logger.error('Error fetching paginated taxon pairs from MongoDB:', error);
                    throw error;
                }
            },

            buildMongoQuery(filters, searchTerm) {
                const query = {};

                if (filters.levels && filters.levels.length > 0) {
                    query.level = { $in: filters.levels };
                }

                if (filters.ranges && filters.ranges.length > 0) {
                    query.range = { $in: filters.ranges };
                }

                if (filters.tags && filters.tags.length > 0) {
                    query.tags = { $all: filters.tags };
                }

                if (filters.phylogenyId) {
                    query['taxa'] = { $elemMatch: { $eq: filters.phylogenyId } };
                }

                if (searchTerm) {
                    query.$or = [
                        { taxonNames: { $regex: searchTerm, $options: 'i' } },
                        { pairName: { $regex: searchTerm, $options: 'i' } },
                        { tags: { $regex: searchTerm, $options: 'i' } },
                        { pairID: searchTerm }
                    ];
                }

                return query;
            },

            async fetchPaginatedTaxonPairsFromJSON(filters, searchTerm, page, pageSize) {
                try {
                    const allPairs = await this.fetchTaxonPairs();
                    const filteredPairs = this.filterTaxonPairs(allPairs, filters, searchTerm);
                    const totalCount = filteredPairs.length;
                    const startIndex = (page - 1) * pageSize;
                    const results = filteredPairs.slice(startIndex, startIndex + pageSize);

                    return {
                        results,
                        totalCount,
                        hasMore: totalCount > page * pageSize
                    };
                } catch (error) {
                    logger.error('Error fetching paginated taxon pairs from JSON:', error);
                    throw error;
                }
            },

            filterTaxonPairs(pairs, filters, searchTerm) {
                return pairs.filter(pair => {
                    const matchesLevels = !filters.levels.length || filters.levels.includes(pair.level);
                    const matchesRanges = !filters.ranges.length || pair.range.some(r => filters.ranges.includes(r));
                    const matchesTags = !filters.tags.length || filters.tags.every(tag => pair.tags.includes(tag));
                    const matchesPhylogeny = !filters.phylogenyId || pair.taxa.includes(filters.phylogenyId);
                    const matchesSearch = !searchTerm || 
                        pair.taxonNames.some(name => name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        pair.pairName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        pair.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        pair.pairID === searchTerm;

                    return matchesLevels && matchesRanges && matchesTags && matchesPhylogeny && matchesSearch;
                });
            },

            fetchPairByID: async function (pairID) {
                if (!config.useMongoDB) {
                    return null;
                }
                try {
                    const response = await fetch(`${config.serverUrl}/api/taxonPairs/${pairID}`);
                    if (!response.ok) {
                        if (response.status === 404) {
                            logger.warn(`Pair with ID ${pairID} not found in MongoDB`);
                            return null;
                        }
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return await response.json();
                } catch (error) {
                    logger.error('Error fetching pair by ID from MongoDB:', error);
                    return null;
                }
            },

            async checkLocalTaxonData(taxonName) {
                logger.debug(`Checking local data for taxon: ${taxonName}`);
                if (!taxonName || typeof taxonName !== 'string') {
                    logger.error(`Invalid taxon name: ${taxonName}`);
                    return null;
                }
                const taxonInfo = await api.taxonomy.loadTaxonInfo();
                const lowercaseTaxonName = taxonName.toLowerCase();

                for (const [id, info] of Object.entries(taxonInfo)) {
                    const infoTaxonName = info.taxonName || '';
                    const infoVernacularName = info.vernacularName || '';

                    if (infoTaxonName.toLowerCase() === lowercaseTaxonName ||
                        infoVernacularName.toLowerCase() === lowercaseTaxonName) {
                        logger.debug(`Taxon found in local data: ${infoTaxonName}`);
                        return {
                            id: parseInt(id),
                            name: infoTaxonName,
                            preferred_common_name: infoVernacularName
                        };
                    }
                }
                logger.debug('Taxon not found in local data');
                return null;
            },

            // for user input of new taxon pairs
            validateTaxon: async function (taxonName) {
                try {
                    if (!taxonName || typeof taxonName !== 'string') {
                        logger.error(`Invalid taxon name: ${taxonName}`);
                        return null;
                    }

                    // First, check local data
                    const localTaxon = await this.checkLocalTaxonData(taxonName);
                    if (localTaxon) {
                        logger.debug('Taxon found in local data');
                        return localTaxon;
                    }

                    // If not found locally, then use the API
                    const response = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(taxonName)}`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();
                    logger.debug(`API response for ${taxonName}:`, data);
                    return data.results.length > 0 ? data.results[0] : null;
                } catch (error) {
                    logger.error('Error in validateTaxon:', error);
                    return null;
                }
            },

            fetchTaxonId: async function (taxonName) {
                try {
                    logger.debug(`Fetching taxon ID for ${taxonName}`);
                    
                    // First, check local data
                    const localTaxon = await this.checkLocalTaxonData(taxonName);
                    if (localTaxon) {
                        logger.debug(`Taxon ID for ${taxonName} found locally:`, localTaxon.id);
                        return localTaxon.id;
                    }

                    // If not found locally, then use the API
                    const response = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(taxonName)}&per_page=1`);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const data = await response.json();
                    if (data.results.length === 0) throw new Error(`Taxon not found: ${taxonName}`);
                    logger.debug(`Taxon ID for ${taxonName} fetched from API:`, data.results[0].id);
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
                    return data.results[0];
                } catch (error) {
                    handleApiError(error, 'fetchTaxonDetails');
                }
            },

            fetchTaxonHints: async function (taxonId) {
                try {
                    if (config.useMongoDB) {
                        const response = await fetch(`${config.serverUrl}/api/taxonHints/${taxonId}`);
                        if (!response.ok) {
                            if (response.status === 404) {
                                logger.warn(`Hints not found for taxon ID: ${taxonId}`);
                                return null;
                            }
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        const data = await response.json();
                        return data.hints;
                    } else {
                        // Existing code for JSON file
                        const taxonInfo = await this.loadTaxonInfo();
                        const taxonData = taxonInfo[taxonId];
                        return taxonData && taxonData.hints ? taxonData.hints : null;
                    }
                } catch (error) {
                    logger.error('Error in fetchTaxonHints:', error);
                    return null;
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
                    const taxonInfo = await this.loadTaxonInfo();

                    for (const id of ancestorIds) {
                        const localData = taxonomyHierarchy.getTaxonById(id.toString());
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

            async fetchLevelCounts(filters) {
                if (!config.useMongoDB) {
                    return null;
                }
                try {
                    const queryString = new URLSearchParams({ filters: JSON.stringify(filters) }).toString();
                    const response = await fetch(`${config.serverUrl}/api/taxonPairs/levelCounts?${queryString}`);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return await response.json();
                } catch (error) {
                    logger.error('Error fetching level counts from MongoDB:', error);
                    return null;
                }
            },

        },

        images: {

            // called from preloader.fetchDifferentImage()
            async fetchMultipleImages(taxonName, count = 12) {
                try {
                    if (!taxonName || typeof taxonName !== 'string') {
                        throw new Error(`Invalid taxon name: ${taxonName}`);
                    }

                    let taxonId;
                    if (config.useMongoDB) {
                        const taxonInfo = await api.taxonomy.fetchTaxonInfoFromMongoDB(taxonName);
                        if (taxonInfo) {
                            taxonId = taxonInfo.taxonId;
                            logger.debug(`Using MongoDB taxon ID for ${taxonName}: ${taxonId}`);
                        }
                    } else {
                        // Existing code for JSON file
                        const taxonInfo = await api.taxonomy.loadTaxonInfo();
                        const localTaxon = Object.values(taxonInfo).find(info => 
                            info.taxonName && info.taxonName.toLowerCase() === taxonName.toLowerCase()
                        );
                        if (localTaxon) {
                            taxonId = Object.keys(taxonInfo).find(key => taxonInfo[key] === localTaxon);
                            logger.debug(`Using local taxon ID for ${taxonName}: ${taxonId}`);
                        }
                    }

                    if (!taxonId) {
                        logger.warn(`Taxon ${taxonName} not found locally, fetching from API`);
                        // Existing code for API fallback
                        const searchResponse = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(taxonName)}`);
                        if (!searchResponse.ok) throw new Error(`HTTP error! status: ${searchResponse.status}`);
                        const searchData = await searchResponse.json();
                        if (searchData.results.length === 0) throw new Error(`Taxon not found: ${taxonName}`);
                        taxonId = searchData.results[0].id;
                    }

                    // Rest of the function remains the same
                    let images;
                    if (config.useObservationImages) {
                        images = await this.fetchImagesFromObservations(taxonId, count);
                    } else {
                        images = await this.fetchImagesFromGallery(taxonId, count);
                    }

                    images = [...new Set(images)];
                    images = images.sort(() => Math.random() - 0.5);

                    //logger.debug(`Fetched ${images.length} images for taxon: ${taxonName}`);
                    return images.slice(0, Math.min(count, images.length));

                } catch (error) {
                    logger.error(`Error in fetchMultipleImages for taxon ${taxonName}:`, error);
                    return []; // Return an empty array instead of throwing an error
                }
            },

            fetchImagesFromObservations: async function (taxonId, count) {
                let images;
                let baseUrl = `https://api.inaturalist.org/v1/observations?taxon_id=${taxonId}&photos=true&per_page=${count}&order=desc&order_by=votes`;
                baseUrl += '&term_id=1&term_value_id=2'; // adults only
                baseUrl += '&term_id=17&term_value_id=18'; // alive only TODO doesn't seem to work
                logger.debug("baseUrl is ", baseUrl);
                const observationResponse = await fetch(baseUrl);
                if (!observationResponse.ok) throw new Error(`HTTP error! status: ${observationResponse.status}`);
                const observationData = await observationResponse.json();
                images = observationData.results.map(obs => obs.photos[0].url.replace('square', 'medium'));
                return images;
            },

            fetchImagesFromGallery: async function (taxonId, count) {
                let images;
                const taxonResponse = await fetch(`https://api.inaturalist.org/v1/taxa/${taxonId}?photos=true`);
                if (!taxonResponse.ok) throw new Error(`HTTP error! status: ${taxonResponse.status}`);
                const taxonData = await taxonResponse.json();
                if (taxonData.results.length === 0) throw new Error('No details found for the taxon');
                const taxon = taxonData.results[0];
                images = taxon.taxon_photos.map(photo => photo.photo.url.replace('square', 'medium'));
                return images;
            },

        },

        sound: {
            async fetchRandomObservationWithSound() {
                const url = "https://api.inaturalist.org/v1/observations?order_by=random&sounds=true";
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error('Failed to fetch observations');
                }
                const data = await response.json();
                const observationsWithSounds = data.results.filter(obs => obs.sounds && obs.sounds.length > 0);
                return observationsWithSounds.length > 0 ? observationsWithSounds[Math.floor(Math.random() * observationsWithSounds.length)] : null;
            },
        },

        vernacular: {
            // fetch vernacular name of taxon from MongoDB, local file or iNat
            fetchVernacular: async function (taxonName) {
                if (config.useMongoDB) {
                    try {
                        const response = await fetch(`${config.serverUrl}/api/taxonInfo?taxonName=${encodeURIComponent(taxonName)}`);
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        const data = await response.json();
                        if (data && data.vernacularName) {
                            return data.vernacularName;
                        }
                        logger.warn(`Vernacular name not found in MongoDB for: ${taxonName}`);
                    } catch (error) {
                        logger.error('Error fetching vernacular from MongoDB:', error);
                    }
                } else {
                    // Fetch from JSON file
                    const taxonInfo = await api.taxonomy.loadTaxonInfo();
                    const entry = Object.values(taxonInfo).find(info => info.taxonName.toLowerCase() === taxonName.toLowerCase());
                    if (entry && entry.vernacularName) {
                        return entry.vernacularName;
                    }
                    logger.warn(`Vernacular name not found in local data for: ${taxonName}`);
                }

                // If we reach here, we couldn't find the vernacular name in our primary source
                // We can decide to fall back to iNat API or return null/empty string
                return this.fetchVernacularFromINat(taxonName);
            },

            fetchVernacularFromINat: async function (taxonName) {
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
                    handleApiError(error, 'fetchVernacularFromINat');
                    return "";
                }
            },
        },

        externalAPIs: {
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

            async checkINaturalistReachability() {
                if (!await this.isINaturalistReachable()) {
                    iNatDownDialog.showINatDownDialog();
                    state.setState(state.GameState.IDLE);
                    return false;
                } else {
                    iNatDownDialog.hideINatDownDialog();
                    return true;
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
        },

        utils: {
            // TODO for now only gives photo page
            getObservationURLFromImageURL(imageURL) {
                const match = imageURL.match(/\/photos\/(\d+)\//);
                if (match && match[1]) {
                    return `https://www.inaturalist.org/photos/${match[1]}`;
                }
                return null;
            },
        }

    };
})();

// Bind all methods in api and its nested objects
Object.keys(api).forEach(key => {
    if (typeof api[key] === 'object') {
        Object.keys(api[key]).forEach(nestedKey => {
            if (typeof api[key][nestedKey] === 'function') {
                api[key][nestedKey] = api[key][nestedKey].bind(api[key]);
            }
        });
    }
});

const publicAPI = {
    taxonomy: {
        validateTaxon: api.taxonomy.validateTaxon,
        fetchTaxonPairs: api.taxonomy.fetchTaxonPairs,
        fetchBulkTaxonInfo: api.taxonomy.fetchBulkTaxonInfo,
        fetchPaginatedTaxonPairs: api.taxonomy.fetchPaginatedTaxonPairs,
        fetchLevelCounts: api.taxonomy.fetchLevelCounts,
        fetchTaxonHints: api.taxonomy.fetchTaxonHints,
        loadTaxonInfo: api.taxonomy.loadTaxonInfo,
        fetchTaxonId: api.taxonomy.fetchTaxonId,
        fetchTaxonInfoFromMongoDB: api.taxonomy.fetchTaxonInfoFromMongoDB,
        getAncestryFromLocalData: api.taxonomy.getAncestryFromLocalData,
        fetchAncestorDetails: api.taxonomy.fetchAncestorDetails,
        getTaxonomyHierarchy: api.taxonomy.getTaxonomyHierarchy,
        loadTaxonomyHierarchy: api.taxonomy.loadTaxonomyHierarchy,
        fetchTaxonDetails: api.taxonomy.fetchTaxonDetails
    },
    images: {
        //fetchRandomImage: api.images.fetchRandomImage,
        fetchMultipleImages: api.images.fetchMultipleImages
    },
    sound: {
        fetchRandomObservationWithSound: api.sound.fetchRandomObservationWithSound,
    },
    vernacular: {
        fetchVernacular: api.vernacular.fetchVernacular
    },
    externalAPIs: {
        isINaturalistReachable: api.externalAPIs.isINaturalistReachable,
        checkINaturalistReachability: api.externalAPIs.checkINaturalistReachability,
        checkWikipediaPage: api.externalAPIs.checkWikipediaPage
    },
    utils: {
        getObservationURLFromImageURL: api.utils.getObservationURLFromImageURL
    }
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'object') {
        Object.keys(publicAPI[key]).forEach(nestedKey => {
            if (typeof publicAPI[key][nestedKey] === 'function') {
                publicAPI[key][nestedKey] = publicAPI[key][nestedKey].bind(api);
            }
        });
    }
});

export default publicAPI;

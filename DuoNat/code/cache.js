import Dexie from 'https://unpkg.com/dexie@latest/dist/dexie.mjs';

import config from './config.js';
import logger from './logger.js';

import api from './api.js';

class DuoNatCache {
    constructor() {
        this.db = new Dexie('DuoNatCache');
        this.db.version(1).stores({
            taxonInfo: 'taxonId, taxonName, vernacularName, lastUpdated',
            taxonPairs: 'pairId, lastUpdated',
            taxonHierarchy: 'taxonId, lastUpdated',
            initialPair: '++id, pairData, images',
        });
    }

    async clearAllData() {
        try {
            await this.db.delete();
            await this.db.open();
            logger.info("Dexie cache completely cleared");
        } catch (error) {
            logger.error("Error clearing Dexie cache:", error);
        }
    }

    // load a pair at startup to speed up game start
    async cacheInitialPair(pair, images) {
        try {
            await this.db.initialPair.clear();
            await this.db.initialPair.add({
                pairData: pair,
                images: images
            });
            logger.debug('Initial pair cached successfully');
        } catch (error) {
            logger.error('Error caching initial pair:', error);
        }
    }

    async getInitialPair() {
        try {
            const cachedPairs = await this.db.initialPair.toArray();
            return cachedPairs.length > 0 ? cachedPairs[0] : null;
        } catch (error) {
            logger.error('Error retrieving initial pair:', error);
            return null;
        }
    }

    async getTaxonInfo(taxonId) {
    if (taxonId === 'all') {
        let cachedInfo = await this.db.taxonInfo.toArray();
        if (cachedInfo.length > 0 && this.isCacheValid(cachedInfo[0].lastUpdated)) {
            return cachedInfo.reduce((acc, item) => {
                acc[item.taxonId] = item;
                return acc;
            }, {});
        }
        return null;
    }
    let cachedInfo = await this.db.taxonInfo.get(taxonId);
    if (cachedInfo && this.isCacheValid(cachedInfo.lastUpdated)) {
        return cachedInfo;
    }
    // If not in cache or outdated, fetch from server and update cache
    const fetchedInfo = await api.taxonomy.fetchTaxonInfoFromMongoDB(taxonId);
    if (fetchedInfo) {
        await this.db.taxonInfo.put({ ...fetchedInfo, lastUpdated: Date.now() });
    }
    return fetchedInfo;
}

    async getTaxonPair(pairId) {
        try {
            let cachedPair = await this.db.taxonPairs.get(pairId);
            if (cachedPair && this.isCacheValid(cachedPair.lastUpdated)) {
                return cachedPair;
            }
            const fetchedPair = await api.taxonomy.fetchPairById(pairId);
            if (fetchedPair) {
                if (!fetchedPair.pairId) {
                    logger.error('Fetched pair missing pairId:', fetchedPair);
                    return fetchedPair;
                }
                await this.db.taxonPairs.put({ ...fetchedPair, lastUpdated: Date.now() });
            }
            return fetchedPair;
        } catch (error) {
            logger.error('Error in getTaxonPair:', error, 'for pairId:', pairId);
            throw error;
        }
    }

    async getAllTaxonPairs() {
    let cachedPairs = await this.db.taxonPairs.toArray();
    if (cachedPairs.length > 0 && this.isCacheValid(cachedPairs[0].lastUpdated)) {
        return cachedPairs;
    }
    return null;
}

    async updateTaxonPairs(taxonPairs) {
        try {
            if (!Array.isArray(taxonPairs)) {
                logger.error('updateTaxonPairs received non-array:', taxonPairs);
                return;
            }
            
            // Validate each pair before bulk put
            const validPairs = taxonPairs.map(pair => {
                if (!pair.pairId) {
                    logger.error('Pair missing pairId:', pair);
                    return null;
                }
                return { ...pair, lastUpdated: Date.now() };
            }).filter(pair => pair !== null);

            await this.db.taxonPairs.clear();
            await this.db.taxonPairs.bulkPut(validPairs);
        } catch (error) {
            logger.error('Error in updateTaxonPairs:', error);
            throw error;
        }
    }
    async getTaxonHierarchy() {
    let cachedHierarchy = await this.db.taxonHierarchy.toArray();
    if (cachedHierarchy.length > 0 && this.isCacheValid(cachedHierarchy[0].lastUpdated)) {
        return cachedHierarchy.reduce((acc, item) => {
            acc[item.taxonId] = {
                taxonName: item.taxonName,
                vernacularName: item.vernacularName,
                rank: item.rank,
                parentId: item.parentId
            };
            return acc;
        }, {});
    }
    return null;
}

isCacheValid(lastUpdated) {
    // Consider cache valid for 10 days
    return Date.now() - lastUpdated < 24 * 60 * 60 * 1000 * 10;

}
}

const cache = new DuoNatCache();
export default cache;

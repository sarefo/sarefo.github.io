import Dexie from 'https://unpkg.com/dexie@latest/dist/dexie.mjs';

import config from './config.js';
import logger from './logger.js';

import api from './api.js';

class DuoNatCache {
    constructor() {
        this.db = new Dexie('DuoNatCache');
        this.db.version(1).stores({
            taxonInfo: 'taxonId, taxonName, vernacularName, lastUpdated',
            taxonPairs: 'pairID, lastUpdated',
            taxonHierarchy: 'taxonId, lastUpdated'
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
    async cacheInitialPair(pair) {
        await this.db.taxonPairs.put({ ...pair, lastUpdated: Date.now() });
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

    async getTaxonPair(pairID) {
    let cachedPair = await this.db.taxonPairs.get(pairID);
    if (cachedPair && this.isCacheValid(cachedPair.lastUpdated)) {
        return cachedPair;
    }
    const fetchedPair = await api.taxonomy.fetchPairByID(pairID);
    if (fetchedPair) {
        await this.db.taxonPairs.put({ ...fetchedPair, lastUpdated: Date.now() });
    }
    return fetchedPair;
}

    async getAllTaxonPairs() {
    let cachedPairs = await this.db.taxonPairs.toArray();
    if (cachedPairs.length > 0 && this.isCacheValid(cachedPairs[0].lastUpdated)) {
        return cachedPairs;
    }
    return null;
}

    async updateTaxonPairs(taxonPairs) {
    await this.db.taxonPairs.clear();
    await this.db.taxonPairs.bulkPut(
        taxonPairs.map(pair => ({ ...pair, lastUpdated: Date.now() }))
    );
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
    // Consider cache valid for 30 days
    return Date.now() - lastUpdated < 24 * 60 * 60 * 1000 * 30;

}
}

const cache = new DuoNatCache();
export default cache;

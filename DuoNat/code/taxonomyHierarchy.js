class TaxonNode {
    constructor(id, data) {
        this.id = id;
        this.taxonName = data.taxonName;
        this.vernacularName = data.vernacularName;
        this.rank = data.rank;
        this.parentId = data.parentId;
    }
}

class TaxonomyHierarchy {
    constructor(hierarchyData = null) {
        this.nodes = new Map();
        if (hierarchyData) {
            this.loadPreGeneratedHierarchy(hierarchyData);
        }
    }

    loadPreGeneratedHierarchy(hierarchy) {
        for (const [id, nodeData] of Object.entries(hierarchy)) {
            this.nodes.set(id, new TaxonNode(id, nodeData));
        }
    }

    addTaxon(taxonInfo) {
        const { ancestryIds, taxonName, rank, vernacularName } = taxonInfo;
        const id = ancestryIds[ancestryIds.length - 1].toString();
        if (!this.nodes.has(id)) {
            this.nodes.set(id, new TaxonNode(id, {
                taxonName,
                vernacularName: vernacularName || "",
                rank,
                parentId: ancestryIds[ancestryIds.length - 2]?.toString() || null
            }));
        }
    }

    getTaxonById(id) {
        if (id == null) return null;
        return this.nodes.get(id.toString()) || null;
    }
}

export default TaxonomyHierarchy;

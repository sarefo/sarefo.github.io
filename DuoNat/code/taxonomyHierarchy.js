class TaxonNode {
    constructor(id, name, rank) {
        this.id = id;
        this.name = name;
        this.rank = rank;
        this.parent = null;
        this.children = [];
    }

    addChild(child) {
        this.children.push(child);
        child.parent = this;
    }
}

class TaxonomyHierarchy {
    constructor(preGeneratedHierarchy = null) {
        this.nodes = new Map();
        if (preGeneratedHierarchy) {
            this.loadPreGeneratedHierarchy(preGeneratedHierarchy);
        }
    }

    loadPreGeneratedHierarchy(hierarchy) {
        for (const [id, nodeData] of Object.entries(hierarchy)) {
            const node = new TaxonNode(id, nodeData.name, nodeData.rank);
            this.nodes.set(id, node);
        }
        // Set up parent-child relationships
        for (const [id, nodeData] of Object.entries(hierarchy)) {
            const node = this.nodes.get(id);
            if (nodeData.parentId) {
                const parentNode = this.nodes.get(nodeData.parentId);
                if (parentNode) {
                    parentNode.addChild(node);
                }
            }
        }
    }

    addTaxon(taxonInfo) {
        const { ancestryIds, taxonName, rank } = taxonInfo;
        let currentNode = null;

        for (let i = 0; i < ancestryIds.length; i++) {
            const id = ancestryIds[i];
            if (!this.nodes.has(id)) {
                const name = id === ancestryIds[ancestryIds.length - 1] ? taxonName : `Unknown ${id}`;
                const nodeRank = id === ancestryIds[ancestryIds.length - 1] ? rank : 'Unknown';
                const newNode = new TaxonNode(id, name, nodeRank);
                this.nodes.set(id, newNode);
            }

            const node = this.nodes.get(id);
            if (currentNode && !currentNode.children.includes(node)) {
                currentNode.addChild(node);
            }
            currentNode = node;
        }
    }

    getTaxonById(id) {
        return this.nodes.get(id);
    }
}

export default TaxonomyHierarchy;

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
    constructor() {
        this.nodes = new Map();
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

import api from './api.js';
import collectionManager from './collectionManager.js';
import d3Graphs from './d3Graphs.js';
import dialogManager from './dialogManager.js';
import filtering from './filtering.js';
import logger from './logger.js';
import state from './state.js';

const phylogenySelector = {
    initialize() {
        const doneButton = document.getElementById('phylogeny-done-button');
        if (doneButton) {
            doneButton.addEventListener('click', this.handleDoneButton.bind(this));
        }

        const clearButton = document.getElementById('phylogeny-clear-button');
        if (clearButton) {
            clearButton.addEventListener('click', this.clearSelection.bind(this));
        }
    },

    async updateGraph() {
        const graphContainer = document.getElementById('phylogeny-graph-container');
        if (!graphContainer) return;

        graphContainer.innerHTML = '<div class="loading-indicator">Loading phylogeny...</div>';

        const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();

        if (!hierarchyObj || !hierarchyObj.nodes) {
            graphContainer.innerHTML = '<p>Error: Taxonomy hierarchy not loaded or invalid</p>';
            return;
        }

        try {
            // Get filtered taxon pairs and available taxon IDs
            const filters = filtering.getActiveFilters();
            const taxonPairs = await api.taxonomy.fetchTaxonPairs();

            const { phylogenyId, ...otherFilters } = filters;
            const filteredPairs = filtering.filterTaxonPairs(taxonPairs, otherFilters);
            
            const availableTaxonIds = filtering.getAvailableTaxonIds(filteredPairs);

            const rootNode = this.convertHierarchyToNestedObject(hierarchyObj, availableTaxonIds);
            const currentPhylogenyId = state.getPhylogenyId();

            graphContainer.innerHTML = '';
            const tree = await d3Graphs.createRadialTree(graphContainer, rootNode);
            if (currentPhylogenyId) {
                console.log(`Current phylogeny ID: ${currentPhylogenyId}`);
                const pathToRoot = this.getPathToRoot(hierarchyObj, currentPhylogenyId);
                if (pathToRoot.length > 0) {
                    tree.setActiveNodePath(pathToRoot);
                } else {
                    console.warn(`Path to root not found for node with id ${currentPhylogenyId}`);
                }
            }
        } catch (error) {
            logger.error('Error creating phylogeny graph:', error);
            graphContainer.innerHTML = `<p>Error creating graph: ${error.message}. Please try again.</p>`;
        }
    },

    convertHierarchyToNestedObject(hierarchyObj, availableTaxonIds) {
        const nodes = hierarchyObj.nodes;
        const nodeMap = new Map();
        let root = null;

        // First pass: create all nodes
        for (const [id, node] of nodes) {
            const newNode = {
                id: id,
                taxonName: node.taxonName,
                vernacularName: node.vernacularName,
                rank: node.rank,
                children: []
            };
            nodeMap.set(id, newNode);
            if (node.parentId === null) {
                root = newNode;
            }
        }

        // Second pass: build the tree structure
        for (const [id, node] of nodes) {
            if (node.parentId !== null) {
                const parent = nodeMap.get(node.parentId);
                if (parent) {
                    parent.children.push(nodeMap.get(id));
                } else {
                    console.warn(`Parent node not found for ${node.taxonName} (ID: ${id})`);
                }
            }
        }

        if (!root) {
            console.warn('No root node found, using first node as root');
            root = nodeMap.values().next().value;
        }

        // Filter out nodes that don't have available taxon sets
        const filterNodes = (node) => {
            node.children = node.children.filter(child => {
                const hasAvailableTaxa = this.nodeHasAvailableTaxa(child, availableTaxonIds);
                if (hasAvailableTaxa) {
                    filterNodes(child);
                    return true;
                }
                return false;
            });
        };

        filterNodes(root);

        return root;
    },

    nodeHasAvailableTaxa(node, availableTaxonIds) {
        if (!Array.isArray(availableTaxonIds)) {
            console.warn('availableTaxonIds is not an array:', availableTaxonIds);
            return false;
        }
        if (availableTaxonIds.includes(node.id)) {
            return true;
        }
        return node.children.some(child => this.nodeHasAvailableTaxa(child, availableTaxonIds));
    },

    getPathToRoot(hierarchyObj, nodeId) {
        const path = [];
        let currentId = nodeId;

        while (currentId != null) {
            const node = hierarchyObj.getTaxonById(currentId);
            if (node) {
                path.unshift(node.id);
                currentId = node.parentId;
            } else {
                console.warn(`Node with id ${currentId} not found in hierarchy`);
                break;
            }
        }

        return path;
    },

    findNodeById(node, id) {
        if (node.id === id) {
            return node;
        }
        if (node.children) {
            for (const child of node.children) {
                const found = this.findNodeById(child, id);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    },

    handleDoneButton() {
        const activeNodeId = d3Graphs.getActiveNodeId();
        if (activeNodeId) {
            state.setPhylogenyId(activeNodeId);
            logger.debug(`Phylogeny ID set to: ${activeNodeId}`);
        } else {
            // If no node is selected, clear the phylogeny filter
            state.setPhylogenyId(null);
            logger.debug('Phylogeny filter cleared');
        }
        collectionManager.updateFilterSummary(); // Add this line
        collectionManager.onFiltersChanged();
        dialogManager.closeDialog('phylogeny-dialog');
    },

    clearSelection() {
        state.setPhylogenyId(null);
        logger.debug('Phylogeny filter cleared');
        collectionManager.updateFilterSummary();
        this.updateGraph();
    },
};

const publicAPI = {
    initialize: phylogenySelector.initialize.bind(phylogenySelector),
    updateGraph: phylogenySelector.updateGraph.bind(phylogenySelector),
    clearSelection: phylogenySelector.clearSelection.bind(phylogenySelector),
};

export default publicAPI;

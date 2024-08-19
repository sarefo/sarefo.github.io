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

        this.search.initializeSearch();
    },

    updateActiveTaxonDisplay(nodeId) {
        const activeNameEl = document.getElementById('active-taxon-name');
        const activeVernacularEl = document.getElementById('active-taxon-vernacular');

        if (nodeId) {
            const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();
            const node = hierarchyObj.getTaxonById(nodeId);
            if (node) {
                activeNameEl.textContent = node.taxonName;
                activeVernacularEl.textContent = node.vernacularName ? ` (${node.vernacularName})` : '';
            } else {
                activeNameEl.textContent = 'Unknown Taxon';
                activeVernacularEl.textContent = '';
            }
        } else {
            activeNameEl.textContent = 'No taxon selected';
            activeVernacularEl.textContent = '';
        }
    },

    async updateGraph(pathToRoot = null) {
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

            const rootNode = this.convertHierarchyToNestedObject(hierarchyObj, availableTaxonIds, filteredPairs);
            
            const currentPhylogenyId = state.getPhylogenyId();

            graphContainer.innerHTML = '';
            const tree = await d3Graphs.createRadialTree(graphContainer, rootNode);

            tree.onNodeSelect = (nodeId) => {
                this.updateActiveTaxonDisplay(nodeId);
            };

            if (pathToRoot) {
                // If a search result path is provided, use it
                tree.setActiveNodePath(pathToRoot);
                this.updateActiveTaxonDisplay(pathToRoot[pathToRoot.length - 1]);
            } else if (currentPhylogenyId) {
                // If no search result, use the current phylogeny ID
                console.log(`Current phylogeny ID: ${currentPhylogenyId}`);
                const currentPathToRoot = this.getPathToRoot(hierarchyObj, currentPhylogenyId);
                if (currentPathToRoot.length > 0) {
                    tree.setActiveNodePath(currentPathToRoot);
                } else {
                    console.warn(`Path to root not found for node with id ${currentPhylogenyId}`);
                }
                this.updateActiveTaxonDisplay(currentPhylogenyId);
            }
        } catch (error) {
            logger.error('Error creating phylogeny graph:', error);
            graphContainer.innerHTML = `<p>Error creating graph: ${error.message}. Please try again.</p>`;
        }
    },

    convertHierarchyToNestedObject(hierarchyObj, availableTaxonIds, taxonPairs) {
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
                children: [],
                pairCount: 0
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

        // Filter nodes and count pairs
        this.filterNodesAndCountPairs(root, availableTaxonIds, taxonPairs);

        return root;
    },

    filterNodesAndCountPairs(node, availableTaxonIds, taxonPairs) {
        const nodeDescendantIds = new Set();

        // Add current node ID if it's in availableTaxonIds
        if (availableTaxonIds.includes(node.id)) {
            nodeDescendantIds.add(node.id);
        }

        // Filter children and get descendant IDs
        node.children = node.children.filter(child => {
            const childDescendantIds = this.filterNodesAndCountPairs(child, availableTaxonIds, taxonPairs);
            if (childDescendantIds.size > 0) {
                child.pairCount = childDescendantIds.size;  // Set child's pair count
                for (const id of childDescendantIds) {
                    nodeDescendantIds.add(id);
                }
                return true;
            }
            return false;
        });

        // Count pairs for this node
        node.pairCount = taxonPairs.filter(pair => 
            pair.taxa.some(taxonId => nodeDescendantIds.has(taxonId.toString())) &&
            pair.taxa.some(taxonId => !nodeDescendantIds.has(taxonId.toString()))
        ).length;

        // If this node has no pairs but has children, sum up children's pair counts
        if (node.pairCount === 0 && node.children.length > 0) {
            node.pairCount = node.children.reduce((sum, child) => sum + child.pairCount, 0);
        }

        return nodeDescendantIds;
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
        this.updateGraph();
        collectionManager.updateFilterSummary();
        collectionManager.onFiltersChanged();
    },

    search: {
        initializeSearch() {
            const searchInput = document.getElementById('phylogeny-search');
            const clearSearchButton = document.getElementById('clear-phylogeny-search');
            const searchResults = document.getElementById('phylogeny-search-results');

            if (searchInput) {
                searchInput.addEventListener('input', this.handleSearch.bind(this));
                searchInput.addEventListener('focus', () => searchResults.style.display = 'block');
                searchInput.addEventListener('blur', () => setTimeout(() => searchResults.style.display = 'none', 200));
            }

            if (clearSearchButton) {
                clearSearchButton.addEventListener('click', this.handleClearSearch.bind(this));
            }

            if (searchResults) {
                searchResults.addEventListener('click', this.handleSearchResultClick.bind(this));
            }
        },

        handleSearch(event) {
            const searchTerm = event.target.value.trim().toLowerCase();
            this.updateClearButtonVisibility(searchTerm);

            if (searchTerm.length < 2) {
                this.clearSearchResults();
                return;
            }

            const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();
            const matchingNodes = this.searchHierarchy(hierarchyObj, searchTerm);

            this.displaySearchResults(matchingNodes.slice(0, 3));
        },

        searchHierarchy(hierarchyObj, searchTerm) {
            return Object.values(hierarchyObj.nodes)
                .filter(node => 
                    node.taxonName.toLowerCase().includes(searchTerm) ||
                    (node.vernacularName && node.vernacularName.toLowerCase().includes(searchTerm))
                )
                .sort((a, b) => {
                    // Prioritize exact matches and matches at the start of the string
                    const aScore = this.getMatchScore(a, searchTerm);
                    const bScore = this.getMatchScore(b, searchTerm);
                    return bScore - aScore;
                });
        },

        getMatchScore(node, searchTerm) {
            let score = 0;
            if (node.taxonName.toLowerCase() === searchTerm) score += 3;
            if (node.taxonName.toLowerCase().startsWith(searchTerm)) score += 2;
            if (node.vernacularName && node.vernacularName.toLowerCase() === searchTerm) score += 3;
            if (node.vernacularName && node.vernacularName.toLowerCase().startsWith(searchTerm)) score += 2;
            return score;
        },

        displaySearchResults(results) {
            const searchResults = document.getElementById('phylogeny-search-results');
            if (!searchResults) return;

            searchResults.innerHTML = '';
            searchResults.style.display = results.length > 0 ? 'block' : 'none';

            results.forEach(node => {
                const resultItem = document.createElement('div');
                resultItem.className = 'phylogeny-dialog__search-result';
                resultItem.textContent = `${node.taxonName}${node.vernacularName ? ` (${node.vernacularName})` : ''}`;
                resultItem.dataset.nodeId = node.id;
                searchResults.appendChild(resultItem);
            });
        },

        clearSearchResults() {
            const searchResults = document.getElementById('phylogeny-search-results');
            if (searchResults) {
                searchResults.innerHTML = '';
                searchResults.style.display = 'none';
            }
        },

        handleSearchResultClick(event) {
            const nodeId = event.target.dataset.nodeId;
            if (nodeId) {
                const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();
                const pathToRoot = phylogenySelector.getPathToRoot(hierarchyObj, nodeId);
                phylogenySelector.updateGraph(pathToRoot);
                this.clearSearchResults();
            }
        },

        updateClearButtonVisibility(searchTerm) {
            const clearButton = document.getElementById('clear-phylogeny-search');
            if (clearButton) {
                clearButton.style.display = searchTerm.length > 0 ? 'block' : 'none';
            }
        },

        handleClearSearch() {
            const searchInput = document.getElementById('phylogeny-search');
            if (searchInput) {
                searchInput.value = '';
                this.updateClearButtonVisibility('');
                this.clearSearchResults();
                phylogenySelector.updateGraph();
            }
        },
    }
};

const publicAPI = {
    initialize: phylogenySelector.initialize.bind(phylogenySelector),
    updateGraph: phylogenySelector.updateGraph.bind(phylogenySelector),
    clearSelection: phylogenySelector.clearSelection.bind(phylogenySelector),
};

export default publicAPI;

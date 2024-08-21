import api from './api.js';
import collectionManager from './collectionManager.js';
import d3Graphs from './d3Graphs.js';
import dialogManager from './dialogManager.js';
import filtering from './filtering.js';
import logger from './logger.js';
import state from './state.js';
//import utils from './utils.js';

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

        const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();

        const toggleViewButton = document.getElementById('toggle-view-button');
        if (toggleViewButton) {
            toggleViewButton.addEventListener('click', this.toggleView.bind(this));
        }

        const toggleNamesButton = document.getElementById('toggle-names-button');
        if (toggleNamesButton) {
            toggleNamesButton.addEventListener('click', this.toggleNameDisplay.bind(this));
        }


        this.currentView = 'graph';

        this.search.initializeSearch();
    },

    toggleView() {
        const graphContainer = document.getElementById('phylogeny-graph-container');
        const cloudContainer = document.getElementById('phylogeny-cloud-container');
        const toggleButton = document.getElementById('toggle-view-button');

        if (this.currentView === 'graph') {
            graphContainer.style.display = 'none';
            cloudContainer.style.display = 'flex';
            toggleButton.textContent = 'Switch to Graph View';
            this.currentView = 'cloud';
            this.currentActiveNodeId = state.getCurrentActiveNodeId();
            phylogenySelector.cloud.renderCloudView();
        } else {
            graphContainer.style.display = 'flex';
            cloudContainer.style.display = 'none';
            toggleButton.textContent = 'Switch to Cloud View';
            this.currentView = 'graph';
            if (this.currentActiveNodeId) {
                const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();
                const pathToRoot = this.getPathToRoot(hierarchyObj, this.currentActiveNodeId);
                this.updateGraph(pathToRoot);
            } else {
                this.updateGraph();
            }
        }
    },

    toggleNameDisplay() {
        const showVernacular = !state.getShowVernacularNames();
        state.setShowVernacularNames(showVernacular);
        const toggleButton = document.getElementById('toggle-names-button');
        toggleButton.textContent = showVernacular ? 'Show Taxonomic Names' : 'Show Vernacular Names';
        
        // Update the current view
        if (this.currentView === 'graph') {
            this.updateGraph();
        } else {
            this.cloud.renderCloudView();
        }
    },

    cloud: {
        scaleValue(value, fromMin, fromMax, toMin, toMax) {
                return ((value - fromMin) / (fromMax - fromMin)) * (toMax - toMin) + toMin;
        },

        async renderCloudView() {
            const cloudContainer = document.getElementById('phylogeny-cloud-container');
            cloudContainer.innerHTML = '<div class="loading-indicator">Loading cloud view...</div>';

            try {
                const filters = filtering.getActiveFilters();
                const taxonPairs = await api.taxonomy.fetchTaxonPairs();
                const filteredPairs = filtering.filterTaxonPairs(taxonPairs, filters);
                const availableTaxonIds = filtering.getAvailableTaxonIds(filteredPairs);

                const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();
                let taxonCounts = this.getTaxonCounts(filteredPairs, hierarchyObj);

                // Filter taxa based on the active node
                const currentActiveNodeId = state.getCurrentActiveNodeId();
                if (currentActiveNodeId) {
                    const activeNode = hierarchyObj.getTaxonById(currentActiveNodeId);
                    if (activeNode) {
                        taxonCounts = this.filterTaxaByActiveNode(taxonCounts, activeNode, hierarchyObj);
                    }
                }

                // Sort taxa by count and take top 40
                const topTaxa = Object.entries(taxonCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 20);

                cloudContainer.innerHTML = '';
                topTaxa.forEach(([taxonId, count]) => {
                    const taxon = hierarchyObj.getTaxonById(taxonId);
                    if (taxon) {
                        const tagElement = this.createCloudTag(taxon, count, Math.max(...topTaxa.map(t => t[1])));
                        cloudContainer.appendChild(tagElement);
                    }
                });
            } catch (error) {
                logger.error('Error creating cloud view:', error);
                cloudContainer.innerHTML = `<p>Error creating cloud view: ${error.message}. Please try again.</p>`;
            }
        },

        filterTaxaByActiveNode(taxonCounts, activeNode, hierarchyObj) {
            const filteredCounts = {};
            const activeNodeDescendants = new Set();

            // Helper function to get all descendants of a node
            const getDescendants = (nodeId) => {
                const descendants = [];
                const stack = [nodeId];
                while (stack.length > 0) {
                    const currentId = stack.pop();
                    descendants.push(currentId);
                    const children = Array.from(hierarchyObj.nodes.values())
                        .filter(node => node.parentId === currentId)
                        .map(node => node.id);
                    stack.push(...children);
                }
                return descendants;
            };

            // Get all descendants of the active node
            getDescendants(activeNode.id).forEach(id => activeNodeDescendants.add(id));

            // Filter taxon counts to only include descendants of the active node
            for (const [taxonId, count] of Object.entries(taxonCounts)) {
                if (activeNodeDescendants.has(taxonId) && taxonId !== activeNode.id) {
                    filteredCounts[taxonId] = count;
                }
            }

            return filteredCounts;
        },

        getTaxonCounts(filteredPairs, hierarchyObj) {
            const taxonCounts = {};
            filteredPairs.forEach(pair => {
                pair.taxa.forEach(taxonId => {
                    let currentTaxon = hierarchyObj.getTaxonById(taxonId);
                    while (currentTaxon && currentTaxon.id !== "48460") { // Stop at Life, don't include it
                        taxonCounts[currentTaxon.id] = (taxonCounts[currentTaxon.id] || 0) + 1;
                        currentTaxon = hierarchyObj.getTaxonById(currentTaxon.parentId);
                    }
                });
            });
            return taxonCounts;
        },

        createCloudTag(taxon, count, maxCount) {
            const size = this.scaleValue(count, 1, maxCount, 14, 36);
            const tagElement = document.createElement('div');
            tagElement.className = 'phylogeny-cloud__tag';
            tagElement.style.fontSize = `${size}px`;

            const showVernacular = state.getShowVernacularNames();
            const nameElement = document.createElement('span');
            
            if (showVernacular && taxon.vernacularName && taxon.vernacularName !== "N/a") {
                nameElement.textContent = taxon.vernacularName;
                nameElement.className = 'phylogeny-cloud__vernacular-name';
                
                // Add scientific name as title for reference
                nameElement.title = taxon.taxonName;
            } else {
                nameElement.textContent = taxon.taxonName;
                nameElement.className = 'phylogeny-cloud__scientific-name';
                
                // Add vernacular name as title if available
                if (taxon.vernacularName && taxon.vernacularName !== "N/a") {
                    nameElement.title = taxon.vernacularName;
                }
            }
            
            tagElement.appendChild(nameElement);

            tagElement.addEventListener('click', () => this.handleCloudTagClick(taxon.id));
            return tagElement;
        },

        handleCloudTagClick(taxonId) {
            state.setCurrentActiveNodeId(taxonId); // Update the active node
            phylogenySelector.toggleView(); // Switch back to graph view
            const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();
            const pathToRoot = phylogenySelector.getPathToRoot(hierarchyObj, taxonId);
            
            // Use setTimeout to ensure the graph container is visible before updating
            setTimeout(() => {
                phylogenySelector.updateGraph(pathToRoot);
                if (this.onNodeSelect) {
                    this.onNodeSelect(taxonId);
                }
            }, 0);
        },

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
            const tree = await d3Graphs.createRadialTree(graphContainer, rootNode, state.getShowVernacularNames());

            tree.onNodeSelect = (nodeId) => {
                this.updateActiveTaxonDisplay(nodeId);
            };

            if (pathToRoot) {
                // If a search result path is provided, use it
                tree.setActiveNodePath(pathToRoot);
                this.updateActiveTaxonDisplay(pathToRoot[pathToRoot.length - 1]);
            } else if (currentPhylogenyId) {
                // If no search result, use the current phylogeny ID
                //console.log(`Current phylogeny ID: ${currentPhylogenyId}`);
                const currentPathToRoot = this.getPathToRoot(hierarchyObj, currentPhylogenyId);
                if (currentPathToRoot.length > 0) {
                    tree.setActiveNodePath(currentPathToRoot);
                } else {
                    logger.warn(`Path to root not found for node with id ${currentPhylogenyId}`);
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
                    logger.warn(`Parent node not found for ${node.taxonName} (ID: ${id})`);
                }
            }
        }

        if (!root) {
            logger.warn('No root node found, using first node as root');
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
        /*if (!Array.isArray(availableTaxonIds)) {
            logger.warn('availableTaxonIds is not an array:', availableTaxonIds);
            return false;
        }*/
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
                logger.warn(`Node with id ${currentId} not found in hierarchy`);
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
                searchInput.addEventListener('input', (event) => this.handleSearch(event));
                searchInput.addEventListener('focus', () => searchResults.style.display = 'block');
                searchInput.addEventListener('blur', () => setTimeout(() => searchResults.style.display = 'none', 200));
            }

            if (clearSearchButton) {
                clearSearchButton.addEventListener('click', () => this.handleClearSearch());
            }

            if (searchResults) {
                searchResults.addEventListener('click', (event) => this.handleSearchResultClick(event));
            }
        },

        async handleSearch(event) {
            const searchTerm = event.target.value.trim().toLowerCase();
            this.updateClearButtonVisibility(searchTerm);

            if (searchTerm.length === 0) {
                this.clearSearchResults();
                return;
            }

            if (searchTerm.length < 3) {
                return;
            }

            try {
                const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();

                if (!hierarchyObj || !hierarchyObj.nodes || hierarchyObj.nodes.size === 0) {
                    logger.error('Hierarchy object is invalid or empty');
                    return;
                }

                const filters = filtering.getActiveFilters();
                const taxonPairs = await api.taxonomy.fetchTaxonPairs();
                const filteredPairs = filtering.filterTaxonPairs(taxonPairs, filters);
                const availableTaxonIds = filtering.getAvailableTaxonIds(filteredPairs);

                const matchingNodes = this.searchHierarchy(hierarchyObj, searchTerm, availableTaxonIds);

                this.displaySearchResults(matchingNodes.slice(0, 5), availableTaxonIds);
            } catch (error) {
                logger.error('Error during search:', error);
            }
        },

        searchHierarchy(hierarchyObj, searchTerm, availableTaxonIds) {
            const matchingNodes = Array.from(hierarchyObj.nodes.values())
                .filter(node => {
                    const matchesTaxonName = node.taxonName.toLowerCase().includes(searchTerm);
                    const matchesVernacularName = node.vernacularName && node.vernacularName.toLowerCase().includes(searchTerm);
                    
                    if (matchesTaxonName || matchesVernacularName) {
                        const isAvailable = this.isNodeOrDescendantAvailable(node, availableTaxonIds, hierarchyObj);
                        return isAvailable;
                    }
                    
                    return false;
                });

            return matchingNodes;
        },

        isNodeOrDescendantAvailable(node, availableTaxonIds, hierarchyObj) {
            if (availableTaxonIds.includes(node.id)) {
                return true;
            }

            const stack = [node.id];
            const visited = new Set();

            while (stack.length > 0) {
                const currentId = stack.pop();
                if (visited.has(currentId)) continue;
                visited.add(currentId);

                if (availableTaxonIds.includes(currentId)) {
                    return true;
                }

                const children = Array.from(hierarchyObj.nodes.values())
                    .filter(n => n.parentId === currentId)
                    .map(n => n.id);
                stack.push(...children);
            }

            return false;
        },

        getMatchScore(node, searchTerm) {
            let score = 0;
            if (node.taxonName.toLowerCase() === searchTerm) score += 3;
            if (node.taxonName.toLowerCase().startsWith(searchTerm)) score += 2;
            if (node.vernacularName && node.vernacularName.toLowerCase() === searchTerm) score += 3;
            if (node.vernacularName && node.vernacularName.toLowerCase().startsWith(searchTerm)) score += 2;
            return score;
        },

        displaySearchResults(results, availableTaxonIds) {
            const searchResults = document.getElementById('phylogeny-search-results');

            searchResults.innerHTML = '';
            if (results.length > 0) {
                searchResults.style.display = 'block';
                results.forEach(node => {
                    const resultItem = document.createElement('div');
                    resultItem.className = 'phylogeny-dialog__search-result';
                    resultItem.textContent = `${node.taxonName}${node.vernacularName ? ` (${node.vernacularName})` : ''}`;
                    /*if (!availableTaxonIds.includes(node.id)) {
                        resultItem.textContent += ' (Higher taxon)';
                        resultItem.classList.add('phylogeny-dialog__search-result--higher-taxon');
                    }*/
                    resultItem.dataset.nodeId = node.id;
                    searchResults.appendChild(resultItem);
                });
            } else {
                searchResults.style.display = 'none';
            }
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
    toggleView: phylogenySelector.toggleView.bind(phylogenySelector),
};

export default publicAPI;

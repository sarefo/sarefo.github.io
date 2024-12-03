import api from '../api.js';
import logger from '../logger.js';
import state from '../state.js';
import utils from '../utils.js';

import d3Graphs from '../d3Graphs.js';
import filtering from '../filtering.js';

import collectionManager from './collectionManager.js';
import dialogManager from './dialogManager.js';

const phylogenySelector = {
    currentView: 'graph',
    currentActiveNodeId: null,

    initialize() {
        this.uiControls.initialize();
        this.search.initialize();
        this.uiControls.updateToggleState();
    },

    focusSearchInput() {
        this.uiControls.focusSearchInput();
    },

    // Modules:
    // - graphView
    // - cloudView
    // - search
    // - uiControls

    graphView: {
        async updateGraph(pathToRoot = null) {
            const graphContainer = document.getElementById('phylogeny-graph-container');
            if (!graphContainer) return;

            graphContainer.innerHTML = '<div class="loading-indicator">Loading phylogeny...</div>';

            const toggleNamesCheckbox = document.getElementById('name-toggle');
            if (toggleNamesCheckbox) {
                toggleNamesCheckbox.checked = state.getShowTaxonomicNames();
            }

            const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();

            if (!hierarchyObj || !hierarchyObj.nodes) {
                graphContainer.innerHTML = '<p>Error: Taxonomy hierarchy not loaded or invalid</p>';
                return;
            }

            try {
                // Get filtered taxon pairs and available taxon IDs
                const filters = filtering.getActiveFilters();
                const taxonPairs = await api.taxonomy.fetchTaxonPairs();

                const { phylogenyID, ...otherFilters } = filters;
                const filteredPairs = filtering.filterTaxonPairs(taxonPairs, otherFilters);
                
                const availableTaxonIds = filtering.getAvailableTaxonIds(filteredPairs);

                const rootNode = this.convertHierarchyToNestedObject(hierarchyObj, availableTaxonIds, filteredPairs);
                
                const currentPhylogenyId = state.getPhylogenyID();

                graphContainer.innerHTML = '';
                const tree = await d3Graphs.createTree(graphContainer, rootNode, state.getShowTaxonomicNames());

                tree.onNodeSelect = (nodeId) => {
                    phylogenySelector.uiControls.updateActiveTaxonDisplay(nodeId);
                };

                if (pathToRoot) {
                    // If a search result path is provided, use it
                    tree.setActiveNodePath(pathToRoot);
                    phylogenySelector.uiControls.updateActiveTaxonDisplay(pathToRoot[pathToRoot.length - 1]);
                } else if (currentPhylogenyId) {
                    // If no search result, use the current phylogeny ID
                    const currentPathToRoot = this.getPathToRoot(hierarchyObj, currentPhylogenyId);
                    if (currentPathToRoot.length > 0) {
                        tree.setActiveNodePath(currentPathToRoot);
                    } else {
                        logger.warn(`Path to root not found for node with id ${currentPhylogenyId}`);
                    }
                    phylogenySelector.uiControls.updateActiveTaxonDisplay(currentPhylogenyId);
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
    },

    cloudView: {
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

                // Step 1: Select top taxa based on count
                const topTaxa = Object.entries(taxonCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 20)
                    .map(([taxonId, count]) => ({ taxonId, count }));

                // Step 2: Order the selected taxa based on their position in the taxonomy
                const orderedTaxa = this.orderTaxaByHierarchy(topTaxa, hierarchyObj);

                cloudContainer.innerHTML = '';
                orderedTaxa.forEach(({ taxonId, count }) => {
                    const taxon = hierarchyObj.getTaxonById(taxonId);
                    if (taxon) {
                        const tagElement = this.createCloudTag(taxon, count, Math.max(...orderedTaxa.map(t => t.count)));
                        cloudContainer.appendChild(tagElement);
                    }
                });
            } catch (error) {
                logger.error('Error creating cloud view:', error);
                cloudContainer.innerHTML = `<p>Error creating cloud view: ${error.message}. Please try again.</p>`;
            }
        },

        orderTaxaByHierarchy(taxa, hierarchyObj) {
            // Helper function to get the full path of a taxon
            const getPath = (taxonId) => {
                const path = [];
                let currentId = taxonId;
                while (currentId) {
                    path.unshift(currentId);
                    const node = hierarchyObj.getTaxonById(currentId);
                    currentId = node ? node.parentId : null;
                }
                return path;
            };

            // Sort taxa based on their full paths
            return taxa.sort((a, b) => {
                const pathA = getPath(a.taxonId);
                const pathB = getPath(b.taxonId);
                
                for (let i = 0; i < Math.min(pathA.length, pathB.length); i++) {
                    if (pathA[i] !== pathB[i]) {
                        return pathA[i].localeCompare(pathB[i]);
                    }
                }
                return pathA.length - pathB.length;
            });
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

            const showTaxonomic = state.getShowTaxonomicNames();
            const nameElement = document.createElement('span');
            
            if (!showTaxonomic && taxon.vernacularName && taxon.vernacularName !== "-") {
                nameElement.textContent = taxon.vernacularName;
                nameElement.className = 'phylogeny-cloud__vernacular-name';
                nameElement.title = taxon.taxonName;
            } else {
                nameElement.textContent = taxon.taxonName;
                nameElement.className = 'phylogeny-cloud__scientific-name';
                if (taxon.rank === 'Genus' || taxon.rank === 'Species') {
                    nameElement.style.fontStyle = 'italic';
                }
                if (taxon.vernacularName && taxon.vernacularName !== "-") {
                    nameElement.title = utils.string.truncate(taxon.vernacularName, 24);
                }
            }
            
            tagElement.appendChild(nameElement);

            tagElement.addEventListener('click', () => this.handleCloudTagClick(taxon.id));
            return tagElement;
        },

        handleCloudTagClick(taxonId) {
            state.setCurrentActiveNodeId(taxonId); // Update the active node
            phylogenySelector.uiControls.toggleView(false); // Switch to graph view
            const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();
            const pathToRoot = phylogenySelector.graphView.getPathToRoot(hierarchyObj, taxonId);
            
            // Use setTimeout to ensure the graph container is visible before updating
            setTimeout(() => {
                phylogenySelector.graphView.updateGraph(pathToRoot);
                if (this.onNodeSelect) {
                    this.onNodeSelect(taxonId);
                }
            }, 0);
        },
    },

    search: {
        initialize() {
            const searchInput = document.getElementById('phylogeny-search');
            const clearSearchButton = document.getElementById('clear-phylogeny-search');
            const searchResults = document.getElementById('phylogeny-search-results');

            if (searchInput) {
                searchInput.addEventListener('input', (event) => {
                    this.handleSearch(event);
                });
                searchInput.addEventListener('focus', () => {
                    searchResults.style.display = 'block';
                });
                searchInput.addEventListener('blur', () => {
                    setTimeout(() => searchResults.style.display = 'none', 200);
                });
            }

            if (clearSearchButton) {
                clearSearchButton.addEventListener('click', () => {
                    this.handleClearSearch();
                });
            }

            if (searchResults) {
                searchResults.addEventListener('click', (event) => {
                    this.handleSearchResultClick(event);
                });
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
                    const matchesVernacularName = node.vernacularName && 
                                                node.vernacularName !== "-" && 
                                                node.vernacularName.toLowerCase().includes(searchTerm);
                    
                    // Remove the availability check to search the whole tree
                    return matchesTaxonName || matchesVernacularName;
                })
                // Sort results by relevance
                .sort((a, b) => {
                    const scoreA = this.getMatchScore(a, searchTerm);
                    const scoreB = this.getMatchScore(b, searchTerm);
                    return scoreB - scoreA;
                });

            return matchingNodes;
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
            const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();

            searchResults.innerHTML = '';
            if (results.length > 0) {
                searchResults.style.display = 'block';
                results.forEach(node => {
                    const resultItem = document.createElement('div');
                    resultItem.className = 'phylogeny-dialog__search-result';
                    resultItem.dataset.nodeId = node.id;
                    
                    // Create container for name and path
                    const nameContainer = document.createElement('div');
                    
                    // Add taxon name
                    const taxonNameSpan = document.createElement('span');
                    taxonNameSpan.textContent = node.taxonName;
                    if (node.rank === 'Genus' || node.rank === 'Species') {
                        taxonNameSpan.style.fontStyle = 'italic';
                    }
                    nameContainer.appendChild(taxonNameSpan);
                    
                    // Add vernacular name if available
                    if (node.vernacularName && node.vernacularName !== "-") {
                        const vernacularSpan = document.createElement('span');
                        vernacularSpan.textContent = ` (${utils.string.truncate(node.vernacularName, 24)})`;
                        nameContainer.appendChild(vernacularSpan);
                    }

                    // Add taxonomy path
                    const pathContainer = document.createElement('div');
                    pathContainer.className = 'phylogeny-dialog__search-result-path';
                    
                    // Get path to root
                    let currentNode = node;
                    const path = [];
                    while (currentNode && currentNode.parentId) {
                        const parent = hierarchyObj.getTaxonById(currentNode.parentId);
                        if (parent) {
                            path.unshift(parent.vernacularName !== "-" ? parent.vernacularName : parent.taxonName);
                        }
                        currentNode = parent;
                        if (path.length >= 2) break; // Show only last two ancestors
                    }
                    
                    if (path.length > 0) {
                        pathContainer.textContent = path.join(" > ");
                    }
                    
                    resultItem.appendChild(nameContainer);
                    resultItem.appendChild(pathContainer);
                    searchResults.appendChild(resultItem);
                });
            } else {
                searchResults.style.display = 'none';
            }
        },

        clearSearchResults() {
            const searchResults = document.getElementById('phylogeny-search-results');
            const searchInput = document.getElementById('phylogeny-search');
            
            if (searchResults) {
                searchResults.innerHTML = '';
                searchResults.style.display = 'none';
            }
            
            if (searchInput) {
                searchInput.value = '';
                // Make sure the clear button is hidden
                this.updateClearButtonVisibility('');
            }
        },

        handleSearchResultClick(event) {
            let target = event.target;
            
            // Keep going up until we find the search result div with the nodeId
            while (target && !target.dataset.nodeId && target.parentElement) {
                target = target.parentElement;
            }
            
            const nodeId = target?.dataset.nodeId;
            if (nodeId) {
                // Update phylogeny ID in state
                state.setPhylogenyID(nodeId);
                
                // Update current active node
                state.setCurrentActiveNodeId(nodeId);
                
                // Update active taxon display
                phylogenySelector.uiControls.updateActiveTaxonDisplay(nodeId);
                
                // Get and display the path
                const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();
                const pathToRoot = phylogenySelector.graphView.getPathToRoot(hierarchyObj, nodeId);
                
                // Update the graph view
                phylogenySelector.graphView.updateGraph(pathToRoot);
                
                // Clear the search
                this.clearSearchResults();
                
                // Update any listeners
                if (this.onNodeSelect) {
                    this.onNodeSelect(nodeId);
                }
                
                // Log for debugging
                logger.debug('Selected node from search:', nodeId);
            } else {
                logger.warn('No nodeId found for clicked element');
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
                phylogenySelector.graphView.updateGraph();
            }
        }
    },

    uiControls: {
        initialize() {
            const doneButton = document.getElementById('phylogeny-done-button');
            if (doneButton) {
                doneButton.addEventListener('click', this.handleDoneButton.bind(this));
            }

            document.querySelectorAll('.phylogeny-icon').forEach(icon => {
                icon.addEventListener('click', this.handleIconClick.bind(this));
            });

            const clearButton = document.getElementById('phylogeny-clear-button');
            if (clearButton) {
                clearButton.addEventListener('click', this.clearSelection.bind(this));
            }

            const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();

            const toggleViewCheckbox = document.getElementById('view-toggle');
            if (toggleViewCheckbox) {
                toggleViewCheckbox.addEventListener('change', this.toggleView.bind(this));
            }

            this.updateToggleState();
            const toggleNamesCheckbox = document.getElementById('phylogeny-name-toggle');
            toggleNamesCheckbox.addEventListener('change', this.toggleNameDisplay.bind(this));

            const clearFiltersButton = document.getElementById('phylogeny-clear-filters-button');
            if (clearFiltersButton) {
                clearFiltersButton.addEventListener('click', this.handleClearFilters);
            }

            this.currentView = 'graph';

            phylogenySelector.search.initialize();
        },

        handleIconClick(event) {
            const iconId = event.currentTarget.id;
            let phylogenyID;
            
            // Map icon IDs to phylogeny IDs
            const iconToPhylogenyMap = {
                'icon-birds': '3',
                'icon-mammals': '40151',
                'icon-fishes': '47178',
                'icon-reptiles': '26036',
                'icon-amphibians': '20978',
                'icon-insects': '47158',
                'icon-arachnids': '47119',
                'icon-molluscs': '47115',
                'icon-plants': '47126',
                'icon-fungi': '47170'
            };

            phylogenyID = iconToPhylogenyMap[iconId];

            if (phylogenyID) {
                state.setPhylogenyID(phylogenyID);
                state.setCurrentActiveNodeId(phylogenyID);
                this.updateActiveTaxonDisplay(phylogenyID);
                
                // Update views
                if (this.currentView === 'graph') {
                    const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();
                    const pathToRoot = phylogenySelector.graphView.getPathToRoot(hierarchyObj, phylogenyID);
                    phylogenySelector.graphView.updateGraph(pathToRoot);
                } else {
                    phylogenySelector.cloudView.renderCloudView();
                }

                // Update icon states
                document.querySelectorAll('.phylogeny-icon').forEach(icon => {
                    icon.classList.remove('active');
                });
                event.currentTarget.classList.add('active');
            }
        },

        focusSearchInput() {
            const searchInput = document.getElementById('phylogeny-search');
            if (searchInput) {
                setTimeout(() => {
                    searchInput.focus();
                    if (searchInput.value.length > 0) {
                        searchInput.select();
                    }
                }, 100);
            }
        },

        toggleView(eventOrForceState) {
            const graphContainer = document.getElementById('phylogeny-graph-container');
            const cloudContainer = document.getElementById('phylogeny-cloud-container');
            const toggleViewCheckbox = document.getElementById('view-toggle');

            let isCloud;
            if (typeof eventOrForceState === 'boolean') {
                // If a boolean is passed, use it directly
                isCloud = eventOrForceState;
                toggleViewCheckbox.checked = isCloud;
            } else if (eventOrForceState && eventOrForceState.target) {
                // If it's an event, use the checkbox's checked state
                isCloud = eventOrForceState.target.checked;
            } else {
                // If no argument is passed, toggle the current state
                isCloud = this.currentView !== 'cloud';
                toggleViewCheckbox.checked = isCloud;
            }

            if (isCloud) {
                graphContainer.style.display = 'none';
                cloudContainer.style.display = 'flex';
                this.currentView = 'cloud';
                this.currentActiveNodeId = state.getCurrentActiveNodeId();
                phylogenySelector.cloudView.renderCloudView();
            } else {
                cloudContainer.style.display = 'none';
                graphContainer.style.display = 'flex';
                this.currentView = 'graph';
                if (this.currentActiveNodeId) {
                    const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();
                    const pathToRoot = phylogenySelector.graphView.getPathToRoot(hierarchyObj, this.currentActiveNodeId);
                    phylogenySelector.graphView.updateGraph(pathToRoot);
                } else {
                    phylogenySelector.graphView.updateGraph();
                }
            }
        },

        updateToggleState() {
            const toggleNamesCheckbox = document.getElementById('phylogeny-name-toggle');
            const toggleLabel = document.querySelector('label[for="phylogeny-name-toggle"]');
            if (toggleNamesCheckbox && toggleLabel) {
                const showTaxonomic = state.getShowTaxonomicNames();
                toggleNamesCheckbox.checked = showTaxonomic;
                if (showTaxonomic) {
                    toggleLabel.classList.add('checked');
                } else {
                    toggleLabel.classList.remove('checked');
                }
            }
        },

        toggleNameDisplay(event) {
            const showTaxonomic = event.target.checked;
            state.setShowTaxonomicNames(showTaxonomic);

            // Update the toggle's visual state
            const toggleNamesCheckbox = document.getElementById('phylogeny-name-toggle');
            const toggleLabel = document.querySelector('label[for="phylogeny-name-toggle"]');
            if (toggleNamesCheckbox && toggleLabel) {
                toggleNamesCheckbox.checked = showTaxonomic;
                if (showTaxonomic) {
                    toggleLabel.classList.add('checked');
                } else {
                    toggleLabel.classList.remove('checked');
                }
            }

            if (this.currentView === 'graph') {
                if (d3Graphs.lastCreatedTree) {
                    d3Graphs.lastCreatedTree.updateNodeLabels(showTaxonomic);
                }
            } else if (this.currentView === 'cloud') {
                phylogenySelector.cloudView.renderCloudView();
            }
        },

        updateActiveTaxonDisplay(nodeId) {
            const activeNameEl = document.getElementById('active-taxon-name');
            const activeVernacularEl = document.getElementById('active-taxon-vernacular');

            if (nodeId) {
                const hierarchyObj = api.taxonomy.getTaxonomyHierarchy();
                const node = hierarchyObj.getTaxonById(nodeId);
                if (node) {
                    activeNameEl.textContent = node.taxonName;
                    if (node.vernacularName && node.vernacularName !== "-") {
                        activeVernacularEl.textContent = ` (${node.vernacularName})`;
                        activeVernacularEl.style.display = 'inline';
                    } else {
                        activeVernacularEl.textContent = '';
                        activeVernacularEl.style.display = 'none';
                    }
                } else {
                    activeNameEl.textContent = 'Unknown Taxon';
                    activeVernacularEl.textContent = '';
                    activeVernacularEl.style.display = 'none';
                }
                this.toggleTapMessage(true);
            } else {
                activeNameEl.textContent = 'No taxon selected';
                activeVernacularEl.textContent = '';
                activeVernacularEl.style.display = 'none';
                this.toggleTapMessage(false);
            }
        },

        toggleTapMessage(show) {
            const tapMessage = document.getElementById('phylogeny-dialog__message-tap');
            if (tapMessage) {
                tapMessage.style.opacity = show ? '1' : '0';
            }
        },

        handleDoneButton() {
            const activeNodeId = d3Graphs.getActiveNodeId();
            const currentPhylogenyId = state.getPhylogenyID();

            let filtersChanged = false;

            if (activeNodeId !== currentPhylogenyId) {
                if (activeNodeId) {
                    state.setPhylogenyID(activeNodeId);
                } else {
                    // If no node is selected, clear the phylogeny filter
                    state.setPhylogenyID(null);
                }
                filtersChanged = true;
            }

            const currentFilters = filtering.getActiveFilters();
            const previousFilters = state.getPreviousFilters();

            if (filtersChanged || filtering.haveFiltersChanged(currentFilters, previousFilters)) {
                logger.debug('Phylogeny filters changed, updating taxon list');
                collectionManager.updateTaxonList();
                collectionManager.updateLevelCounts();
                state.setPreviousFilters(currentFilters);
                collectionManager.updateFilterSummary();
            } else {
                logger.debug('No changes in phylogeny filters, skipping taxon list update');
            }

            dialogManager.closeDialog('phylogeny-dialog');
        },

        clearSelection() {
            state.setPhylogenyID(null);
            state.setCurrentActiveNodeId(null);
            phylogenySelector.graphView.updateGraph();
            if (this.currentView === 'cloud') {
                phylogenySelector.cloudView.renderCloudView();
            }
            this.updateActiveTaxonDisplay(null);
            collectionManager.updateFilterSummary();
            collectionManager.onFiltersChanged();
        },

        handleClearFilters() {
            filtering.clearAllFilters();
            phylogenySelector.graphView.updateGraph();
            phylogenySelector.cloudView.renderCloudView();
            this.updateActiveTaxonDisplay(null);
        },
    },
};

// Bind all methods in phylogenySelector and its nested objects
const bindMethodsRecursively = (obj) => {
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'function') {
            obj[key] = obj[key].bind(obj);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            bindMethodsRecursively(obj[key]);
        }
    });
};

bindMethodsRecursively(phylogenySelector);

const publicAPI = {
    initialize: phylogenySelector.initialize,
    updateGraph: phylogenySelector.graphView.updateGraph,
    clearSelection: phylogenySelector.uiControls.clearSelection,
    toggleView: phylogenySelector.uiControls.toggleView,
    updateToggleState: phylogenySelector.uiControls.updateToggleState,
    clearSearchResults: phylogenySelector.search.clearSearchResults,
    focusSearchInput: phylogenySelector.focusSearchInput,
};

// Bind publicAPI methods
Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(phylogenySelector);
    }
});

export default publicAPI;

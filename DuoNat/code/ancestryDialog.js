import api from './api.js';
import d3Graphs from './d3Graphs.js';
import logger from './logger.js';
import state from './state.js';
import utils from './utils.js';
import dialogManager from './dialogManager.js';

const ancestryDialog = {
    container: null,
    network: null,
    initialized: false,
    loadingIndicator: null,
    currentData: null,
    currentGraphTaxa: null,

    initialization: {
        async initialize(container) {
            ancestryDialog.container = container;
            if (ancestryDialog.container) {
                ancestryDialog.ui.createLoadingIndicator();
            }
            ancestryDialog.initialized = true;

            const toggleNamesCheckbox = document.getElementById('ancestry-name-toggle');
            if (toggleNamesCheckbox) {
                toggleNamesCheckbox.checked = state.getShowTaxonomicNames();
                toggleNamesCheckbox.addEventListener('change', ancestryDialog.ui.toggleNameDisplay);
            }
        },
    },

    ui: {
        createLoadingIndicator() {
            if (!ancestryDialog.container) return;
            ancestryDialog.loadingIndicator = this.createLoadingElement();
            ancestryDialog.container.appendChild(ancestryDialog.loadingIndicator);
        },

        toggleNameDisplay(event) {
            const showTaxonomic = event.target.checked;
            state.setShowTaxonomicNames(showTaxonomic);
            ancestryDialog.graphRendering.updateNodeLabels(showTaxonomic);
        },

        createLoadingElement() {
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.style.display = 'none';

            const elements = [
                this.createLogoElement(),
                this.createSpinnerElement(),
                this.createMessageElement()
            ];

            elements.forEach(element => loadingIndicator.appendChild(element));
            return loadingIndicator;
        },

        createLogoElement() {
            const logo = document.createElement('img');
            logo.src = './images/icon-512x512.png';
            logo.alt = 'DuoNat logo';
            logo.className = 'loading-indicator-logo';
            return logo;
        },

        createSpinnerElement() {
            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            return spinner;
        },

        createMessageElement() {
            const message = document.createElement('p');
            message.innerHTML = '<span>Building relationship graph...';
            return message;
        },

        showLoadingIndicator() {
            if (ancestryDialog.loadingIndicator) {
                ancestryDialog.loadingIndicator.style.display = 'block';
            }
        },

        hideLoadingIndicator() {
            if (ancestryDialog.loadingIndicator) {
                ancestryDialog.loadingIndicator.style.display = 'none';
            }
        },

        openTaxonPage(url) {
            window.open(url, '_blank');
        },

    },

    graphManagement: {
        showExistingGraph(showTaxonomic) {
            if (ancestryDialog.currentData && ancestryDialog.container) {
                logger.debug("Showing existing graph");
                if (ancestryDialog.network) {
                    ancestryDialog.network.fit();
                    // Update existing graph labels if necessary
                    ancestryDialog.graphRendering.updateNodeLabels(showTaxonomic);
                } else {
                    ancestryDialog.graphRendering.renderGraph(
                        ancestryDialog.currentData.taxon1,
                        ancestryDialog.currentData.taxon2,
                        ancestryDialog.currentData.commonAncestor,
                        ancestryDialog.currentShowTaxonomic || showTaxonomic
                    );
                }
            } else {
                logger.error("No existing graph data to show");
            }
        },

        clearGraph() {
            if (ancestryDialog.network) {
                ancestryDialog.network.destroy();
                ancestryDialog.network = null;
            }
            ancestryDialog.currentData = null;
            if (ancestryDialog.container) {
                ancestryDialog.container.innerHTML = '';
                ancestryDialog.ui.createLoadingIndicator();
            }
        },

        async showTaxaRelationship() {
            const { taxonImageOne, taxonImageTwo } = state.getGameState();
            const container = document.getElementById('ancestry-dialog__graph');

            if (!ancestryDialog.graphManagement.validateTaxonNames(taxonImageOne, taxonImageTwo)) return;

            const toggleNamesCheckbox = document.getElementById('ancestry-name-toggle');
            if (toggleNamesCheckbox) {
                toggleNamesCheckbox.checked = state.getShowTaxonomicNames();
            }

            dialogManager.openDialog('ancestry-dialog');

            try {
                await ancestryDialog.initialization.initialize(container);
                const showTaxonomic = state.getShowTaxonomicNames();
        logger.debug(`showTaxaRelationship: showTaxonomic is ${showTaxonomic}`);
                await ancestryDialog.graphManagement.handleGraphDisplay(taxonImageOne, taxonImageTwo, showTaxonomic);
            } catch (error) {
                ancestryDialog.graphManagement.handleGraphError(error);
            }
        },

        validateTaxonNames(taxonImageOne, taxonImageTwo) {
            if (!taxonImageOne || !taxonImageTwo) {
                logger.error('Taxon names not available');
                alert('Unable to show relationship. Please try again after starting a new game.');
                return false;
            }
            return true;
        },

        async handleGraphDisplay(taxonImageOne, taxonImageTwo, showTaxonomic) {
    logger.debug(`handleGraphDisplay: showTaxonomic is ${showTaxonomic}`);
            if (ancestryDialog.graphManagement.isSameTaxaPair(taxonImageOne, taxonImageTwo)) {
                logger.debug("Showing existing graph for the same taxa pair");
                ancestryDialog.graphManagement.showExistingGraph(showTaxonomic);
            } else {
                logger.debug("Creating new graph for a different taxa pair");
                await ancestryDialog.graphManagement.createNewGraph(taxonImageOne, taxonImageTwo, showTaxonomic);
            }
        },

        isSameTaxaPair(taxonImageOne, taxonImageTwo) {
            return ancestryDialog.currentGraphTaxa &&
                ancestryDialog.currentGraphTaxa[0] === taxonImageOne &&
                ancestryDialog.currentGraphTaxa[1] === taxonImageTwo;
        },

        async createNewGraph(taxonImageOne, taxonImageTwo, showTaxonomic) {
            ancestryDialog.graphManagement.clearGraph();
            await ancestryDialog.dataProcessing.findRelationship(taxonImageOne, taxonImageTwo, showTaxonomic);
            ancestryDialog.currentGraphTaxa = [taxonImageOne, taxonImageTwo];
            ancestryDialog.currentShowTaxonomic = showTaxonomic;
        },

        handleGraphError(error) {
            logger.error('Error showing taxa relationship:', error);
            alert('Failed to load the relationship graph. Please try again later.');
            dialogManager.closeDialog('ancestry-dialog');
        },
    },

    dataProcessing: {
        async findRelationship(taxonName1, taxonName2, showTaxonomic) {
            if (!ancestryDialog.initialized) {
                throw new Error('Viewer not initialized. Call initialize() first.');
            }

            ancestryDialog.ui.showLoadingIndicator();

            try {
                const [taxon1, taxon2] = await this.fetchTaxonData(taxonName1, taxonName2);
                const [ancestry1, ancestry2] = await this.fetchAncestryData(taxonName1, taxonName2);

                this.updateTaxonAncestry(taxon1, ancestry1);
                this.updateTaxonAncestry(taxon2, ancestry2);

                const commonAncestor = ancestryDialog.utils.findCommonAncestor(taxon1, taxon2);
                ancestryDialog.currentData = { taxon1, taxon2, commonAncestor };
                await ancestryDialog.graphRendering.renderGraph(taxon1, taxon2, commonAncestor, showTaxonomic);
            } catch (error) {
                logger.error('Error finding relationship:', error);
                throw error;
            } finally {
                ancestryDialog.ui.hideLoadingIndicator();
            }
        },

        async fetchTaxonData(taxonName1, taxonName2) {
            return Promise.all([
                ancestryDialog.utils.fetchTaxonData(taxonName1),
                ancestryDialog.utils.fetchTaxonData(taxonName2)
            ]);
        },

        async fetchAncestryData(taxonName1, taxonName2) {
            return Promise.all([
                api.taxonomy.getAncestryFromLocalData(taxonName1),
                api.taxonomy.getAncestryFromLocalData(taxonName2)
            ]);
        },

        updateTaxonAncestry(taxon, ancestry) {
            taxon.ancestor_ids = Array.isArray(taxon.ancestor_ids) ? taxon.ancestor_ids : Array.from(taxon.ancestor_ids || []);
            if (ancestry.length > 0) taxon.ancestor_ids = ancestry;
        },

        async fetchAncestorDetails(ancestorIds, taxon1, taxon2) {
            ancestorIds = Array.isArray(ancestorIds) ? ancestorIds : Array.from(ancestorIds || []);
            logger.debug('Fetching ancestor details for IDs:', ancestorIds);

            const localAncestorDetails = new Map();
            this.addEndNodesToLocalDetails(localAncestorDetails, taxon1, taxon2);

            const ancestorDetails = await api.taxonomy.fetchAncestorDetails(ancestorIds);
            this.mergeAncestorDetails(localAncestorDetails, ancestorDetails);

            return localAncestorDetails;
        },

        addEndNodesToLocalDetails(localAncestorDetails, ...endNodes) {
            endNodes.forEach(taxon => {
                if (taxon && taxon.id) {
                    localAncestorDetails.set(taxon.id, {
                        id: taxon.id,
                        name: taxon.name,
                        rank: taxon.rank,
                        preferred_common_name: taxon.preferred_common_name
                    });
                    logger.debug(`Added local data for end node ${taxon.id}:`, localAncestorDetails.get(taxon.id));
                }
            });
        },

        mergeAncestorDetails(localAncestorDetails, apiAncestorDetails) {
            apiAncestorDetails.forEach((value, key) => {
                if (!localAncestorDetails.has(key)) {
                    localAncestorDetails.set(key, value);
                }
            });
        },
    },

    graphRendering: {

        /*async renderVisGraph(taxon1, taxon2, commonAncestorId) {
            // Clear any existing graph
            if (ancestryDialog.network) {
                ancestryDialog.network.destroy();
            }
            const nodes = new vis.DataSet();
            const edges = new vis.DataSet();

            const hierarchy = api.taxonomy.getTaxonomyHierarchy();

            if (!hierarchy) {
                logger.error('Taxonomy hierarchy not loaded');
                return;
            }

            const node1 = hierarchy.getTaxonById(taxon1.id);
            const node2 = hierarchy.getTaxonById(taxon2.id);

            if (!node1 || !node2) {
                logger.error(`One or both taxa not found in hierarchy: ${taxon1.id}, ${taxon2.id}`);
                return;
            }

            const getAncestors = (node) => {
                let ancestors = [];
                let current = node;
                while (current) {
                    ancestors.unshift(current);
                    current = hierarchy.getTaxonById(current.parentId);
                    if (!current) break;
                }
                return ancestors;
            };

            const ancestors1 = getAncestors(node1);
            const ancestors2 = getAncestors(node2);

            let commonAncestor = null;
            for (let i = 0; i < Math.min(ancestors1.length, ancestors2.length); i++) {
                if (ancestors1[i].id === ancestors2[i].id) {
                    commonAncestor = ancestors1[i];
                } else {
                    break;
                }
            }

            const addNodeAndEdges = (taxon, parentId, isEndTaxon) => {
                const nodeData = hierarchy.getTaxonById(taxon.id);
                if (!nodeData) {
                    logger.error(`Node data not found for taxon ID: ${taxon.id}`);
                    return;
                }

                var taxonName = nodeData.taxonName || `Unknown Taxon ${nodeData.id}`;
                var taxonRank = utils.string.capitalizeFirstLetter(nodeData.rank || 'Unknown');
                var vernacularName = nodeData.vernacularName && nodeData.vernacularName !== "-" ?
                    `\n(${utils.string.capitalizeFirstLetter(nodeData.vernacularName)})` : "";

                if (taxonRank === "Species" || taxonRank === "Genus" || taxonRank === "Stateofmatter") { vernacularName = ""; }
                if (taxonRank === "Species") { taxonName = utils.string.shortenSpeciesName(taxonName); }
                if (taxonRank === "Species" || taxonRank === "Genus" || taxonRank === "Stateofmatter") { taxonRank = ""; }

                const nodeColor = isEndTaxon ? '#ffa500' : '#74ac00';

                if (!nodes.get(nodeData.id)) {
                    nodes.add({
                        id: nodeData.id,
                        label: `${taxonRank} ${taxonName}${vernacularName}`,
                        color: nodeColor,
                        url: `https://www.inaturalist.org/taxa/${nodeData.id}`,
                        title: 'Click to view on iNaturalist'
                    });
                    if (parentId) edges.add({ from: parentId, to: nodeData.id });
                } else if (isEndTaxon) {
                    nodes.update({ id: nodeData.id, color: nodeColor });
                }
            };

            const processAncestry = (ancestors, isEndTaxon) => {
                ancestors.forEach((ancestor, index) => {
                    const parentId = index > 0 ? ancestors[index - 1].id : null;
                    addNodeAndEdges(ancestor, parentId, isEndTaxon && index === ancestors.length - 1);
                });
            };

            processAncestry(ancestors1, true);
            processAncestry(ancestors2, true);

            const data = { nodes, edges };
            const options = {
                layout: {
                    hierarchical: {
                        direction: 'UD',
                        sortMethod: 'directed',
                        levelSeparation: 100,
                        nodeSpacing: 200
                    }
                },
                nodes: {
                    shape: 'box',
                    font: {
                        size: 16
                    },
                },
                edges: {
                    arrows: 'to',
                    smooth: {
                        type: 'cubicBezier',
                        forceDirection: 'vertical'
                    }
                }
            };

            ancestryDialog.network = new vis.Network(ancestryDialog.container, data, options);
            ancestryDialog.container.classList.add('clickable-network');

            ancestryDialog.network.on("click", (params) => {
                if (params.nodes.length > 0) {
                    const nodeId = params.nodes[0];
                    const node = nodes.get(nodeId);
                    if (node && node.url) {
                        window.open(node.url, '_blank');
                    }
                }
            });
        },*/

        async renderGraph(taxon1, taxon2, commonAncestorId, showTaxonomic) {

    logger.debug(`Rendering graph with showTaxonomic: ${showTaxonomic}`);
            // SVG elements don't work well with CSS
            const NODE_HEIGHT = 40;
            const CHAR_WIDTH = 9; // Approximate width of a character
            const PADDING = 8; // Padding inside the rectangle
            const BORDER_RADIUS = 8;

            const d3 = await d3Graphs.loadD3();
            // Clear any existing graph
            if (ancestryDialog.network) {
                ancestryDialog.network.destroy();
                ancestryDialog.network = null;
            }
            ancestryDialog.container.innerHTML = '';

            const hierarchy = api.taxonomy.getTaxonomyHierarchy();
            if (!hierarchy) {
                logger.error('Taxonomy hierarchy not loaded');
                return;
            }

            const node1 = hierarchy.getTaxonById(taxon1.id);
            const node2 = hierarchy.getTaxonById(taxon2.id);
            if (!node1 || !node2) {
                logger.error(`One or both taxa not found in hierarchy: ${taxon1.id}, ${taxon2.id}`);
                return;
            }

            const getAncestors = (node) => {
                let ancestors = [];
                let current = node;
                while (current) {
                    ancestors.unshift(current);
                    current = hierarchy.getTaxonById(current.parentId);
                }
                return ancestors;
            };

            const ancestors1 = getAncestors(node1);
            const ancestors2 = getAncestors(node2);

            // Find the nearest common ancestor
            let commonAncestorIndex = 0;
            while (commonAncestorIndex < ancestors1.length && 
                   commonAncestorIndex < ancestors2.length && 
                   ancestors1[commonAncestorIndex].id === ancestors2[commonAncestorIndex].id) {
                commonAncestorIndex++;
            }
            commonAncestorIndex--;

            // Find the last common ancestor
            let lastCommonAncestor = null;
            for (let i = 0; i < Math.min(ancestors1.length, ancestors2.length); i++) {
                if (ancestors1[i].id === ancestors2[i].id) {
                    lastCommonAncestor = ancestors1[i].id;
                } else {
                    break;
                }
            }

            // Build the tree structure
            const buildSubtree = (ancestors, startIndex) => {
                if (startIndex >= ancestors.length) return null;
                return {
                    id: ancestors[startIndex].id,
                    taxonName: ancestors[startIndex].taxonName,
                    vernacularName: ancestors[startIndex].vernacularName,
                    rank: ancestors[startIndex].rank,
                    children: buildSubtree(ancestors, startIndex + 1) ? [buildSubtree(ancestors, startIndex + 1)] : null
                };
            };

            const rootNode = buildSubtree(ancestors1, 0);
            let currentNode = rootNode;
            for (let i = 1; i <= commonAncestorIndex; i++) {
                currentNode = currentNode.children[0];
            }
            currentNode.children = [
                buildSubtree(ancestors1, commonAncestorIndex + 1),
                buildSubtree(ancestors2, commonAncestorIndex + 1)
            ].filter(Boolean);

            const width = ancestryDialog.container.clientWidth;
            const height = ancestryDialog.container.clientHeight;

            const svg = d3.select(ancestryDialog.container)
                .append('svg')
                .attr('width', '100%')
                .attr('height', '100%')
                .append('g');
                //.attr('transform', 'translate(0, 8)');

            const tree = d3.tree().size([width, height * 0.95]); // Reduce height to 95%
            const root = d3.hierarchy(rootNode);
            
            // Ensure end nodes are at the same depth
            const maxDepth = Math.max(...root.leaves().map(d => d.depth));
            root.eachBefore(d => {
                if (!d.children) {
                    d.depth = maxDepth;
                }
            });

            tree(root);

            // Adjust y-positions to align end nodes at the bottom
            const maxY = Math.max(...root.leaves().map(d => d.y));
            root.eachBefore(d => {
                if (!d.children) {
                    d.y = maxY;
                }
            });

            const links = root.links();
            const nodes = root.descendants();

            const shouldItalicize = (rank) => {
                return ["Genus", "Species", "Subspecies"].includes(rank);
            };

            const getNodeText = (d, showTaxonomic) => {
                let taxonName = d.data.taxonName;
                if (!taxonName) {
                    logger.warn(`Missing taxon name for rank: ${d.data.rank}`);
                    taxonName = 'Unknown';
                }
                if (d.data.rank === "Species") {
                    taxonName = utils.string.shortenSpeciesName(taxonName);
                }
                const rankText = ["Species", "Genus", "Stateofmatter"].includes(d.data.rank) ? "" : `${utils.string.capitalizeFirstLetter(d.data.rank)} `;

                if (!showTaxonomic && d.data.vernacularName && d.data.vernacularName !== "-") {
                    return { rankText: "", taxonName: d.data.vernacularName, text: d.data.vernacularName, length: d.data.vernacularName.length };
                }

                return { rankText, taxonName, text: `${rankText}${taxonName}`, length: (`${rankText}${taxonName}`).length };
            };

            // Calculate the maximum node width with additional logging
            const maxNodeWidth = nodes.reduce((max, d) => {
                const nodeTextInfo = getNodeText(d);
                return Math.max(max, nodeTextInfo.length * CHAR_WIDTH);
            }, 0) + PADDING * 2;

            // Ensure maxNodeWidth is always a positive number
            const safeMaxNodeWidth = Math.max(100, maxNodeWidth || 0);

            // Draw links
            svg.selectAll('.ancestry-tree__link')
                .data(links)
                .enter().append('path')
                .attr('class', 'ancestry-tree__link')
                .attr('d', d3.linkVertical()
                    .x(d => d.x)
                    .y(d => d.y));

            // Draw nodes
            const node = svg.selectAll('.ancestry-tree__node')
                .data(nodes)
                .enter().append('g')
                .attr('class', 'ancestry-tree__node')
                .attr('transform', d => `translate(${d.x},${d.y})`);

            // Add rectangles for nodes
            node.append('rect')
                .attr('class', d => {
                    let classes = 'd3-node-rect ancestry-tree__node-rect';
                    if (String(d.data.id) === String(taxon1.id) || String(d.data.id) === String(taxon2.id)) {
                        classes += ' ancestry-tree__node-rect--endpoint';
                    }
                    if (String(d.data.id) === String(lastCommonAncestor)) {
                        classes += ' ancestry-tree__node-rect--common-ancestor';
                    }
                    return classes;
                })
                .attr('width', safeMaxNodeWidth)
                .attr('height', NODE_HEIGHT)
                .attr('x', -safeMaxNodeWidth / 2)
                .attr('y', -NODE_HEIGHT / 2)
                .attr('rx', BORDER_RADIUS)
                .attr('ry', BORDER_RADIUS);

            // Add text to nodes
            node.append('text')
                .attr('class', 'ancestry-tree__node-text')
                .attr('dy', '.31em')
                .attr('text-anchor', 'middle')
                .each(function(d) {
                    const { rankText, taxonName } = getNodeText(d);
                    
                    if (rankText) {
                        d3.select(this).append('tspan')
                            .text(rankText);
                    }
                    
                    if (d.data.rank === "Species") {
                        // For species, italicize both the abbreviated genus and specific epithet
                        if (taxonName && taxonName.includes(' ')) {
                            const [genus, ...restOfName] = taxonName.split(' ');
                            d3.select(this).append('tspan')
                                .attr('style', 'font-style: italic;')
                                .text(genus + ' ');
                            d3.select(this).append('tspan')
                                .attr('style', 'font-style: italic;')
                                .text(restOfName.join(' '));
                        } else {
                            logger.warn(`Unexpected format for species name: ${taxonName}`);
                            d3.select(this).append('tspan')
                                .attr('style', 'font-style: italic;')
                                .text(taxonName || 'Unknown species');
                        }
                    } else if (d.data.rank === "Genus") {
                        // For genus, italicize the entire name
                        d3.select(this).append('tspan')
                            .attr('style', 'font-style: italic;')
                            .text(taxonName || 'Unknown genus');
                    } else {
                        // For other ranks, no italics
                        d3.select(this).append('tspan')
                            .text(taxonName || 'Unknown taxon');
                    }
                });

            // Add click event to open iNaturalist taxon page
            node.on('click', (event, d) => {
                window.open(`https://www.inaturalist.org/taxa/${d.data.id}`, '_blank');
            });

            // Center the graph
            const bounds = svg.node().getBBox();
            const scale = Math.min(width / bounds.width, height / bounds.height) * 0.9;
            const tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
            const ty = 20;

            svg.attr('transform', `translate(${tx},${ty}) scale(${scale})`);

            const zoom = d3.zoom()
                .scaleExtent([0.5, 3])
                .on('zoom', (event) => {
                    svg.attr('transform', event.transform);
                });

            d3.select(ancestryDialog.container).select('svg')
                .call(zoom)
                .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));

            this.lastCreatedTree = { svg, getNodeText };
        },

        async updateNodeLabels(showTaxonomic) {
            if (!this.lastCreatedTree) {
                logger.warn('No tree to update');
                return;
            }

            const d3 = await d3Graphs.loadD3();
            const { svg, getNodeText } = this.lastCreatedTree;

            svg.selectAll('.ancestry-tree__node-text')
                .each(function(d) {
                    const textElement = d3.select(this);
                    textElement.selectAll('*').remove(); // Clear existing text

                    const { rankText, taxonName } = getNodeText(d, showTaxonomic);

                    if (rankText) {
                        textElement.append('tspan')
                            .text(rankText);
                    }

                    if (d.data.rank === "Species") {
                        // For species, italicize both the abbreviated genus and specific epithet
                        if (taxonName && taxonName.includes(' ')) {
                            const [genus, ...restOfName] = taxonName.split(' ');
                            textElement.append('tspan')
                                .attr('style', 'font-style: italic;')
                                .text(genus + ' ');
                            textElement.append('tspan')
                                .attr('style', 'font-style: italic;')
                                .text(restOfName.join(' '));
                        } else {
                            logger.warn(`Unexpected format for species name: ${taxonName}`);
                            textElement.append('tspan')
                                .attr('style', 'font-style: italic;')
                                .text(taxonName || 'Unknown species');
                        }
                    } else if (d.data.rank === "Genus") {
                        // For genus, italicize the entire name
                        textElement.append('tspan')
                            .attr('style', 'font-style: italic;')
                            .text(taxonName || 'Unknown genus');
                    } else {
                        // For other ranks, no italics
                        textElement.append('tspan')
                            .text(taxonName || 'Unknown taxon');
                    }
                });

            // Recalculate and update node sizes if necessary
            this.updateNodeSizes();
        },

        updateNodeSizes() {
            // Implement this if you need to adjust node sizes based on new text content
            // This might involve recalculating maxNodeWidth and updating rectangles
            logger.warn("Node sizes update not implemented yet");
        },

    },

    utils: {
        /*loadVisJs() {
            return new Promise((resolve, reject) => {
                if (window.vis) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/vis-network/standalone/umd/vis-network.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        },*/

        async fetchTaxonData(name) {
            return api.taxonomy.fetchTaxonDetails(name);
        },

        findCommonAncestor(taxon1, taxon2) {
            const ancestors1 = new Set(taxon1.ancestor_ids);
            let commonAncestor = null;
            for (const ancestorId of taxon2.ancestor_ids) {
                if (ancestors1.has(ancestorId)) {
                    commonAncestor = ancestorId;
                    break;
                }
            }
            return commonAncestor;
        },
    },
};

// Bind all methods and its nested objects
const bindMethodsRecursively = (obj) => {
    Object.keys(obj).forEach(key => {
        if (typeof obj[key] === 'function') {
            obj[key] = obj[key].bind(obj);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            bindMethodsRecursively(obj[key]);
        }
    });
};

bindMethodsRecursively(ancestryDialog);

const publicAPI = {
    showTaxaRelationship: ancestryDialog.graphManagement.showTaxaRelationship
};

Object.keys(publicAPI).forEach(key => {
    if (typeof publicAPI[key] === 'function') {
        publicAPI[key] = publicAPI[key].bind(ancestryDialog);
    }
});

export default publicAPI;

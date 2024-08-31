import ancestryPopup from './ancestryPopup.js';
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
            ancestryPopup.initialize();

            this.initializeToggle();
        },

        initializeToggle() {
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
                await ancestryDialog.graphManagement.handleGraphDisplay(taxonImageOne, taxonImageTwo, showTaxonomic);

                ancestryDialog.graphRendering.updateNodeLabels(showTaxonomic);
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
            if (ancestryDialog.graphManagement.isSameTaxaPair(taxonImageOne, taxonImageTwo)) {
                ancestryDialog.graphManagement.showExistingGraph(showTaxonomic);
            } else {
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
        NODE_HEIGHT: 40,
        CHAR_WIDTH: 9, // Approximate width of a character
        PADDING: 8, // Padding inside the rectangle
        BORDER_RADIUS: 8,

        async renderGraph(taxon1, taxon2, commonAncestorId, showTaxonomic) {
            const d3 = await d3Graphs.loadD3();
            this.clearExistingGraph();
            
            const hierarchy = this.getHierarchy();
            if (!hierarchy) return;

            const [node1, node2] = this.getNodes(hierarchy, taxon1, taxon2);
            if (!node1 || !node2) return;

            const ancestorsData = this.getAncestors(hierarchy, node1, node2);
            const rootNode = this.buildTreeStructure(ancestorsData);
            
            const [width, height] = this.setupSvg(d3);
            const tree = this.createTree(d3, width, height);
            const root = d3.hierarchy(rootNode);
            
            this.adjustNodeDepths(root);
            tree(root);
            this.alignEndNodes(root);

            const [links, nodes] = this.getLinksAndNodes(root);
            
            this.drawLinks(d3, links);
            this.drawNodes(d3, nodes, showTaxonomic, taxon1, taxon2, ancestorsData.lastCommonAncestor);
            
            const zoom = this.setupZoom(d3, width, height);

            this.lastCreatedTree = {
                svg: d3.select(ancestryDialog.container).select('svg'),
                getNodeText: this.getNodeText,
                d3: d3,
                data: rootNode,
                width: width,
                height: height,
                zoom: zoom
            };
        },

        clearExistingGraph() {
            if (ancestryDialog.network) {
                ancestryDialog.network.destroy();
                ancestryDialog.network = null;
            }
            ancestryDialog.container.innerHTML = '';
        },

        getHierarchy() {
            const hierarchy = api.taxonomy.getTaxonomyHierarchy();
            if (!hierarchy) {
                logger.error('Taxonomy hierarchy not loaded');
            }
            return hierarchy;
        },

        getNodes(hierarchy, taxon1, taxon2) {
            const node1 = hierarchy.getTaxonById(taxon1.id);
            const node2 = hierarchy.getTaxonById(taxon2.id);
            if (!node1 || !node2) {
                logger.error(`One or both taxa not found in hierarchy: ${taxon1.id}, ${taxon2.id}`);
            }
            return [node1, node2];
        },

        getAncestors(hierarchy, node1, node2) {
            const getAncestorChain = (node) => {
                let ancestors = [];
                let current = node;
                while (current) {
                    ancestors.unshift(current);
                    current = hierarchy.getTaxonById(current.parentId);
                }
                return ancestors;
            };

            const ancestors1 = getAncestorChain(node1);
            const ancestors2 = getAncestorChain(node2);
            
            // Find the last common ancestor
            let lastCommonAncestor = null;
            for (let i = 0; i < Math.min(ancestors1.length, ancestors2.length); i++) {
                if (ancestors1[i].id === ancestors2[i].id) {
                    lastCommonAncestor = ancestors1[i].id;
                } else {
                    break;
                }
            }
            
            return { ancestors: [ancestors1, ancestors2], lastCommonAncestor };
        },

        buildTreeStructure(ancestorsData) {
            const { ancestors, lastCommonAncestor } = ancestorsData;
            const [ancestors1, ancestors2] = ancestors;
            let commonAncestorIndex = this.findCommonAncestorIndex(ancestors1, ancestors2);

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

            return rootNode;
        },

        findCommonAncestorIndex(ancestors1, ancestors2) {
            let index = 0;
            while (index < ancestors1.length && 
                   index < ancestors2.length && 
                   ancestors1[index].id === ancestors2[index].id) {
                index++;
            }
            return index - 1;
        },

        setupSvg(d3) {
            const containerRect = ancestryDialog.container.getBoundingClientRect();
            const width = containerRect.width;
            const height = containerRect.height - 0; // Subtract some space for the title and controls

            const svg = d3.select(ancestryDialog.container)
                .append('svg')
                .attr('width', width)
                .attr('height', height)
                .append('g');

            return [width, height];
        },

        createTree(d3, width, height) {
            return d3.tree().size([width, height * 0.95]);
        },

        adjustNodeDepths(root) {
            const maxDepth = Math.max(...root.leaves().map(d => d.depth));
            root.eachBefore(d => {
                if (!d.children) {
                    d.depth = maxDepth;
                }
            });
        },

        alignEndNodes(root) {
            const maxY = Math.max(...root.leaves().map(d => d.y));
            root.eachBefore(d => {
                if (!d.children) {
                    d.y = maxY;
                }
            });
        },

        getLinksAndNodes(root) {
            const links = root.links();
            const nodes = root.descendants();
            return [links, nodes];
        },

        drawLinks(d3, links) {
            const svg = d3.select(ancestryDialog.container).select('svg g');
            svg.selectAll('.ancestry-tree__link')
                .data(links)
                .enter().append('path')
                .attr('class', 'ancestry-tree__link')
                .attr('d', d3.linkVertical()
                    .x(d => d.x)
                    .y(d => d.y));
        },

        drawNodes(d3, nodes, showTaxonomic, taxon1, taxon2, lastCommonAncestor) {
            const svg = d3.select(ancestryDialog.container).select('svg g');
            const node = svg.selectAll('.ancestry-tree__node')
                .data(nodes)
                .enter().append('g')
                .attr('class', 'ancestry-tree__node')
                .attr('transform', d => `translate(${d.x},${d.y})`);

            this.drawNodeRectangles(node, taxon1, taxon2, lastCommonAncestor);
            this.drawNodeText(d3, node, showTaxonomic);
            this.setupNodeClickHandlers(node);
        },

        drawNodeRectangles(node, taxon1, taxon2, lastCommonAncestor) {
            const safeMaxNodeWidth = this.calculateMaxNodeWidth(node);
            node.append('rect')
                .attr('class', d => this.getNodeRectClass(d, taxon1, taxon2, lastCommonAncestor))
                .attr('width', safeMaxNodeWidth)
                .attr('height', this.NODE_HEIGHT)
                .attr('x', -safeMaxNodeWidth / 2)
                .attr('y', -this.NODE_HEIGHT / 2)
                .attr('rx', this.BORDER_RADIUS)
                .attr('ry', this.BORDER_RADIUS);
        },

        calculateMaxNodeWidth(node) {
            const maxNodeWidth = node.data().reduce((max, d) => {
                const nodeTextInfo = this.getNodeText(d);
                return Math.max(max, nodeTextInfo.length * this.CHAR_WIDTH);
            }, 0) + this.PADDING * 2;
            return Math.max(100, maxNodeWidth || 0);
        },

        getNodeRectClass(d, taxon1, taxon2, lastCommonAncestor) {
            let classes = 'd3-node-rect ancestry-tree__node-rect';
            if (String(d.data.id) === String(taxon1.id) || String(d.data.id) === String(taxon2.id)) {
                classes += ' ancestry-tree__node-rect--endpoint';
            }
            if (String(d.data.id) === String(lastCommonAncestor)) {
                classes += ' ancestry-tree__node-rect--common-ancestor';
            }
            return classes;
        },

        drawNodeText(d3,node, showTaxonomic) {
            const self = this;
            node.append('text')
                .attr('class', 'ancestry-tree__node-text')
                .attr('dy', '.31em')
                .attr('text-anchor', 'middle')
                .each(function(d) {
                    const { rankText, taxonName } = self.getNodeText(d, showTaxonomic);
                    self.appendNodeTextContent(d3.select(this), rankText, taxonName, d.data.rank);
                });
        },

        appendNodeTextContent(textElement, rankText, taxonName, rank) {
            if (rankText) {
                textElement.append('tspan').text(rankText);
            }

            if (rank === "Species") {
                this.appendSpeciesName(textElement, taxonName);
            } else if (rank === "Genus") {
                textElement.append('tspan')
                    .attr('style', 'font-style: italic;')
                    .text(taxonName || 'Unknown genus');
            } else {
                textElement.append('tspan')
                    .text(taxonName || 'Unknown taxon');
            }
        },

        appendSpeciesName(textElement, taxonName) {
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
        },

        setupNodeClickHandlers(node) {
            node.on('click', (event, d) => {
                const taxon = {
                    id: d.data.id,
                    taxonName: d.data.taxonName,
                    vernacularName: d.data.vernacularName,
                    rank: d.data.rank
                };
                ancestryPopup.openPopup(taxon);
            });
        },

        setupZoom(d3, width, height) {
            const svg = d3.select(ancestryDialog.container).select('svg');
            const g = svg.select('g');
            const bounds = g.node().getBBox();
            const fullWidth = width;
            const fullHeight = height;
            const scale = Math.min(fullWidth / bounds.width, fullHeight / bounds.height) * 0.9;
            const tx = (fullWidth - bounds.width * scale) / 2 - bounds.x * scale;
            const ty = (fullHeight - bounds.height * scale) / 2 - bounds.y * scale;

            g.attr('transform', `translate(${tx},${ty}) scale(${scale})`);

            const zoom = d3.zoom()
                .scaleExtent([0.5, 3])
                .on('zoom', (event) => {
                    g.attr('transform', event.transform);
                });

            svg.call(zoom)
               .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));

            return zoom;
        },

        getNodeText(d, showTaxonomic) {
            let taxonName = d.data.taxonName || 'Unknown';
            if (d.data.rank === "Species") {
                taxonName = utils.string.shortenSpeciesName(taxonName);
            }
            const rankText = ["Species", "Genus", "Stateofmatter"].includes(d.data.rank) ? "" : `${utils.string.capitalizeFirstLetter(d.data.rank)} `;

            if (!showTaxonomic && d.data.vernacularName && d.data.vernacularName !== "-") {
                const truncatedVernacular = utils.string.truncate(d.data.vernacularName, 24);
                return { rankText: "", taxonName: truncatedVernacular, text: truncatedVernacular, length: truncatedVernacular.length };
            }

            return { rankText, taxonName, text: `${rankText}${taxonName}`, length: (`${rankText}${taxonName}`).length };
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
                    ancestryDialog.graphRendering.updateNodeTextContent(textElement, rankText, taxonName, d.data.rank);
                });

            // Recalculate and update node sizes if necessary
            this.updateNodeSizes();
        },

        updateNodeTextContent(textElement, rankText, taxonName, rank) {
            if (rankText) {
                textElement.append('tspan').text(rankText);
            }

            if (rank === "Species") {
                this.formatSpeciesName(textElement, taxonName);
            } else if (rank === "Genus") {
                this.formatGenusName(textElement, taxonName);
            } else {
                this.formatOtherRankName(textElement, taxonName);
            }
        },

        formatSpeciesName(textElement, taxonName) {
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
        },

        formatGenusName(textElement, taxonName) {
            textElement.append('tspan')
                .attr('style', 'font-style: italic;')
                .text(taxonName || 'Unknown genus');
        },

        formatOtherRankName(textElement, taxonName) {
            textElement.append('tspan')
                .text(taxonName || 'Unknown taxon');
        },

        updateNodeSizes() {
            if (!this.lastCreatedTree) {
                logger.warn('No tree to update sizes');
                return;
            }

            const { d3, svg, width, height, zoom } = this.lastCreatedTree;

            // Recalculate node widths
            svg.selectAll('.ancestry-tree__node')
                .each((d, i, nodes) => {
                    const node = d3.select(nodes[i]);
                    const textElement = node.select('.ancestry-tree__node-text');
                    const textWidth = textElement.node().getComputedTextLength();
                    const newWidth = Math.max(101, textWidth + this.PADDING * 2);
                    
                    // Update rectangle width
                    node.select('.ancestry-tree__node-rect')
                        .attr('width', newWidth)
                        .attr('x', -newWidth / 2);

                    // Store the new width on the node data
                    d.nodeWidth = newWidth;
                });

            // Recalculate tree layout
            const root = d3.hierarchy(this.lastCreatedTree.data);
            const treeLayout = d3.tree()
                .size([width, height * 0.95])
                .nodeSize([d => d.nodeWidth + 20, this.NODE_HEIGHT * 2]); // Add some padding between nodes

            treeLayout(root);

            // Update node positions
            svg.selectAll('.ancestry-tree__node')
                .transition()
                .duration(750)
                .attr('transform', d => `translate(${d.x},${d.y})`);

            // Update links
            svg.selectAll('.ancestry-tree__link')
                .transition()
                .duration(750)
                .attr('d', d3.linkVertical()
                    .x(d => d.x)
                    .y(d => d.y));

            // Adjust zoom to fit the new layout
            this.fitZoom(d3, svg, width, height, zoom);
        },

        fitZoom(d3, svg, width, height, zoom) {
            const g = svg.select('g');
            const bounds = g.node().getBBox();
            const scale = Math.min(width / bounds.width, height / bounds.height) * 0.9;
            const tx = (width - bounds.width * scale) / 2 - bounds.x * scale;
            const ty = 20;

            svg.transition()
               .duration(750)
               .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
        },
    },

    utils: {

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

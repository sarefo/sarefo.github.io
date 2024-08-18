import api from './api.js';
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
            await ancestryDialog.utils.loadVisJs();
            if (ancestryDialog.container) {
                ancestryDialog.ui.createLoadingIndicator();
            }
            ancestryDialog.initialized = true;
        },
    },

    ui: {
        createLoadingIndicator() {
            if (!ancestryDialog.container) return;
            ancestryDialog.loadingIndicator = this.ui.createLoadingElement();
            ancestryDialog.container.appendChild(ancestryDialog.loadingIndicator);
        },

        createLoadingElement() {
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.style.display = 'none';

            const elements = [
                this.ui.createLogoElement(),
                this.ui.createSpinnerElement(),
                this.ui.createMessageElement()
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
        showExistingGraph() {
            if (ancestryDialog.currentData && ancestryDialog.container) {
                logger.debug("Showing existing graph");
                if (ancestryDialog.network) {
                    ancestryDialog.network.fit();
                } else {
                    ancestryDialog.graphRendering.renderGraph(
                        ancestryDialog.currentData.taxon1,
                        ancestryDialog.currentData.taxon2,
                        ancestryDialog.currentData.commonAncestor
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

            if (!this.graphManagement.validateTaxonNames(taxonImageOne, taxonImageTwo)) return;

            dialogManager.openDialog('ancestry-dialog');

            try {
                await ancestryDialog.initialization.initialize(container);
                await this.graphManagement.handleGraphDisplay(taxonImageOne, taxonImageTwo);
            } catch (error) {
                this.graphManagement.handleGraphError(error);
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

        async handleGraphDisplay(taxonImageOne, taxonImageTwo) {
            if (this.graphManagement.isSameTaxaPair(taxonImageOne, taxonImageTwo)) {
                logger.debug("Showing existing graph for the same taxa pair");
                ancestryDialog.graphManagement.showExistingGraph();
            } else {
                logger.debug("Creating new graph for a different taxa pair");
                await this.graphManagement.createNewGraph(taxonImageOne, taxonImageTwo);
            }
        },

        isSameTaxaPair(taxonImageOne, taxonImageTwo) {
            return ancestryDialog.currentGraphTaxa &&
                ancestryDialog.currentGraphTaxa[0] === taxonImageOne &&
                ancestryDialog.currentGraphTaxa[1] === taxonImageTwo;
        },

        async createNewGraph(taxonImageOne, taxonImageTwo) {
            ancestryDialog.graphManagement.clearGraph();
            await ancestryDialog.dataProcessing.findRelationship(taxonImageOne, taxonImageTwo);
            ancestryDialog.currentGraphTaxa = [taxonImageOne, taxonImageTwo];
        },

        handleGraphError(error) {
            logger.error('Error showing taxa relationship:', error);
            alert('Failed to load the relationship graph. Please try again later.');
            dialogManager.closeDialog('ancestry-dialog');
        },
    },

    dataProcessing: {
        async findRelationship(taxonName1, taxonName2) {
            if (!ancestryDialog.initialized) {
                throw new Error('Viewer not initialized. Call initialize() first.');
            }

            ancestryDialog.ui.showLoadingIndicator();

            try {
                const [taxon1, taxon2] = await this.dataProcessing.fetchTaxonData(taxonName1, taxonName2);
                const [ancestry1, ancestry2] = await this.dataProcessing.fetchAncestryData(taxonName1, taxonName2);

                this.dataProcessing.updateTaxonAncestry(taxon1, ancestry1);
                this.dataProcessing.updateTaxonAncestry(taxon2, ancestry2);

                const commonAncestor = ancestryDialog.utils.findCommonAncestor(taxon1, taxon2);
                ancestryDialog.currentData = { taxon1, taxon2, commonAncestor };
                await ancestryDialog.graphRendering.renderGraph(taxon1, taxon2, commonAncestor);
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
            this.dataProcessing.addEndNodesToLocalDetails(localAncestorDetails, taxon1, taxon2);

            const ancestorDetails = await api.taxonomy.fetchAncestorDetails(ancestorIds);
            this.dataProcessing.mergeAncestorDetails(localAncestorDetails, ancestorDetails);

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
        async renderGraph(taxon1, taxon2, commonAncestorId) {
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
                var vernacularName = nodeData.vernacularName && nodeData.vernacularName !== "n/a" && nodeData.vernacularName !== "N/a" ?
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
        }
    },

    utils: {
        loadVisJs() {
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
        },

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

// Bind all methods to ensure correct 'this' context
Object.keys(ancestryDialog).forEach(key => {
    if (ancestryDialog[key] && typeof ancestryDialog[key] === 'object') {
        Object.keys(ancestryDialog[key]).forEach(subKey => {
            if (typeof ancestryDialog[key][subKey] === 'function') {
                ancestryDialog[key][subKey] = ancestryDialog[key][subKey].bind(ancestryDialog);
            }
        });
    }
});

const publicAPI = {
    showTaxaRelationship: ancestryDialog.graphManagement.showTaxaRelationship
};

export default publicAPI;

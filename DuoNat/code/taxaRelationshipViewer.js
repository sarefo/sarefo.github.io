import api from './api.js';
import logger from './logger.js';
import utils from './utils.js';
import dialogManager from './dialogManager.js';

const taxaRelationshipViewer = {
    container: null,
    network: null,
    initialized: false,
    loadingIndicator: null,
    currentData: null,
    currentGraphTaxa: null,

    initialization: {
        async initialize(container) {
            taxaRelationshipViewer.container = container;
            await taxaRelationshipViewer.utils.loadVisJs();
            if (taxaRelationshipViewer.container) {
                taxaRelationshipViewer.ui.createLoadingIndicator();
            }
            taxaRelationshipViewer.initialized = true;
        },
    },

    ui: {
        createLoadingIndicator() {
            if (!taxaRelationshipViewer.container) return;
            taxaRelationshipViewer.loadingIndicator = document.createElement('div');
            taxaRelationshipViewer.loadingIndicator.className = 'loading-indicator';

            const logo = document.createElement('img');
            logo.src = './images/icon-512x512.png';
            logo.alt = 'DuoNat logo';
            logo.className = 'loading-indicator-logo';

            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';

            const message = document.createElement('p');
            message.innerHTML = '<span>Building relationship graph...';

            taxaRelationshipViewer.loadingIndicator.appendChild(logo);
            taxaRelationshipViewer.loadingIndicator.appendChild(spinner);
            taxaRelationshipViewer.loadingIndicator.appendChild(message);

            taxaRelationshipViewer.loadingIndicator.style.display = 'none';
            taxaRelationshipViewer.container.appendChild(taxaRelationshipViewer.loadingIndicator);
        },

        showLoadingIndicator() {
            if (taxaRelationshipViewer.loadingIndicator) {
                taxaRelationshipViewer.loadingIndicator.style.display = 'block';
            }
        },

        hideLoadingIndicator() {
            if (taxaRelationshipViewer.loadingIndicator) {
                taxaRelationshipViewer.loadingIndicator.style.display = 'none';
            }
        },

        openTaxonPage(url) {
            window.open(url, '_blank');
        },
    },

    graphManagement: {
        showExistingGraph() {
            if (taxaRelationshipViewer.currentData && taxaRelationshipViewer.container) {
                logger.debug("Showing existing graph");
                if (taxaRelationshipViewer.network) {
                    taxaRelationshipViewer.network.fit();
                } else {
                    taxaRelationshipViewer.graphRendering.renderGraph(
                        taxaRelationshipViewer.currentData.taxon1,
                        taxaRelationshipViewer.currentData.taxon2,
                        taxaRelationshipViewer.currentData.commonAncestor
                    );
                }
            } else {
                logger.error("No existing graph data to show");
            }
        },

        clearGraph() {
            if (taxaRelationshipViewer.network) {
                taxaRelationshipViewer.network.destroy();
                taxaRelationshipViewer.network = null;
            }
            taxaRelationshipViewer.currentData = null;
            if (taxaRelationshipViewer.container) {
                taxaRelationshipViewer.container.innerHTML = '';
                taxaRelationshipViewer.ui.createLoadingIndicator();
            }
        },

        async showTaxaRelationship() {
            const { taxonImageOne, taxonImageTwo } = state.getGameState();
            const container = document.getElementById('phylogeny-dialog__graph');
            const dialog = document.getElementById('phylogeny-dialog');

            if (!taxonImageOne || !taxonImageTwo) {
                logger.error('Taxon names not available');
                alert('Unable to show relationship. Please try again after starting a new game.');
                return;
            }

            dialogManager.openDialog('phylogeny-dialog');

            try {
                await taxaRelationshipViewer.initialization.initialize(container);

                if (taxaRelationshipViewer.currentGraphTaxa &&
                    taxaRelationshipViewer.currentGraphTaxa[0] === taxonImageOne &&
                    taxaRelationshipViewer.currentGraphTaxa[1] === taxonImageTwo) {
                    logger.debug("Showing existing graph for the same taxa pair");
                    taxaRelationshipViewer.graphManagement.showExistingGraph();
                } else {
                    logger.debug("Creating new graph for a different taxa pair");
                    taxaRelationshipViewer.graphManagement.clearGraph();
                    await taxaRelationshipViewer.dataProcessing.findRelationship(taxonImageOne, taxonImageTwo);
                    taxaRelationshipViewer.currentGraphTaxa = [taxonImageOne, taxonImageTwo];
                }
            } catch (error) {
                logger.error('Error showing taxa relationship:', error);
                alert('Failed to load the relationship graph. Please try again later.');
                dialogManager.closeDialog('phylogeny-dialog');
            }
        },
    },

    dataProcessing: {
        async findRelationship(taxonName1, taxonName2) {
            if (!taxaRelationshipViewer.initialized) {
                throw new Error('Viewer not initialized. Call initialize() first.');
            }

            taxaRelationshipViewer.ui.showLoadingIndicator();

            try {
                const [taxon1, taxon2] = await Promise.all([
                    taxaRelationshipViewer.utils.fetchTaxonData(taxonName1),
                    taxaRelationshipViewer.utils.fetchTaxonData(taxonName2)
                ]);

                const [ancestry1, ancestry2] = await Promise.all([
                    api.taxonomy.getAncestryFromLocalData(taxonName1),
                    api.taxonomy.getAncestryFromLocalData(taxonName2)
                ]);

                taxon1.ancestor_ids = Array.isArray(taxon1.ancestor_ids) ? taxon1.ancestor_ids : Array.from(taxon1.ancestor_ids || []);
                taxon2.ancestor_ids = Array.isArray(taxon2.ancestor_ids) ? taxon2.ancestor_ids : Array.from(taxon2.ancestor_ids || []);

                if (ancestry1.length > 0) taxon1.ancestor_ids = ancestry1;
                if (ancestry2.length > 0) taxon2.ancestor_ids = ancestry2;

                const commonAncestor = taxaRelationshipViewer.utils.findCommonAncestor(taxon1, taxon2);
                taxaRelationshipViewer.currentData = { taxon1, taxon2, commonAncestor };
                await taxaRelationshipViewer.graphRendering.renderGraph(taxon1, taxon2, commonAncestor);
            } catch (error) {
                logger.error('Error finding relationship:', error);
                throw error;
            } finally {
                taxaRelationshipViewer.ui.hideLoadingIndicator();
            }
        },

      async fetchAncestorDetails(ancestorIds, taxon1, taxon2) {
        ancestorIds = Array.isArray(ancestorIds) ? ancestorIds : Array.from(ancestorIds || []);
        logger.debug('Fetching ancestor details for IDs:', ancestorIds);

        const localAncestorDetails = new Map();

        // Add end nodes (taxon1 and taxon2) to localAncestorDetails
        const endNodes = [taxon1, taxon2];
        for (const taxon of endNodes) {
          if (taxon && taxon.id) {
            localAncestorDetails.set(taxon.id, {
              id: taxon.id,
              name: taxon.name,
              rank: taxon.rank,
              preferred_common_name: taxon.preferred_common_name
            });
            logger.debug(`Added local data for end node ${taxon.id}:`, localAncestorDetails.get(taxon.id));
          }
        }

        // Fetch ancestor details from API (which now checks local taxonHierarchy.json first)
        const ancestorDetails = await api.taxonomy.fetchAncestorDetails(ancestorIds);

        // Merge API results with localAncestorDetails
        ancestorDetails.forEach((value, key) => {
          if (!localAncestorDetails.has(key)) {
            localAncestorDetails.set(key, value);
            //        logger.debug(`Added ancestry data for ID ${key}:`, value);
          }
        });

        return localAncestorDetails;
      },

    },

    graphRendering: {

  async renderGraph(taxon1, taxon2, commonAncestorId) {
    // Clear any existing graph
    if (taxaRelationshipViewer.network) {
      taxaRelationshipViewer.network.destroy();
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
        if (!current) break; // Break the loop if we reach a null node
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

    const addNodeAndEdges = (taxon, parentId) => {
      const nodeData = hierarchy.getTaxonById(taxon.id);
      if (!nodeData) {
        logger.error(`Node data not found for taxon ID: ${taxon.id}`);
        return;
      }

      const isEndTaxon = nodeData.id.toString() === taxon1.id.toString() ||
        nodeData.id.toString() === taxon2.id.toString();

      var taxonName = nodeData.taxonName || `Unknown Taxon ${nodeData.id}`;
      var taxonRank = utils.string.capitalizeFirstLetter(nodeData.rank || 'Unknown');
      var vernacularName = nodeData.vernacularName && nodeData.vernacularName !== "n/a" && nodeData.vernacularName !== "N/a" ?
          `\n(${utils.string.capitalizeFirstLetter(nodeData.vernacularName)})` : "";

      if (taxonRank === "Species" || taxonRank === "Genus" || taxonRank === "Stateofmatter") { vernacularName = ""; }
      if (taxonRank === "Species") { taxonName = utils.string.shortenSpeciesName(taxonName); }
      if (taxonRank === "Species" || taxonRank === "Genus" || taxonRank === "Stateofmatter") { taxonRank = ""; }

      const existingNode = nodes.get(nodeData.id);
      if (!existingNode) {
        const nodeColor = isEndTaxon ? '#ffa500' : '#74ac00';

        nodes.add({
          id: nodeData.id,
          label: `${taxonRank} ${taxonName}${vernacularName}`,
          color: nodeColor,
          url: `https://www.inaturalist.org/taxa/${nodeData.id}`,
          title: 'Click to view on iNaturalist'
        });
        if (parentId) edges.add({ from: parentId, to: nodeData.id });
      } else {
        if (isEndTaxon && existingNode.color !== '#ffa500') {
          nodes.update({ id: nodeData.id, color: '#ffa500' });
        }
      }
    };

    const processAncestry = (taxon) => {
      const ancestors = getAncestors(taxon);
      ancestors.forEach((ancestor, index) => {
        const parentId = index > 0 ? ancestors[index - 1].id : null;
        addNodeAndEdges(ancestor, parentId);
      });
    };

    processAncestry(node1);
    processAncestry(node2);

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

    taxaRelationshipViewer.network = new vis.Network(taxaRelationshipViewer.container, data, options);
    taxaRelationshipViewer.container.classList.add('clickable-network');

    taxaRelationshipViewer.network.on("click", (params) => {
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
Object.keys(taxaRelationshipViewer).forEach(key => {
    if (taxaRelationshipViewer[key] && typeof taxaRelationshipViewer[key] === 'object') {
        Object.keys(taxaRelationshipViewer[key]).forEach(subKey => {
            if (typeof taxaRelationshipViewer[key][subKey] === 'function') {
                taxaRelationshipViewer[key][subKey] = taxaRelationshipViewer[key][subKey].bind(taxaRelationshipViewer);
            }
        });
    }
});

export default taxaRelationshipViewer;

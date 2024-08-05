import api from './api.js';
import logger from './logger.js';
import utils from './utils.js';

const taxaRelationshipViewer = {
  container: null,
  network: null,
  initialized: false,
  loadingIndicator: null,
  currentData: null,

  openTaxonPage(url) {
    window.open(url, '_blank');
  },

  async initialize(container) {
    this.container = container;
    await this.loadVisJs();
    if (this.container) {
      this.createLoadingIndicator();
    }
    this.initialized = true;
  },

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

  createLoadingIndicator() {
    if (!this.container) return;
    this.loadingIndicator = document.createElement('div');
    this.loadingIndicator.className = 'loading-indicator';

    const logo = document.createElement('img');
    logo.src = './images/icon-512x512.png';
    logo.alt = 'DuoNat logo';
    logo.className = 'loading-indicator-logo';

    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';

    const message = document.createElement('p');
    message.innerHTML = '<span>Building relationship graph...';

    this.loadingIndicator.appendChild(logo);
    this.loadingIndicator.appendChild(spinner);
    this.loadingIndicator.appendChild(message);

    this.loadingIndicator.style.display = 'none';
    this.container.appendChild(this.loadingIndicator);
  },

  showLoadingIndicator() {
    if (this.loadingIndicator) {
      this.loadingIndicator.style.display = 'block';
    }
  },

  hideLoadingIndicator() {
    if (this.loadingIndicator) {
      this.loadingIndicator.style.display = 'none';
    }
  },

  showExistingGraph() {
    if (this.currentData && this.container) {
      logger.debug("Showing existing graph");
      if (this.network) {
        // If the network already exists, just fit the view
        this.network.fit();
      } else {
        // If the network doesn't exist (e.g., if the container was cleared), recreate it
        this.renderGraph(this.currentData.taxon1, this.currentData.taxon2, this.currentData.commonAncestor);
      }
    } else {
      logger.error("No existing graph data to show");
    }
  },

  async findRelationship(taxonName1, taxonName2) {
    if (!this.initialized) {
      throw new Error('Viewer not initialized. Call initialize() first.');
    }

    this.showLoadingIndicator();

    try {
      const [taxon1, taxon2] = await Promise.all([
        this.fetchTaxonData(taxonName1),
        this.fetchTaxonData(taxonName2)
      ]);

      // Fetch ancestry from local data
      const [ancestry1, ancestry2] = await Promise.all([
        api.getAncestryFromLocalData(taxonName1),
        api.getAncestryFromLocalData(taxonName2)
      ]);

      // Convert Set to Array if necessary
      taxon1.ancestor_ids = Array.isArray(taxon1.ancestor_ids) ? taxon1.ancestor_ids : Array.from(taxon1.ancestor_ids || []);
      taxon2.ancestor_ids = Array.isArray(taxon2.ancestor_ids) ? taxon2.ancestor_ids : Array.from(taxon2.ancestor_ids || []);

      // Use local ancestry if available
      if (ancestry1.length > 0) taxon1.ancestor_ids = ancestry1;
      if (ancestry2.length > 0) taxon2.ancestor_ids = ancestry2;

      const commonAncestor = this.findCommonAncestor(taxon1, taxon2);
      this.currentData = { taxon1, taxon2, commonAncestor };
      await this.renderGraph(taxon1, taxon2, commonAncestor);
    } catch (error) {
      logger.error('Error finding relationship:', error);
      throw error;
    } finally {
      this.hideLoadingIndicator();
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

    // Fetch ancestor details from API (which now checks local ancestryInfo.json first)
    const ancestorDetails = await api.fetchAncestorDetails(ancestorIds);

    // Merge API results with localAncestorDetails
    ancestorDetails.forEach((value, key) => {
      if (!localAncestorDetails.has(key)) {
        localAncestorDetails.set(key, value);
//        logger.debug(`Added ancestry data for ID ${key}:`, value);
      }
    });

    return localAncestorDetails;
  },

  clearGraph() {
    if (this.network) {
      this.network.destroy();
      this.network = null;
    }
    this.currentData = null;
    if (this.container) {
      this.container.innerHTML = '';
      this.createLoadingIndicator(); // Recreate the loading indicator
    }
  },

  async fetchTaxonData(name) {
    return api.fetchTaxonDetails(name);
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

  async renderGraph(taxon1, taxon2, commonAncestorId) {
    // Clear any existing graph
    if (this.network) {
      this.network.destroy();
    }
    const nodes = new vis.DataSet();
    const edges = new vis.DataSet();


    const allAncestorIds = new Set([...taxon1.ancestor_ids, ...taxon2.ancestor_ids]);
    const ancestorDetails = await this.fetchAncestorDetails(allAncestorIds, taxon1, taxon2);

    const addNodeAndEdges = (taxon, parentId) => {
      const nodeData = ancestorDetails.get(taxon.id) || taxon;
//      logger.debug('Adding node:', nodeData);

      var vernacularName = nodeData.preferred_common_name ?
        `\n(${utils.capitalizeFirstLetter(nodeData.preferred_common_name)})` : "";
      const isSpecificTaxon = nodeData.id === taxon1.id || nodeData.id === taxon2.id;

      var taxonName = nodeData.name || `Unknown Taxon ${nodeData.id}`;
      var taxonRank = utils.capitalizeFirstLetter(nodeData.rank || 'Unknown');
      if (taxonRank === "Species" || taxonRank === "Genus" || taxonRank === "Stateofmatter") { vernacularName = ""; }
      if (taxonRank === "Species") { taxonName = utils.shortenSpeciesName(taxonName); }
      if (taxonRank === "Species" || taxonRank === "Genus" || taxonRank === "Stateofmatter") { taxonRank = ""; }

      if (!nodes.get(nodeData.id)) {
        nodes.add({
          id: nodeData.id,
          label: `${taxonRank} ${taxonName}${vernacularName}`,
          color: isSpecificTaxon ? '#ffa500' : '#74ac00',
          url: `https://www.inaturalist.org/taxa/${nodeData.id}`,
          title: 'Click to view on iNaturalist'
        });
        if (parentId) edges.add({ from: parentId, to: nodeData.id });
      }
    };

    const processAncestry = (taxon) => {
      const ancestorIds = taxon.ancestor_ids || [];
      const reversedAncestors = ancestorIds.slice().reverse();

      // Add all ancestors
      reversedAncestors.forEach((ancestorId, index, array) => {
        const parentId = array[index + 1] || null;
        const ancestorTaxon = ancestorDetails.get(ancestorId) || { id: ancestorId, name: `Unknown Taxon ${ancestorId}` };
        addNodeAndEdges(ancestorTaxon, parentId);
        if (ancestorId === commonAncestorId) return false;
      });

      // Add the specific taxon as a leaf node
      const immediateParentId = reversedAncestors[0];
      addNodeAndEdges(taxon, immediateParentId);
    };

    // Ensure both taxa are processed and marked as specific taxa
    processAncestry(taxon1);
    processAncestry(taxon2);

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

    this.network = new vis.Network(this.container, data, options);
    this.container.classList.add('clickable-network');

    this.network.on("click", (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodes.get(nodeId);
        if (node && node.url) {
          window.open(node.url, '_blank');
        }
      }
    });
  }
};

export default taxaRelationshipViewer;


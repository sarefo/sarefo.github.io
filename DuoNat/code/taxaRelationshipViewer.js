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
        
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        
        const message = document.createElement('p');
        message.innerHTML = '<span>Building relationship graph...</span><br><br><span>Click on a node to open the taxon in iNaturalist!</span>';
        
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
    const response = await fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(name)}&per_page=1&all_names=true`);
    const data = await response.json();
    if (data.results.length === 0) throw new Error(`Taxon not found: ${name}`);
    return data.results[0];
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

      async fetchAncestorDetails(ancestorIds) {
        const ancestorDetails = new Map();
        for (const id of ancestorIds) {
          const response = await fetch(`https://api.inaturalist.org/v1/taxa/${id}`);
          const data = await response.json();
          if (data.results.length > 0) {
            ancestorDetails.set(id, data.results[0]);
          }
        }
        return ancestorDetails;
      },

    async renderGraph(taxon1, taxon2, commonAncestorId) {
        // Clear any existing graph
        if (this.network) {
          this.network.destroy();
        }
        const nodes = new vis.DataSet();
        const edges = new vis.DataSet();

        const allAncestorIds = new Set([...taxon1.ancestor_ids, ...taxon2.ancestor_ids]);
        const ancestorDetails = await this.fetchAncestorDetails(allAncestorIds);

        const addNodeAndEdges = (taxon, parentId) => {
            var vernacularName = taxon.preferred_common_name ? `\n(${taxon.preferred_common_name})` : "";
            const isSpecificTaxon = taxon.id === taxon1.id || taxon.id === taxon2.id;

            var taxonName = taxon.name;
            var taxonRank = utils.capitalizeFirstLetter(taxon.rank);
            if (taxonRank==="Species" || taxonRank==="Genus" || taxonRank==="Stateofmatter") { vernacularName = ""; }
            if (taxonRank==="Species") { taxonName = utils.shortenSpeciesName(taxon.name); }
            if (taxonRank==="Species" || taxonRank==="Genus" || taxonRank==="Stateofmatter") { taxonRank = ""; }

            if (!nodes.get(taxon.id)) {
                nodes.add({ 
                    id: taxon.id, 
                    label: `${taxonRank} ${taxonName}${vernacularName}`,
                    color: isSpecificTaxon ? '#ffa500' : '#74ac00',
                    url: `https://www.inaturalist.org/taxa/${taxon.id}`, // Add this line
                    title: 'Click to view on iNaturalist'
                });
                if (parentId) edges.add({ from: parentId, to: taxon.id });
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


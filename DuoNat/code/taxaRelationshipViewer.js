const taxaRelationshipViewer = {
  container: null,
  network: null,
  initialized: false,

  async initialize(container) {
    this.container = container;
    await this.loadVisJs();
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

  async findRelationship(taxonName1, taxonName2) {
    if (!this.initialized) {
      throw new Error('Viewer not initialized. Call initialize() first.');
    }

    try {
      const [taxon1, taxon2] = await Promise.all([
        this.fetchTaxonData(taxonName1),
        this.fetchTaxonData(taxonName2)
      ]);
      
      const commonAncestor = this.findCommonAncestor(taxon1, taxon2);
      await this.renderGraph(taxon1, taxon2, commonAncestor);
    } catch (error) {
      console.error('Error finding relationship:', error);
      throw error;
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
    const nodes = new vis.DataSet();
    const edges = new vis.DataSet();

    const allAncestorIds = new Set([...taxon1.ancestor_ids, ...taxon2.ancestor_ids]);
    const ancestorDetails = await this.fetchAncestorDetails(allAncestorIds);

    const addNodeAndEdges = (taxon, parentId) => {
        var vernacularName = taxon.preferred_common_name ? `\n(${taxon.preferred_common_name})` : "";
        const isSpecificTaxon = taxon.id === taxon1.id || taxon.id === taxon2.id;

        var taxonRank = taxon.rank.charAt(0).toUpperCase() + taxon.rank.slice(1);
        // undecided whether to include vernacular in genus
        if (taxonRank==="Species" || taxonRank==="Genus" || taxonRank==="Stateofmatter") { vernacularName = ""; }
        if (taxonRank==="Species" || taxonRank==="Genus" || taxonRank==="Stateofmatter") { taxonRank = ""; }

        // doesn't work
        const labelFont = (taxon.rank === "genus" || taxon.rank === "species") ? "italic" : "";

        if (!nodes.get(taxon.id)) {
            nodes.add({ 
                id: taxon.id, 
                label: `${taxonRank} ${taxon.name}${vernacularName}`,
                color: isSpecificTaxon ? '#ffa500' : '#74ac00', // Alternate color for specific taxa
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
            }
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
},

  logTaxonData(taxon) {
  //  console.log('Taxon data:', JSON.stringify(taxon, null, 2));
  }
};

export default taxaRelationshipViewer;

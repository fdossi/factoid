// this file contains integration with the model to the cytoscape.js visualisation

$(function(){
  var isTouchDevice = ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch; // taken from modernizr 
	var $graph = $('#graph');
  var minZoom = 0.5;
  var maxZoom = 2;


  $graph.cytoscape({

    //hideEdgesOnViewport: isTouchDevice ? true : false,

    minZoom: minZoom,
    maxZoom: maxZoom,

    showOverlay: false,

    style: cytoscape.stylesheet()
      .selector('node')
        .css({
          height: 40,
          width: 40,
          textValign: 'center',
          textHalign: 'center',
          color: '#fff',
          backgroundColor: '#888',
          textOutlineColor: '#888',
          textOutlineWidth: 3
        })
      .selector('node[type="entity"]')
        .css({
          content: 'data(name)',
          backgroundColor: '#555',
          textOutlineColor: '#555',
        })
      .selector('node:selected')
        .css({
          borderWidth: 3,
          borderColor: '#fdb722'
        })
      .selector('node[type="interaction"], node.edgehandles-preview')
        .css({
          height: 20,
          width: 20,
          shape: 'rectangle',
          content: ''
        })
      .selector('edge')
        .css({
          width: 2
        })
      .selector('edge:active')
        .css({
          overlayOpacity: 0
        })

      // edgehandles css
      .selector('.edgehandles-source')
        .css({
          'border-color': '#0094d6',
          'border-width': 3
        })
      .selector('.edgehandles-target, node.edgehandles-preview')
        .css({
          'background-color': '#0094d6',
          'text-outline-color': '#0094d6'
        })
      .selector('edge.edgehandles-preview, edge.edgehandles-ghost')
        .css({
          'line-color': '#0094d6',
          'target-arrow-color': '#0094d6',
          'source-arrow-color': '#0094d6'
        })
      .selector('edge.edgehandles-ghost')
        .css({
          'target-arrow-shape': 'triangle'
        })
      .selector('node:active')
        .css({
          'overlay-color': 'black',
          'overlay-padding': 10,
          'overlay-opacity': 0.125
        })
      .selector('node.newly-added')
        .css({
          'border-color': '#0094d6',
          'border-width': 3
        })
      .selector('node.focus')
        .css({
          'background-color': '#E89F05',
          'text-outline-color': '#E89F05'
        })
    ,

    ready: function( e ){
      window.cy = e.cy;

      var json = cyutil.entities2json( doc.entities() );
      cy.add( json );
    }
  }); // cytocsape


  // inject arbor into the page
  // unfortunately, we need to include it this way for webworkers to work properly
  $('head').append('<script type="text/javascript" src="/js/arbor.js"></script>');

  function addEdgeForParticipant(entityId, interactionId){
    cy.add({
      group: 'edges',
      data: {
        source: interactionId,
        target: entityId
      }
    });
  }

  // add element to cytoscape when an element is added in the model
  doc.addEntity(function( entity ){
    var ele = cy.add({
      group: 'nodes',
      position: entity.viewport,
      data: {
        id: entity.id,
        name: entity.name,
        type: entity.type,
        interaction: entity.interaction ? true : false
      },
      classes: ( entity.interaction ? ' interaction' : '' )
    });

    var pids = entity.participantIds;
    if( pids ){ // then create connections

      var intId =  entity.id;
      for( var i = 0; i < pids.length; i++ ){
        var pid = pids[i];

        addEdgeForParticipant( pid, intId );
      }
    }

    if( !entity.interaction ){
      ele.addClass('newly-added');
      setTimeout(function(){
        ele.removeClass('newly-added');
      }, 500);
    }
  });

  // remove element from cytoscape when its entity is removed from the model
  doc.removeEntity(function( id ){
    cy.getElementById( id ).remove();
  });

  // code for keeping a record of updated node positions
  var movedNodes = [];
  var movedNode = {};
  function updateNodePosition( node, clearList ){
    addNodeToPositionList( node );

    posUpdateFn( clearList );
  }

  function addNodeToPositionList( node ){
    var id = node.id();
    var alreadyHandled = movedNode[ id ];

    if( !alreadyHandled ){
      movedNodes.push( node );
      movedNode[ id ] = true;
    }
  }

  function clearPositionList(){
    movedNodes = [];
    movedNode = {};
  }

  // update node positions in the model periodically
  var posUpdateFn;
  var posUpdateFnT = 500;
  posUpdateFn = _.throttle( function( clearList ){
    // get the lists and set to empty so we're not handling more events as they come in
    var mNodes = movedNodes;
    var mNode = movedNode;

    if( clearList === undefined || clearList ){
      clearPositionList();
    }

    for( var i = 0; i < mNodes.length; i++ ){ // for each node
      var node = mNodes[i];
      var pos = node.position();
      var id = node.id();

      if( doc.entity(id) ){ // verify the node is a model entity
        doc.entityViewport( id, pos );
      }
    } 
  }, posUpdateFnT );

  // when a node is moved, update its position
  $graph.cytoscape(function(e){
    cy.on('updateposition', 'node', function(){ 
      updateNodePosition(this);
    });

    var seldNodes;

    cy.on('grab', 'node', function(){
      seldNodes = cy.$('node:selected').add( this );

      for( var i = 0; i < seldNodes.length; i++ ){
        var node = seldNodes[i];

        addNodeToPositionList(node);
      }
    });

    cy.on('drag', 'node', function(){
      posUpdateFn( false );
    } );

    cy.on('free', 'node', function(){
      clearPositionList();
    });

    cy.on('layoutstop', function(){
      var nodes = cy.$('node');
      for( var i = 0; i < nodes.length; i++ ){
        var node = nodes[i];

        updateNodePosition(node);
      }
    });
  });

  // when the viewport is updated on the server, update its node position
  doc.entityViewport(function(entityId, viewport){
    cy.getElementById(entityId)
      //.stop( true )
      // .animate({ position: viewport })
      .position( viewport )
    ;
  });

  // update doc selection state on graph selection changes
  $graph.cytoscape(function(e){
    cy
      .on('select unselect', 'node', function(){ 
        var node = this;
        var id = node.id();
        
        doc.entitySelected( id, node.is(':selected') );
      })
    ;
  });

  // add the panzoom control
  if( !isTouchDevice ){ 
    $graph.cytoscape(function(){
      $graph.cytoscapePanzoom({
        minZoom: minZoom,
        maxZoom: maxZoom,
        sliderHandleIcon: 'icon-minus',
        zoomInIcon: 'icon-plus',
        zoomOutIcon: 'icon-minus',
        resetIcon: 'icon-resize-full'
      });
    });
  }

  // add the edgehandles plugin
  $graph.cytoscape(function(){
    $graph.cytoscapeEdgehandles({
      preview: true,
      handleSize: 16,
      handleColor: "#0094d6",
      lineType: "straight", // can be "straight" or "draw"
      
      edgeType: function( sourceNode, targetNode ){
        var eitherIsInteraction = sourceNode.data('interaction') || targetNode.data('interaction');
        var alreadyConnected = eitherIsInteraction && sourceNode.edgesWith( targetNode ).size() !== 0;

        if( alreadyConnected ){
          return null; // => no edge to be added
        } else if( eitherIsInteraction ){
          return 'flat';
        } else {
          return 'node';
        }
      },
      
      loopAllowed: function( node ){
        return false;
      },
      
      nodeParams: function( sourceNode, targetNode ){
        return {
          classes: 'edgehandlestemp'
        };
      },
      
      edgeParams: function( sourceNode, targetNode ){
        return {
          classes: 'edgehandlestemp'
        };
      },

      start: function( sourceNode ){ // fired when edgehandles interaction starts (drag on handle)
        
      },

      // TODO document this callback a bit more, since the whole process is a bit complex
      complete: function( sourceNode, targetNodes, addedEles ){ // fired when edgehandles is done and entities are added
        var srcIsInteraction = sourceNode.data('interaction');

        if( srcIsInteraction ){ // then each added ele is an edge and we just need to make connections
          var intNode = sourceNode;
          var intId = intNode.id();

          for( var i = 0; i < addedEles.length; i++ ){ // for each edge, make the connection
            var edge = addedEles[i];
            var entNode = edge.connectedNodes().not( intNode );
            var entId = entNode.id();

            doc.connectEntityToInteraction( entId, intId );
          }


        } else { // then the source is just an entity that we connect diff. interactions to
          var entNode = sourceNode;
          var entId = sourceNode.id();
          var newNodes = addedEles.nodes();
          var newEdges = addedEles.edges();

          // for each new node, make an interaction
          var newNodeId2Interaction = {};
          for( var i = 0; i < newNodes.length; i++ ){ 
            var newNode = newNodes[i];

            var interaction = doc.addInteraction({
              viewport: newNode.position()
            });
            newNodeId2Interaction[ newNode.id() ] = interaction;
          }

          // connect each new interaction to its two entities
          var edgeAlreadyDealtWith = {};
          for( var i = 0; i < newNodes.length; i++ ){ 
            var newNode = newNodes[i];
            var newNodeId = newNode.id();
            var interaction = newNodeId2Interaction[ newNodeId ];

            // new node => all edges were just added
            var connEdges = newNode.connectedEdges();

            // for each new edge, make a connection
            for( var j = 0; j < connEdges.length; j++ ){
              var edge = connEdges[j];

              // we're handling a new node => node connected to other edge must be a real entity
              var otherEntNode = edge.connectedNodes().not( newNode );
              var otherEntId = otherEntNode.id();

              // connect the interaction to the other entity
              doc.connectEntityToInteraction( otherEntId, interaction.id );
              edgeAlreadyDealtWith[ edge.id() ] = true;
            }
          }

          // (all unhandled (i.e. not dealth with) edges are not connected to new nodes)
          //  &&
          // (source node is entity)
          //  =>
          // (the unhandles edges are each connected to a real interaction node)
          for( var i = 0; i < newEdges.length; i++ ){
            var newEdge = newEdges[i];

            // only deal with edges we need to
            if( edgeAlreadyDealtWith[ newEdge.id() ] ){ continue; }

            var intNode = newEdge.connectedNodes().not( entNode );
            var intId = intNode.id();

            doc.connectEntityToInteraction( entId, intId );
          }
        }

        addedEles.remove(); // remove the added eles since they were just for show
      },

      stop: function( sourceNode ){ // fired when edgehandles interaction is stopped (either complete with added edges or incomplete)
        
      }
    });

    cy.on('tap', 'node', function(){
      var id = this.id();
      var $entry = $( document.getElementById('entity-' + id) );
      var $info = $('#info');
      var scroll = $info.scrollTop();
      var offset = $entry.offset().top;

      $info.animate({
        scrollTop: scroll + offset
      }, 250);
    });

  }); // on ready

  // update names when the doc changes
  doc.entityName(function(entityId, name){
    cy.getElementById( entityId ).data( 'name', name );
  });

  doc.connectEntityToInteraction(function(entityId, interactionId){
    addEdgeForParticipant( entityId, interactionId );
  });

  doc.disconnectEntityFromInteraction(function(entityId, interactionId){
    var ent = cy.getElementById( entityId );
    var inter = cy.getElementById( interactionId );

    var edge = inter.edgesTo( ent );
    edge.remove();
  });

  doc.initLayoutIfNecessary(function( next ){
    $graph.cytoscape(function(){

      cy.one('layoutstop', function(){ // after cy init layout from load (actually changes nothing)

        cyutil.relayout(function(){
          next(); // layout done => pass control
        });

      });

    });
  });
  
});
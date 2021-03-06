// code for handling user interaction with the extendo ui

$(function(){

  var $graph = $('#graph');

  var $lastInfoQtip, $lastOrgQtip;

  var isDemo = location.pathname === '/doc/demo' || ( location.hash.length >= 5 && location.hash.substring(0, 5) === '#demo' );

  $('#extendo-container').extendo({
    startOpen: true,
    closeOnSelect: false,
    closeOnBgFocus: false,
    classes: "top left",
    expander: {
      content: '<span class="icon-chevron-down"></span>'
    },
    items: [
      {
        content: '<span class="icon-plus"></span><span class="icon-circle"></span><label>Entity</label>',
        attrs: {
          id: 'extendo-add',
          'data-tooltip': 'Add entity'
        },
        select: function(){
          cyutil.addEntityInGoodPosition();
          doc.showEditForLastAdded(function(){
            ui.focusWhenVisible( 'edit-name-input-' + doc.getLastAddedEntity().id );
          });
        }
      },

      {
        content: '<span class="icon-remove destructive"></span><label>Delete</label>',
        disabled: true,
        attrs: {
          id: 'extendo-remove',
          'data-tooltip': 'Remove selected entities'
        },
        select: function(){
          cyutil.deleteSelectedEntitiesInDoc();          
        }
      },

      {
        content: '<span class="icon-pencil"></span><label>Draw</label>',
        togglable: true,
        attrs: {
          id: 'extendo-draw',
          'data-tooltip': 'Draw to edit'
        },
        toggleon: function(){
          cyutil.drawMode( true );      
        },
        toggleoff: function(){
          cyutil.drawMode( false ); 
        }
      },

      {
        content: '<span class="icon-remove"></span><span class="icon-asterisk"></span><label>Delete all</label>',
        disabled: true,
        attrs: {
          id: 'extendo-remove-all',
          'data-tooltip': 'Remove all entities'
        },
        select: function(){
          doc.removeAllEntities();
          doc.resetStages();
          doc.resetOrganisms();       
        },
        hidden: !isDemo
      },

      // disable since it's also in the panzoom control
      // {
      //   content: '<span class="icon-resize-horizontal"></span>',
      //   attrs: {
      //     id: 'extendo-fit',
      //     'data-tooltip': 'Fit entities to screen'
      //   },
      //   select: function(){
      //     cy.fit(50);
      //   }
      // },

      {
        content: '<span class="icon-refresh"></span><label>Reposition</label>',
        attrs: {
          id: 'extendo-layout',
          'data-tooltip': 'Auto-rearrange entities'
        },
        select: function(){
          cyutil.relayout();
        }
      },

      {
        content: '<span class="icon-download-alt"></span><label>Download</label>',
        attrs: {
          id: 'extendo-download',
          'data-tooltip': 'Download document as SIF'
        },
        select: function(){
          doc.exportAsSif();
        }
      },

      // {
      //   content: '<span class="icon-male"></span><label>Organisms</label>',
      //   attrs: {
      //     id: 'extendo-organism',
      //     'data-tooltip': 'Set organisms of interest'
      //   },
      //   select: function(){

      //   }
      // },

      {
        content: '<span class="icon-info-sign"></span>',
        attrs: {
          id: 'extendo-info'
        },
        select: function(){
          doc.showOverlay('about');
        }
      }

      // {
      //   href: 'https://github.com/PathwayCommons/factoid',
      //   content: '<span class="factoid-logo">F</span>',
      //   attrs: {
      //     id: 'extendo-linkout',
      //     'data-tooltip': 'Open project on GitHub'
      //   }
      // }
    ]
  });

  var $org = $('#extendo-organism');
  
  $.helperQtip({
    events: 'tap',
    selector: '#extendo-organism'
  }, {
    content: {
      text: $('#organism-select')
    },

    style: { classes: 'organism-qtip' }
  });

  // update the state of the delete button based on what's selected in the graph
  var $remove = $('#extendo-remove');
  var setRemoveEnabledState = _.debounce(function(){ // debounce so we don't overdo things with quickly changing selections
    var anyNodesSelected = cy.$('node:selected').size() !== 0;

    if( anyNodesSelected ){
      $remove.extendo('enable');
    } else {
      $remove.extendo('disable');
    }
  }, 100);

  $graph.cytoscape(function(){
    cy

      // call the update function whenever the selection state changes
      .on('select unselect remove', 'node', function(){ // on selection change
        setRemoveEnabledState();
      })

      // update the layout extendo item whenever No. of nodes changes
      .on('add remove', 'node', function(){ // on add/remove nodes
        var anyNodes = cy.nodes().length !== 0;

        if( anyNodes ){
          $layout.extendo('enable');
          $removeAll.extendo('enable');
        } else {
          $layout.extendo('disable');
          $removeAll.extendo('disable');
        }
      })
      
    ;

    var anyNodes = cy.nodes().length !== 0;

    if( anyNodes ){
      $removeAll.extendo('enable');
    } else {
      $removeAll.extendo('disable');
    }

  });


  var $removeAll = $('#extendo-remove-all');

  // update the state of the layout button
  var $layout = $('#extendo-layout');
  $graph.cytoscape(function(){
    cy
      .on('layoutstart', function(){
        $layout.extendo('disable');
        doc.showOverlay('layout');
      })

      .on('layoutstop', function(){
        $layout.extendo('enable');
        doc.hideOverlay('layout');
      })
    ;
  });

});
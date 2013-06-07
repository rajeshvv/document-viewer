// This manages events for different states activated through DV interface actions like clicks, mouseovers, etc.
DV.Schema.events = {
  // Change zoom level and causes a reflow and redraw of pages.
  zoom: function(level){
    var viewer = this.viewer;
    var continuation = function() {
      viewer.pages.zoom({ zoomLevel: level });
      var ranges = viewer.models.document.ZOOM_RANGES;
      viewer.dragReporter.sensitivity = ranges[ranges.length-1] == level ? 1.5 : 1;
      viewer.notifyChangedState();
      return true;
    };
    viewer.confirmStateChange ? viewer.confirmStateChange(continuation) : continuation();
  },

  // Draw (or redraw) the visible pages on the screen.
  drawPages: function() {
    if (this.viewer.state.name != 'ViewDocument') return;
    var doc           = this.viewer.models.document;
    var win           = this.viewer.elements.window[0]; // this.viewer.$el.find('.DV-pages')
    var offsets       = doc.baseHeightsPortionOffsets;  // calculated from DV.model.Document.computeOffsets
    var scrollPos     = this.viewer.scrollPosition = win.scrollTop;
    var midpoint      = scrollPos + (this.viewer.$(win).height() / 3);
    var currentPage   = _.sortedIndex(offsets, scrollPos);
    var middlePage    = _.sortedIndex(offsets, midpoint);

    if (offsets[currentPage] == scrollPos) { currentPage++; middlePage++; }
    var pageIds       = this.viewer.helpers.sortPages(middlePage - 1);
    var total         = this.viewer.model.get('pages');
    if (doc.currentPage() != currentPage) doc.setPageIndex(currentPage - 1);
    this.drawPageAt(pageIds, middlePage - 1);
  },

  // Draw the page at the given index.
  drawPageAt : function(pageIds, index) {
    var first = index == 0;
    var last  = index == this.viewer.models.document.totalPages - 1;
    if (first) index += 1;
    var pages = [
      { label: pageIds[0], index: index - 1 },
      { label: pageIds[1], index: index },
      { label: pageIds[2], index: index + 1 }
    ];
    if (last) pages.pop();
    pages[first ? 0 : pages.length - 1].currentPage = true;
    this.viewer.pages.draw(pages);
  },

  check: function(){
    var viewerState = this.viewer.state;
    if(viewerState.busy === false){
      viewerState.busy = true;
      for(var i = 0; i < viewerState.observers.length; i++){
        this[viewerState.observers[i]].call(this);
      }
      viewerState.busy = false;
    }
  },

  loadText: function(pageIndex,afterLoad){

    pageIndex = (!pageIndex) ? this.viewer.models.document.currentIndex() : parseInt(pageIndex,10);
    this._previousTextIndex = pageIndex;

    var me = this;

    var processText = function(text) {
      var pageNumber = parseInt(pageIndex,10)+1;
      me.viewer.$('.DV-textContents').replaceWith('<pre class="DV-textContents">' + text + '</pre>');
      me.viewer.elements.currentPage.text(pageNumber);
      me.viewer.elements.textCurrentPage.text('p. '+(pageNumber));
      me.viewer.models.document.setPageIndex(pageIndex);
      me.viewer.helpers.setActiveChapter(me.viewer.models.chapters.getChapterId(pageIndex));

      // fix this so that it edits the text in the page model.
      if (me.viewer.openEditor == 'editText' &&
          !(pageNumber in me.models.document.originalPageText)) {
        me.viewer.models.document.originalPageText[pageNumber] = text;
      }
      if (me.viewer.openEditor == 'editText') {
        me.viewer.$('.DV-textContents').attr('contentEditable', true).addClass('DV-editing');
      }

      if(afterLoad) afterLoad.call(me.viewer.helpers);
    };

    if (me.viewer.model.pages.findWhere({index: pageIndex}).get('text')) {
      return processText(me.viewer.model.pages.findWhere({index: pageIndex}).get('text'));
    }

    var handleResponse = DV.jQuery.proxy(function(response) {
      var page = me.viewer.model.pages.findWhere({index: pageIndex});
      page.set('text', response);
      processText(response);
    }, this);

    this.viewer.$('.DV-textContents').text('');

    var textURI = me.viewer.model.pages.resources.text.replace('{page}', pageIndex + 1);
    var crossDomain = this.viewer.helpers.isCrossDomain(textURI);
    if (crossDomain) textURI += '?callback=?';
    DV.jQuery[crossDomain ? 'getJSON' : 'get'](textURI, {}, handleResponse);
  },

  resetTracker: function(){
    this.viewer.activeAnnotation = null;
    this.trackAnnotation.combined     = null;
    this.trackAnnotation.h            = null;
  },
  trackAnnotation: function(){
    var viewer          = this.viewer;
    var helpers         = this.helpers;
    var scrollPosition  = this.viewer.elements.window[0].scrollTop;

    if(viewer.activeAnnotation){
      var annotation      = viewer.activeAnnotation;
      var trackAnnotation = this.viewer.state.eventFunctions.trackAnnotation;


      if(trackAnnotation.id != annotation.id){
        trackAnnotation.id = annotation.id;
        viewer.helpers.setActiveAnnotationLimits(annotation);
      }
      if(!viewer.activeAnnotation.annotationEl.hasClass('DV-editing') &&
         (scrollPosition > (trackAnnotation.h) || scrollPosition < trackAnnotation.combined)) {
        annotation.hide(true);
        viewer.pages.setActiveAnnotation(null);
        viewer.activeAnnotation   = null;
        trackAnnotation.h         = null;
        trackAnnotation.id        = null;
        trackAnnotation.combined  = null;
      }
    }else{
      viewer.pages.setActiveAnnotation(null);
      viewer.activeAnnotation   = null;
      trackAnnotation.h         = null;
      trackAnnotation.id        = null;
      trackAnnotation.combined  = null;
      viewer.helpers.removeObserver('trackAnnotation');
    }
  }
};
qwebirc.ui.AutoScroll = new Class({
  Extends: Fx.Scroll,
  Binds: ['onScroll', 'update'],
  initialize: function(element) {
    this.parent(element, {});
    this.element.addEvent('scroll', this.onScroll);
    window.addEvent('resize', this.update);
    this.scrolling = true;
  },
  update: function() {
    if(this.scrolling)
        this.toBottom();
  },
  onScroll: function() {
    /* TODO: activate/deactivate on scroll */
  }
});

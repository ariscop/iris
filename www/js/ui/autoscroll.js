qwebirc.ui.AutoScroll = new Class({
  Extends: Fx.Scroll,
  Binds: ['onScroll', 'update'],
  initialize: function(element) {
    this.parent(element, {wheelStops: true});
    this.element.addEvent('scroll', this.onScroll);
    window.addEvent('resize', this.update);
    this.scrolling = true;
  },
  update: function() {
    if(this.scrolling)
        this.toBottom();
  },
  onScroll: function() {
    /* If we're at the bottom, start autoscrolling */
    this.scrolling = this.scrolledDown();
  },
  scrolledDown: function() {
    var prev = this.element.getScroll();
    var prevbottom = this.element.getScrollSize().y;
    var prevheight = this.element.clientHeight;

    /*
     * fixes an IE bug: the scrollheight is less than the actual height
     * when the div isn't full
     */
    if(prevbottom < prevheight)
      prevbottom = prevheight;

    return prev.y + prevheight >= prevbottom;
  }
});

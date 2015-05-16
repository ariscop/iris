qwebirc.ui.AutoScroll = new Class({
  Extends: Fx.Scroll,
  Binds: ['onScroll', 'doScroll', 'update'],
  initialize: function(element) {
    this.parent(element, {wheelStops: true});
    this.element.addEvent('scroll', this.onScroll);
    this.scrolling = true;
    this.timeout = false;
    window.addEvent('resize', this.update);
  },
  update: function() {
    if(this.scrolling && !this.timeout)
      /* Defer scrolling, browsers don't seem to reflow instantly */
      this.timeout = setTimeout(this.doScroll, 1);
  },
  doScroll: function() {
    /* Set the scrolling flag, just in case */
    this.scrolling = true;

    /* Clear the timeout */
    this.timeout = false;

    /* And scroll */
    this.toBottom();
  },
  onScroll: function() {
    /* If we're at the bottom, start autoscrolling */
    if(!this.isRunning())
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

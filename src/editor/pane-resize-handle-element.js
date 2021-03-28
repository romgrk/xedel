const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')

/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
class PaneResizeHandleElement extends Gtk.Box {
  constructor(props) {
    super(Gtk.Orientation.HORIZONTAL)
  }

  createdCallback() {
    this.resizePane = this.resizePane.bind(this);
    this.resizeStopped = this.resizeStopped.bind(this);
    return this.subscribeToDOMEvents();
  }

  subscribeToDOMEvents() {
    this.addEventListener('dblclick', this.resizeToFitContent.bind(this));
    return this.addEventListener('mousedown', this.resizeStarted.bind(this));
  }

  attachedCallback() {
    // For some reason Chromium 58 is firing the attached callback after the
    // element has been detached, so we ignore the callback when a parent element
    // can't be found.
    if (this.parentElement) {
      this.isHorizontal = this.parentElement.hasCssClass("horizontal");
      return this.addCssClass(this.isHorizontal ? 'horizontal' : 'vertical');
    }
  }

  detachedCallback() {
    return this.resizeStopped();
  }

  resizeToFitContent() {
    // clear flex-grow css style of both pane
    if (this.previousSibling != null) {
      this.previousSibling.model.setFlexScale(1);
    }
    return (this.nextSibling != null ? this.nextSibling.model.setFlexScale(1) : undefined);
  }

  resizeStarted(e) {
    e.stopPropagation();
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.addCssClass('atom-pane-cursor-overlay');
      this.overlay.addCssClass(this.isHorizontal ? 'horizontal' : 'vertical');
      this.appendChild(this.overlay);
    }
    document.addEventListener('mousemove', this.resizePane);
    return document.addEventListener('mouseup', this.resizeStopped);
  }

  resizeStopped() {
    document.removeEventListener('mousemove', this.resizePane);
    document.removeEventListener('mouseup', this.resizeStopped);
    if (this.overlay) {
      this.removeChild(this.overlay);
      return this.overlay = undefined;
    }
  }

  calcRatio(ratio1, ratio2, total) {
    const allRatio = ratio1 + ratio2;
    return [(total * ratio1) / allRatio, (total * ratio2) / allRatio];
  }

  setFlexGrow(prevSize, nextSize) {
    this.prevModel = this.previousSibling.model;
    this.nextModel = this.nextSibling.model;
    const totalScale = this.prevModel.getFlexScale() + this.nextModel.getFlexScale();
    const flexGrows = this.calcRatio(prevSize, nextSize, totalScale);
    this.prevModel.setFlexScale(flexGrows[0]);
    return this.nextModel.setFlexScale(flexGrows[1]);
  }

  fixInRange(val, minValue, maxValue) {
    return Math.min(Math.max(val, minValue), maxValue);
  }

  resizePane({clientX, clientY, which}) {
    if (which !== 1) { return this.resizeStopped(); }
    if ((this.previousSibling == null) || (this.nextSibling == null)) { return this.resizeStopped(); }

    if (this.isHorizontal) {
      const totalWidth = this.previousSibling.clientWidth + this.nextSibling.clientWidth;
      //get the left and right width after move the resize view
      let leftWidth = clientX - this.previousSibling.getBoundingClientRect().left;
      leftWidth = this.fixInRange(leftWidth, 0, totalWidth);
      const rightWidth = totalWidth - leftWidth;
      // set the flex grow by the ratio of left width and right width
      // to change pane width
      return this.setFlexGrow(leftWidth, rightWidth);
    } else {
      const totalHeight = this.previousSibling.clientHeight + this.nextSibling.clientHeight;
      let topHeight = clientY - this.previousSibling.getBoundingClientRect().top;
      topHeight = this.fixInRange(topHeight, 0, totalHeight);
      const bottomHeight = totalHeight - topHeight;
      return this.setFlexGrow(topHeight, bottomHeight);
    }
  }
}

module.exports = PaneResizeHandleElement;

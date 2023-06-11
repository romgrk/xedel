const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')

/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {CompositeDisposable} = require('event-kit');
const PaneResizeHandleElement = require('./pane-resize-handle-element');

class PaneAxisElement extends Gtk.Box {
  constructor(props) {
    super(Gtk.Orientation.HORIZONTAL)
  }

  attachedCallback() {
    if (this.subscriptions == null) { this.subscriptions = this.subscribeToModel(); }
    return Array.from(this.model.getChildren()).map((child, index) => this.childAdded({child, index}));
  }

  detachedCallback() {
    this.subscriptions.dispose();
    this.subscriptions = null;
    return Array.from(this.model.getChildren()).map((child) => this.childRemoved({child}));
  }

  initialize(model, viewRegistry) {
    this.model = model;
    this.viewRegistry = viewRegistry;
    if (this.subscriptions == null) { this.subscriptions = this.subscribeToModel(); }
    const iterable = this.model.getChildren();
    for (let index = 0; index < iterable.length; index++) { const child = iterable[index]; this.childAdded({child, index}); }

    switch (this.model.getOrientation()) {
      case 'horizontal':
        this.addCssClass('horizontal');
        this.addCssClass('pane-row');
        break;
      case 'vertical':
        this.addCssClass('vertical');
        this.addCssClass('pane-column');
        break;
    }
    return this;
  }

  subscribeToModel() {
    const subscriptions = new CompositeDisposable;
    subscriptions.add(this.model.onDidAddChild(this.childAdded.bind(this)));
    subscriptions.add(this.model.onDidRemoveChild(this.childRemoved.bind(this)));
    subscriptions.add(this.model.onDidReplaceChild(this.childReplaced.bind(this)));
    subscriptions.add(this.model.observeFlexScale(this.flexScaleChanged.bind(this)));
    return subscriptions;
  }

  isPaneResizeHandleElement(element) {
    return (element != null ? element.nodeName.toLowerCase() : undefined) === 'atom-pane-resize-handle';
  }

  childAdded({child, index}) {
    let resizeHandle;
    const view = this.viewRegistry.getView(child);
    this.insertBefore(view, this.children[index * 2]);

    const prevElement = view.previousSibling;
    // if previous element is not pane resize element, then insert new resize element
    if ((prevElement != null) && !this.isPaneResizeHandleElement(prevElement)) {
      resizeHandle = document.createElement('atom-pane-resize-handle');
      this.insertBefore(resizeHandle, view);
    }

    const nextElement = view.nextSibling;
    // if next element isnot resize element, then insert new resize element
    if ((nextElement != null) && !this.isPaneResizeHandleElement(nextElement)) {
      resizeHandle = document.createElement('atom-pane-resize-handle');
      return this.insertBefore(resizeHandle, nextElement);
    }
  }

  childRemoved({child}) {
    const view = this.viewRegistry.getView(child);
    const siblingView = view.previousSibling;
    // make sure next sibling view is pane resize view
    if ((siblingView != null) && this.isPaneResizeHandleElement(siblingView)) {
      siblingView.remove();
    }
    return view.remove();
  }

  childReplaced({index, oldChild, newChild}) {
    let focusedElement;
    if (this.hasFocus()) { focusedElement = document.activeElement; }
    this.childRemoved({child: oldChild, index});
    this.childAdded({child: newChild, index});
    if (document.activeElement === document.body) { return (focusedElement != null ? focusedElement.focus() : undefined); }
  }

  flexScaleChanged(flexScale) { return this.style.flexGrow = flexScale; }

  hasFocus() {
    return (this === document.activeElement) || this.contains(document.activeElement);
  }
}

module.exports = PaneAxisElement;

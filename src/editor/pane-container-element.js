const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')

const { CompositeDisposable } = require('event-kit');

class PaneContainerElement extends Gtk.Box {
  static name = 'PaneContainer'

  constructor(props) {
    super(Gtk.Orientation.HORIZONTAL)
    this.subscriptions = new CompositeDisposable();
    this.addCssClass('panes');
  }

  initialize(model, { views }) {
    this.model = model;
    this.views = views;
    if (this.views == null) {
      throw new Error(
        'Must pass a views parameter when initializing PaneContainerElements'
      );
    }
    this.subscriptions.add(this.model.observeRoot(this.rootChanged.bind(this)));
    return this;
  }

  rootChanged(root) {
    const focusedElement = this.hasFocus() ? xedel.window.getFocus() : null;
    if (this.getFirstChild() != null) {
      this.remove(this.getFirstChild())
    }
    if (root != null) {
      const view = this.views.getView(root);
      this.append(view);
      if (focusedElement != null) {
        focusedElement.grabFocus();
      }
    }
  }

  hasFocus() {
    const activeElement = xedel.window.getFocus()
    return (
      this === activeElement || this.containsChild(activeElement)
    );
  }
}

gi.registerClass(PaneContainerElement)

module.exports = PaneContainerElement;

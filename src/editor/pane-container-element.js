const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')

const { CompositeDisposable } = require('event-kit');

class PaneContainerElement extends Gtk.Box {
  static name = 'PaneContainer'

  constructor(props) {
    super(Gtk.Orientation.HORIZONTAL)
    this.subscriptions = new CompositeDisposable();
    this.addCssClass('panes');
    this.append(new Gtk.Label({ label: 'PaneContainer' }))
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
    // FIXME
    // const focusedElement = this.hasFocus() ? document.activeElement : null;
    // if (this.firstChild != null) {
    //   this.firstChild.remove();
    // }
    if (root != null) {
      const view = this.views.getView(root);
      this.append(view);
      // if (focusedElement != null) {
      //   focusedElement.focus();
      // }
    }
  }

  // hasFocus() {
  //   return (
  //     this === document.activeElement || this.contains(document.activeElement)
  //   );
  // }
}

gi.registerClass(PaneContainerElement)

module.exports = PaneContainerElement;

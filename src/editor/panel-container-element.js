const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')

// const { createFocusTrap } = require('focus-trap');
const { CompositeDisposable } = require('event-kit');

class PanelContainerElement extends Gtk.Box {
  static name = 'PanelContainer'

  constructor() {
    super(Gtk.Orientation.VERTICAL)
    this.subscriptions = new CompositeDisposable();
    this.on('realize', () => this.attachedCallback())
  }

  attachedCallback() {
    if (this.model.dock) {
      this.model.dock.elementAttached();
    }
  }

  initialize(model, viewRegistry) {
    this.model = model;
    this.viewRegistry = viewRegistry;

    this.subscriptions.add(
      this.model.onDidAddPanel(this.panelAdded.bind(this))
    );
    this.subscriptions.add(this.model.onDidDestroy(this.destroyed.bind(this)));
    this.addCssClass(this.model.getLocation());

    // Add the dock.
    if (this.model.dock != null) {
      this.append(this.model.dock.getElement());
    }

    return this;
  }

  getModel() {
    return this.model;
  }

  panelAdded({ panel, index }) {
    const panelElement = panel.getElement();
    panelElement.addCssClass(this.model.getLocation());
    if (this.model.isModal()) {
      panelElement.addCssClass('overlay');
      panelElement.addCssClass('from-top');
    } else {
      panelElement.addCssClass('tool-panel');
      panelElement.addCssClass(`panel-${this.model.getLocation()}`);
    }

    if (index >= this.childNodes.length) {
      this.append(panelElement);
    } else {
      const referenceItem = this.childNodes[index];
      panelElement.insertBefore(this, referenceItem)
    }

    if (this.model.isModal()) {
      this.hideAllPanelsExcept(panel);
      this.subscriptions.add(
        panel.onDidChangeVisible(visible => {
          if (visible) {
            this.hideAllPanelsExcept(panel);
          }
        })
      );

      if (panel.autoFocus) {
        const focusOptions = {
          // focus-trap will attempt to give focus to the first tabbable element
          // on activation. If there aren't any tabbable elements,
          // give focus to the panel element itself
          fallbackFocus: panelElement,
          // closing is handled by core Atom commands and this already deactivates
          // on visibility changes
          escapeDeactivates: false,
          delayInitialFocus: false
        };

        if (panel.autoFocus !== true) {
          focusOptions.initialFocus = panel.autoFocus;
        }
        // const modalFocusTrap = createFocusTrap(panelElement, focusOptions);

        this.subscriptions.add(
          panel.onDidChangeVisible(visible => {
            // if (visible) {
            //   modalFocusTrap.activate();
            // } else {
            //   modalFocusTrap.deactivate();
            // }
          })
        );
      }
    }
  }

  destroyed() {
    this.subscriptions.dispose();
    this.getParent()?.remove(this);
  }

  hideAllPanelsExcept(excludedPanel) {
    for (let panel of this.model.getPanels()) {
      if (panel !== excludedPanel) {
        panel.hide();
      }
    }
  }
}

gi.registerClass(PanelContainerElement)

module.exports = PanelContainerElement;

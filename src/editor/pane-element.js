const gi = require('node-gtk')
const Gtk = gi.require('Gtk', '4.0')
const Adw = gi.require('Adw', '1')

const path = require('path');
const { CompositeDisposable } = require('event-kit');

class PaneElement extends Gtk.Box {
  static name = 'Pane'

  constructor(props) {
    super({ orientation: Gtk.Orientation.VERTICAL })

    this.dataset = {}
    this.attached = false;
    this.subscriptions = new CompositeDisposable();
    this.subscriptionsByItem = new Map();
    this.initializeContent();
    this.subscribeToEvents(); // FIXME
  }

  attachedCallback = () => {
    this.attached = true;
    if (this.model.isFocused()) {
      this.grabFocus();
    }
  }

  detachedCallback = () => {
    this.attached = false;
  }

  initializeContent() {
    this.addCssClass('pane');
    this.itemBar = new Adw.TabBar();
    this.itemViews = new Adw.TabView();
    this.itemViews.addCssClass('item-views');
    this.itemBar.setView(this.itemViews)
    this.append(this.itemBar);
    this.append(this.itemViews);
  }

  subscribeToEvents() {
    // FIXME: implement these

    // const handleFocus = event => {
    //   if (
    //     !(
    //       this.isActivating ||
    //       this.model.isDestroyed() ||
    //       this.contains(event.relatedTarget)
    //     )
    //   ) {
    //     this.model.focus();
    //   }
    //   if (event.target !== this) return;
    //   const view = this.getActiveView();
    //   if (view) {
    //     view.focus();
    //     event.stopPropagation();
    //   }
    // };
    // const handleBlur = event => {
    //   if (!this.contains(event.relatedTarget)) {
    //     this.model.blur();
    //   }
    // };
    // const handleDragOver = event => {
    //   event.preventDefault();
    //   event.stopPropagation();
    // };
    // const handleDrop = event => {
    //   event.preventDefault();
    //   event.stopPropagation();
    //   this.getModel().activate();
    //   const pathsToOpen = [...event.dataTransfer.files].map(file => file.path);
    //   if (pathsToOpen.length > 0) {
    //     this.applicationDelegate.open({ pathsToOpen, here: true });
    //   }
    // };

    // this.addEventListener('focus', handleFocus, { capture: true });
    // this.addEventListener('blur', handleBlur, { capture: true });
    // this.addEventListener('dragover', handleDragOver);
    // this.addEventListener('drop', handleDrop);

    this.on('realize', this.attachedCallback)
    this.on('unrealize', this.detachedCallback)
  }

  initialize(model, { views, applicationDelegate }) {
    this.model = model;
    this.views = views;
    this.applicationDelegate = applicationDelegate;
    if (this.views == null) {
      throw new Error(
        'Must pass a views parameter when initializing PaneElements'
      );
    }
    if (this.applicationDelegate == null) {
      throw new Error(
        'Must pass an applicationDelegate parameter when initializing PaneElements'
      );
    }
    this.subscriptions.add(this.model.onDidActivate(this.activated.bind(this)));
    this.subscriptions.add(
      this.model.observeActive(this.activeStatusChanged.bind(this))
    );
    this.subscriptions.add(
      this.model.observeActiveItem(this.activeItemChanged.bind(this))
    );
    this.subscriptions.add(
      this.model.onDidRemoveItem(this.itemRemoved.bind(this))
    );
    this.subscriptions.add(
      this.model.onDidDestroy(this.paneDestroyed.bind(this))
    );
    this.subscriptions.add(
      this.model.observeFlexScale(this.flexScaleChanged.bind(this))
    );
    return this;
  }

  getModel() {
    return this.model;
  }

  activated() {
    this.isActivating = true;
    if (!this.hasFocus()) {
      // Don't steal focus from children.
      this.grabFocus();
    }
    this.isActivating = false;
  }

  activeStatusChanged(active) {
    if (active) {
      this.addCssClass('active');
    } else {
      this.removeCssClass('active');
    }
  }

  activeItemChanged(item) {
    delete this.dataset.activeItemName;
    delete this.dataset.activeItemPath;
    if (this.changePathDisposable != null) {
      this.changePathDisposable.dispose();
    }
    if (item == null) {
      return;
    }
    const hasFocus = this.hasFocus();
    const itemView = this.views.getView(item);
    const itemPath = typeof item.getPath === 'function' ? item.getPath() : null;
    if (itemPath) {
      this.dataset.activeItemName = path.basename(itemPath);
      this.dataset.activeItemPath = itemPath;
      if (item.onDidChangePath != null) {
        this.changePathDisposable = item.onDidChangePath(() => {
          const itemPath = item.getPath();
          this.dataset.activeItemName = path.basename(itemPath);
          this.dataset.activeItemPath = itemPath;
        });
      }
    }

    let page
    if (itemView.getParent() === null) {
      page = this.addItem(itemView);
    }
    else {
      page = this.findPage(itemView)
      if (page === -1)
        throw new Error('Page not found')
    }

    this.itemViews.setSelectedPage(page)

    if (hasFocus) {
      itemView.grabFocus();
    }
  }

  addItem(itemView) {
    const page = this.itemViews.addPage(itemView);
    page.setTitle(itemView.model.getTitle())

    const disposable = itemView.model.onDidChangeTitle(title => {
      page.setTitle(title)
    })
    this.subscriptionsByItem.set(itemView, disposable)
    return page
  }

  findPage(itemView) {
    const n = this.itemViews.getNPages()
    for (let i = 0; i < n; i++) {
      const page = this.itemViews.getNthPage(i)
      if (page.getChild() === itemView)
        return page
    }
    return null
  }

  itemRemoved({ item, /* index: not working, */ destroyed }) {
    const viewToRemove = this.views.getView(item);
    if (viewToRemove) {
      const page = this.findPage(viewToRemove)
      this.itemViews.closePage(page)
      this.itemViews.closePageFinish(page, true)
    }
    this.subscriptionsByItem.get(viewToRemove).dispose()
    this.subscriptionsByItem.delete(viewToRemove)
  }

  paneDestroyed() {
    this.subscriptionsByItem.forEach(d => d.dispose());
    this.subscriptions.dispose();
    if (this.changePathDisposable != null) {
      this.changePathDisposable.dispose();
    }
  }

  flexScaleChanged(flexScale) {
    // FIXME: implement this
    // this.style.flexGrow = flexScale;
  }

  getActiveView() {
    return this.views.getView(this.model.getActiveItem());
  }

  hasFocus() {
    let current = xedel.window.getFocus()
    while (current) {
      if (this === current)
        return true
      current = current.getParent()
    }
    return false
  }
}

module.exports = PaneElement;

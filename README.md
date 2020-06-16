
# xedel

The goal of xedel is to be a modern text editor, that would be a spiritual successor to neovim.
I should note that this is currently very hypothetical, don't be fooled by the nice screenshot
below, all the hard parts are yet to be implemented. The only reason I'm writing all
this is to inspire people to help me make this come true.

### Goals
 - Keyboard-centric, inspired from vim, kakoune, spacemacs
 - GUI, using native technologies (not electron)
 - Batteries-included, as in VSCode-equivalent
 - Extendable, using a decent scripting language

![Demo](./static/demo.png)

### Current technological choices
 - Node.js
 - GTK+ via node-gtk
 - tree-sitter via node-tree-sitter

While both Gtk+ and tree-sitter are usable from Rust, which could be an interesting language
choice, I've chosen to start with javascript because 1) I've never used Rust yet, and 2) Rust
compile times are bad, Javascript offers a faster feedback loop. Besides, critical parts of
the editor can be implemented in C/C++ (or maybe even Rust, not sure if it works for native
node.js modules).

Using node.js also provides a non-blocking model by default, being based on an event-loop at its
core. It also makes it easy to create a plugin system where authors can use Javascript, which is
the closest thing we have to a programming *lingua franca* (and that I happen to like a lot).

### Functionalities
 - [ ] UI (side panels, grid view, tabs)
 - [ ] Core: keyboard-mapping system
 - [ ] Syntax (tree-sitter)
 - [ ] Editor: rendering
 - [ ] Editor: marks & decorations
 - [ ] Editor: multi-cursor
 - [ ] Editor: API
 - [ ] Fuzzy-finder
 - [ ] File searching/replacing
 - [ ] Language Server Protocol
 - [ ] Debug Adapter Protocol
 - [ ] Plugin system
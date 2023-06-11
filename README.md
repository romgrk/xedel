
# xedel

The goal of xedel is to be a modern text editor, that would be a spiritual successor to neovim.
I should note that this is currently very hypothetical, the core part of the editor is mostly
working but there is still a lot of work to do to get it to a competitive point.

### Goals
 - Keyboard-centric, inspired from vim, kakoune, spacemacs
 - GUI, using native technologies (not electron)
 - Batteries-included, as in VSCode-equivalent
 - Extendable, using a decent scripting language

<p align="center">
  <img
    src="./static/demo.png"
    style="width: 500px; height: auto"
  />
</p>

### Current technological choices
 - Node.js
 - GTK+ via node-gtk
 - tree-sitter via node-tree-sitter

While both Gtk+ and tree-sitter are usable from Rust, which could be an interesting language
choice, I've chosen to start with javascript because 1) I've not used Rust a lot, and 2) Rust
compile times are bad, Javascript offers a faster feedback loop. Besides, critical parts of
the editor can be implemented in C/C++ or Rust with native modules.

Using node.js also provides a non-blocking model by default, being based on an event-loop at its
core. It also makes it easy to create a plugin system where authors can use Javascript, which is
the closest thing we have to a programming *lingua franca*.

### Current roadmap

To save time, I've decided to re-use as much of Atom's editing capabilities as possible, and
to replace the rendering code with a custom Gtk widget.
After that, I plan to re-use as much [vim-mode-plus](https://github.com/t9md/atom-vim-mode-plus)
code as possible for the core editing experience.

Once the core editing is done, the most important part will be to offer autocompletion & code
capabilities at the same level as VSCode. To do so, it could be wise to implement a compatibility
layer for VSCode extensions. Even though much of the code will be based on Atom, VSCode seems
to be the best future-proof option.

### Open questions

 - How to implement packages/plugins
 - Should we offer compatibility with VSCode extensions?

### Functionalities
 - [x] Editor: rendering
 - [x] Editor: marks & decorations
 - [x] Editor: multi-cursor
 - [x] Editor: API
 - [ ] Syntax (tree-sitter) (in progress)
 - [ ] Core: keyboard-mapping system (in progress)
 - [ ] Plugin system
 - [ ] UI (side panels, grid view, tabs)
 - [ ] Fuzzy-finder
 - [ ] File searching/replacing
 - [ ] Language Server Protocol
 - [ ] Debug Adapter Protocol


### License

MIT

The editing code (in `src/editor`) has been mostly extracted from
[Atom](https://github.com/atom/atom), also licensed under MIT.

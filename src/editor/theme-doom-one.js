/*
 * theme-doom-one.js
 */

const base0      = '#1B2229'
const base1      = '#1c1f24'
const base2      = '#202328'
const base3      = '#23272e'
const base4      = '#3f444a'
const base5      = '#5B6268'
const base6      = '#73797e'
const base7      = '#9ca0a4'
const base8      = '#b1b1b1'
const base9      = '#E6E6E6'

const grey       = base4
const red        = '#ff6c6b'
const orange     = '#da8548'
const green      = '#98be65'
const greenAlt   = '#799033'
const teal       = '#4db5bd'
const yellow     = '#ECBE7B'
const blue       = '#51afef'
const dark_blue  = '#2257A0'
const magenta    = '#c678dd'
const violet     = '#a9a1e1'
const cyan       = '#46D9FF'
const dark_cyan  = '#5699AF'
const white      = '#efefef'

const comment = base6

const theme = {
  'syntax--keyword': { foreground: blue },
    /* syntax--control
     * syntax--operator
     * syntax--special-method
     * syntax--unit */

  'syntax--storage': { foreground: blue },
    /* syntax--type
     *   syntax--annotation,
     *   syntax--primitive
     * syntax--modifier
     *   syntax--package,
     *   syntax--import */

  'syntax--support': { foreground: yellow },
    /* syntax--support
     *   syntax--class
     *   syntax--type
     *   syntax--function 
     *     syntax--any-method */

  'syntax--constant': { foreground: violet },
    /* syntax--variable
     * syntax--charactersyntax--escape
     * syntax--numeric
     * syntax--othersyntax--color
     * syntax--othersyntax--symbol */
  'syntax--numeric': { foreground: red },

  'syntax--string': { foreground: green },
    /* > syntax--source, syntax--embedded
     *   syntax--regexp
     *     syntax--sourcesyntax--rubysyntax--embedded
     *   syntax--othersyntax--link */

  'syntax--comment': { foreground: comment },
    /* 'syntax--markup': {},
     * 'syntax--link': {},
     * 'syntax--entity': {}, */
    /* syntax--namesyntax--type
     * syntax--othersyntax--inherited-class */

  'syntax--punctuation': { foreground: blue },
    /* syntax--punctuation
     *   syntax--definition
     *     syntax--comment
     *     syntax--method-parameters,
     *     syntax--function-parameters,
     *     syntax--parameters,
     *     syntax--separator,
     *     syntax--seperator,
     *     syntax--array
     *     syntax--heading,
     *     syntax--identity
     *     syntax--bold
     *       font-weight: bold;
     *     syntax--italic
     *       font-style: italic;
     *   syntax--section
     *     syntax--embedded
     *     syntax--method,
     *     syntax--class,
     *     syntax--inner-class */

  'syntax--method-call': { foreground: yellow },
    /* syntax--meta
     *   syntax--class
     *     syntax--body
     *   syntax--method-call,
     *   syntax--method
     *   syntax--definition
     *     syntax--variable
     *   syntax--link
     *   syntax--require
     *   syntax--selector
     *   syntax--separator
     *   syntax--tag */
}

/* syntax--variable
 *   syntax--interpolation
 *   syntax--parameter */
/* syntax--entity
 *   syntax--namesyntax--function
 *   syntax--namesyntax--class,
 *   syntax--namesyntax--typesyntax--class
 *   syntax--namesyntax--section
 *   syntax--namesyntax--tag
 *   syntax--othersyntax--attribute-name
 *     syntax--id */
/* syntax--underline
 *   text-decoration: underline;
 * syntax--none
 * syntax--invalid
 *   syntax--deprecated
 *   syntax--illegal */

// Languages -------------------------------------------------
/* syntax--markup
 *   syntax--bold
 *     font-weight: bold;
 *   syntax--changed
 *   syntax--deleted
 *   syntax--italic
 *     font-style: italic;
 *   syntax--heading
 *     syntax--punctuationsyntax--definitionsyntax--heading
 *   syntax--link
 *   syntax--inserted
 *   syntax--quote
 *   syntax--raw */

module.exports = theme

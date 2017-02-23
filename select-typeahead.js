/*!
 * SelectTypeahead
 *
 * A configurable, super simple and extremely fast typeahead solution
 * for <select> elements.
 *
 * Copyright 2017 Anders Evenrud <andersevenrud@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * @version 0.5.5
 * @package SelectTypeahead
 * @author Anders Evenrud <andersevenrud@gmail.com>
 * @license MIT
 */
(function() {
  'use strict';

  /*
   * Replace localized characters
   */
  function removeLocale(str) {
    return str.replace(/[ÀÁÂÃÄÅÅÆ]/g, 'A')
      .replace(/[àáâãäåæ]/g, 'a')
      .replace(/[ÈÉÊË]/g, 'E')
      .replace(/[ØÖ]/g, 'O')
      .replace(/[øö]/g, 'o')
      .replace(/\s+/g, ' ')
      ;//.replace(/[^a-z0-9\s]/gi, '');
  }

  /*
   * The simplest string matching function
   */
  function simpleMatch(input, entry) {
    input = input.toLowerCase();
    entry = entry.toLowerCase();

    return entry.substr(0, input.length) === input || entry.indexOf(input) !== -1;
  }

  /*
   * Returns a Node based on input query
   */
  function getElementFromArg(el) {
    if ( typeof el === 'string' ) {
      if ( el.substr(0, 1) === '#' ) {
        el = document.getElementById(el);
      } else {
        el = document.body.querySelector(el);
      }
    }
    return el;
  }

  /*
   * Faster then V8's internal .forEach, especially
   * when bound with `Node` object.
   */
  function forEach(arr, cb) {
    var i = 0;
    var l = arr.length;

    for ( i; i < l; i++ ) {
      cb(arr[i], i);
    }
  }

  /*
   * Faster then V8's internal .find(), also
   * a polyfill
   */
  function find(arr, match) {
    var i = 0;
    var l = arr.length;

    for ( i; i < l; i++ ) {
      if ( match(arr[i], i) ) {
        return arr[i];
      }
    }

    return null;
  }

  /*
   * Fastest Node mapping
   */
  function mapNodes(el, fn) {
    var children = el.querySelectorAll('option');
    var data = [];
    var i = 0, l = children.length, e;
    for ( i; i < l; i++ ) {
      e = children[i];
      data.push({
        index: i,
        value: e.value,
        label: e.textContent,
        text: String(fn(e.textContent)).trim()
      });
    }
    return data;
  }

  /*
   * Fills Nodes and returns data
   */
  function fillNodes(el, fn, datas) {
    var option, text;
    var data = [];
    var frag = document.createDocumentFragment();
    for ( var i in datas ) {
      var text = datas[i];
      var option = new Option(text, i);
      frag.appendChild(option);

      data.push({
        index: data.length,
        value: i,
        label: text,
        text: String(fn(text)).trim()
      });
    }

    el.innerHTML = '';
    el.appendChild(frag);
    return data;
  }

  /*
   * Figure out event target
   */
  function getEventTarget(ev) {
    var row = ev.target;
    if ( ev.target.tagName === 'SPAN' ) {
      row = ev.target.parentNode;
    } else if ( ev.target.tagName !== 'LI' ) {
      row = null;
    }
    return row;
  }

  /*
   * Creates a new document fragment with entries
   * for the dropdown
   */
  function createDropdown(data, dropdown) {
    var frag = document.createDocumentFragment();

    var i = 0, l = data.length, v, e, s;
    for ( i; i < l; i++ ) {
      v = data[i];

      e = document.createElement('li');
      e.setAttribute('data-index', String(i));
      e.setAttribute('data-value', String(v.value));

      s = document.createElement('span');
      s.appendChild(document.createTextNode(v.label));

      e.appendChild(s);
      frag.appendChild(e);
    }

    dropdown.appendChild(frag);
  }

  /////////////////////////////////////////////////////////////////////////////
  // WIDGET
  /////////////////////////////////////////////////////////////////////////////

  /**
   * Create a new SelectTypeahead instance
   *
   * @param {String|Node}   el                        The <SELECT> to use
   * @param {Object}        [opts]                    Options
   * @param {Object}        [opts.data]               A key/value paired object instead of select data
   * @param {Function}      [opts.fnDataFilter]       A function that filters the dropdown values
   * @param {Function}      [opts.fnInputFilter]      A function that filters the input value
   * @param {Function}      [opts.fnMatch]            A function that performs A->B matching
   * @param {Number}        [opts.keyTimeout=100]     A timeout for key presses
   * @param {String}        [opts.buttonLabel='>']    A label for the button
   * @param {Array|String}  [opts.className]          A className to give the instance (or array)
   * @param {Boolean}       [opts.calcWidth=true]     Set the width of the widget
   */
  function SelectTypeahead(el, opts) {
    opts = opts || {};
    opts.fnDataFilter = opts.fnDataFilter || removeLocale;
    opts.fnInputFilter = opts.fnInputFilter || removeLocale;
    opts.fnMatch = opts.fnMatch || simpleMatch;
    opts.keyTimeout = opts.keyTimeout || 100;
    opts.buttonLabel = opts.buttonLabel || '>';
    opts.className = opts.className || [];
    opts.calcWidth = opts.calcWidth !== false;

    el = getElementFromArg(el);
    if ( !el || el.tagName !== 'SELECT' ) {
      throw new TypeError('Invalid element given');
    }
    if ( el.getAttribute('data-select-typeahead') === 'true' ) {
      return;
    }

    var classNames = typeof opts.className === 'string'
      ? opts.className.replace(/\s+/g, ' ').split(' ')
      : opts.className;
    classNames.unshift('SelectTypeahead');

    var data = [];
    if ( opts.data ) {
      data = fillNodes(el, opts.fnDataFilter, opts.data);
    } else {
      data = mapNodes(el, opts.fnDataFilter);
    }

    this.loaded = false;
    this.options = opts;
    this.data = data; // Original data list
    this.currentList = data; // Currently used list
    this.tempIndex = -1; // Used when using keyboard
    this.currentIndex = -1; // The actual index we use
    this.currentText = null;
    this.classNames = classNames;
    this.$element = null;
    this.$dropdown = null;
    this.$button = null;
    this.$target = el;
    this._$selected = null;
    this._$previousSelected = null;

    this._init();
  }

  /*
   * Initializes stuff
   */
  SelectTypeahead.prototype._init = function() {
    // TODO: These events leak when instance is destroyed, better clean up!
    var self = this;
    var el = this.$target;
    var opts = this.options;

    this.$element = document.createElement('div');
    this.$element.className = this.classNames.join(' ');
    if ( opts.calcWidth && el.offsetWidth ) {
      this.$element.style.width = String(el.offsetWidth) + 'px';
    }

    this.$dropdown = document.createElement('ul');
    this.$dropdown.addEventListener('click', function(ev) {
      ev.stopPropagation();
    });
    this.$dropdown.addEventListener('mousedown', function(ev) {
      ev.stopPropagation();

      var row = getEventTarget(ev);
      self._onEntryClick(ev, row);
    }, true);

    this.$target.tabIndex = -1;

    this.$input = document.createElement('input');
    this.$input.type = 'text';

    var timeout;
    var ignore = [9, 17, 16, 18, 39, 37]; // tab, ctrl, shift, alt, right, left
    this.$input.addEventListener('keydown', function(ev) {
      timeout = clearTimeout(timeout);
      if ( ignore.indexOf(ev.keyCode) !== -1 ) {
        return;
      }

      var wasVisible = self._onKeyPress();
      if ( ev.keyCode === 38 ) {
        self._onKeyUp(wasVisible);
      } else if ( ev.keyCode === 40 ) {
        self._onKeyDown(wasVisible);
      } else if ( ev.keyCode === 13 ) {
        ev.preventDefault();
        self._onKeyEnter();
      } else if ( ev.keyCode === 27 ) {
        ev.preventDefault(); // Needed for FF and IE
        self._onKeyEsc();
      } else {
        timeout = setTimeout(function keyTimeout() {
          self._filter();
        }, opts.keyTimeout);
      }
    });
    this.$input.addEventListener('focus', function(ev) {
      self._onInputFocus();
    });

    this.$input.addEventListener('blur', function(ev) {
      self._onInputBlur();
    });

    document.body.addEventListener('click', function(ev) {
      if ( ev.target === self.$input || ev.target === self.$dropdown ) {
        return;
      }
      self._hideDropdown();
    });

    this.$button = document.createElement('button');
    this.$button.tabIndex = -1;
    if ( opts.buttonLabel ) {
      this.$button.appendChild(document.createTextNode(opts.buttonLabel));
    }
    this.$button.addEventListener('click', function(ev) {
      ev.stopPropagation();
      ev.preventDefault();
      self._onButtonClick();
    });

    // Render
    this.$element.appendChild(this.$dropdown);
    this.$element.appendChild(this.$input);
    this.$element.appendChild(this.$button);
    createDropdown(this.data, this.$dropdown);
    el.parentNode.insertBefore(this.$element, el);
    if ( el.selectedIndex >= 0 ) {
      this._setSelectedIndex(el.selectedIndex, true, false);
    }

    if ( !opts.debug ) {
      el.style.display = 'none';
    }
    el.setAttribute('data-select-typeahead', 'true');

    this.tempIndex = this.currentIndex;
    this.loaded = true;
  };

  /*
   * Show the dropdown
   */
  SelectTypeahead.prototype._showDropdown = function() {
    var visible = this.$dropdown.offsetParent !== null;
    this.$dropdown.style.display = 'block';
    return visible;
  };

  /*
   * Hide the dropdown
   */
  SelectTypeahead.prototype._hideDropdown = function() {
    this.$dropdown.style.display = 'none';
  };

  /*
   * Blur function
   */
  SelectTypeahead.prototype._blur = function() {
    this._setSelectedIndex(this.$target.selectedIndex, true, false);
    this._hideDropdown();

    this._filter(true);
  };

  /*
   * Focus function
   */
  SelectTypeahead.prototype._focus = function() {
    this.$input.setSelectionRange(0, this.$input.value.length);
  };

  /*
   * Internal for setting selected entry
   */
  SelectTypeahead.prototype._selectEntry = function(entry, setActive) {
    var idx = entry ? parseInt(entry.getAttribute('data-index'), 10) : -1;
    var value = entry ? parseInt(entry.getAttribute('data-value'), 10) : null;
    var text = (idx !== null && idx >= 0) ? this.data[idx].label : '';

    this._$previousSelected = this._$selected;
    if ( this._$previousSelected ) {
      this._$previousSelected.classList.remove('active');
    }

    this._$selected = entry;
    if ( this._$selected ) {
      this._$selected.classList.add('active');
      this._$selected.scrollIntoView();
    }

    this.currentIndex = idx;
    this.$input.value = text;

    if ( setActive ) {
      this.$target.selectedIndex = idx;
      this.$target.value = value;
      this.tempIndex = idx;
      this.currentText = text;
    }
  };

  /*
   * Filters the dropdown
   */
  SelectTypeahead.prototype._filter = function(reset) {
    var self = this;
    if ( !this.loaded || (!this.currentText && !reset) ) {
      return;
    }

    var input = reset ? '' : String(this.options.fnInputFilter(this.$input.value)).trim();
    var checkFor = null;
    if ( input !== this.currentText ) {
      checkFor = input;
    }

    var currentList = [];
    var fn = this.options.fnMatch;
    forEach(this.$dropdown.children, function(e, i) {
      var data = self.data[i];
      if ( checkFor && !fn(checkFor, data.text) ) {
        e.classList.add('invisible');
      } else {
        e.classList.remove('invisible');
        currentList.push(data);
      }
    });

    this.$dropdown.scrollTop = 0;
    this.currentList = currentList;

    if ( !reset ) {
      this.currentIndex = -1;
      this.tempIndex = -1;
    }
  };

  /*
   * Select entry by value, text or index
   */
  SelectTypeahead.prototype._setSelectedIndex = function(index, setActive, setFocused) {
    setActive = setActive !== false;
    setFocused = setFocused !== false;

    var child = this.$dropdown.children[index];
    this._selectEntry(child, setActive);

    // Deffer the text selection
    var self = this;
    if ( setFocused ) {
      setTimeout(function selectTimeout() {
        self.$input.setSelectionRange(0, self.$input.value.length);
      }, 1);
    }
  };

  /*
   * When input is focused
   */
  SelectTypeahead.prototype._onInputFocus = function() {
    this._focus();
  };

  /*
   * When input is blurred
   */
  SelectTypeahead.prototype._onInputBlur = function() {
    this._blur();
  };

  /*
   * When button is clicked
   */
  SelectTypeahead.prototype._onButtonClick = function() {
    var visible = this.$dropdown.offsetParent !== null;
    this.$dropdown.style.display = visible ? 'none' : 'block';

    this._focus();

    this.$input.focus();

    if ( this._$selected ) {
      this._$selected.scrollIntoView();
    }
  };

  /*
   * When enter key is pressed
   */
  SelectTypeahead.prototype._onKeyEnter = function() {
    if ( this.currentIndex >= 0 ) {
      this._setSelectedIndex(this.currentIndex);
    }
    this._hideDropdown();
    this._filter(true);
  };

  /*
   * When esc key is pressed
   */
  SelectTypeahead.prototype._onKeyEsc = function() {
    this._blur();
    this._filter(true);
  };

  /*
   * When up key is pressed
   */
  SelectTypeahead.prototype._onKeyUp = function(wasVisible) {
    if ( !this.currentList.length ) {
      return;
    }

    var idx = this.tempIndex;
    if ( idx <= 0 ) {
      idx = this.currentList.length - 1;
    } else {
      if ( wasVisible ) {
        idx--;
      }
    }

    var sel = this.currentList[idx];
    if ( sel ) {
      this._setSelectedIndex(sel.index, false);
    }
    this.tempIndex = idx;
  };

  /*
   * When down key is pressed
   */
  SelectTypeahead.prototype._onKeyDown = function(wasVisible) {
    if ( !this.currentList.length ) {
      return;
    }

    var idx = this.tempIndex;
    if ( idx >= this.currentList.length - 1 ) {
      idx = 0;
    } else {
      if ( wasVisible ) {
        idx++;
      }
    }

    var sel = this.currentList[idx];
    if ( sel ) {
      this._setSelectedIndex(sel.index, false);
    }
    this.tempIndex = idx;
  };

  /*
   * When a key is pressed
   */
  SelectTypeahead.prototype._onKeyPress = function() {
    return this._showDropdown();
  };

  /*
   * When an entry was clicked
   */
  SelectTypeahead.prototype._onEntryClick = function(ev, entry) {
    if ( entry ) {
      this._selectEntry(entry, true);
      this._hideDropdown();
    }
  };

  /**
   * Get selected by index
   *
   * @function getSelectedIndex
   * @memberof SelectTypeahead#
   * @return {Number}
   */
  SelectTypeahead.prototype.getSelectedIndex = function() {
    return this.$target.selectedIndex;
  };

  /**
   * Get selected by value
   *
   * @param {Boolean} [text=false]  Return the text label, not actual value
   * @function getSelectedValue
   * @memberof SelectTypeahead#
   * @return {Number|String}
   */
  SelectTypeahead.prototype.getSelectedValue = function(text) {
    var idx = this.getSelectedIndex();
    if ( idx >= 0 ) {
      var found = this.data[idx];
      if ( found ) {
        return text ? found.label : found.value;
      }
    }
    return null;
  };

  /**
   * Set selected by index
   *
   * @param {Number} idx Index
   * @function setSelectedIndex
   * @memberof SelectTypeahead#
   */
  SelectTypeahead.prototype.setSelectedIndex = function(idx) {
    this._setSelectedIndex(idx);
  };

  /**
   * Set selected by value
   *
   * @param {String} value Value
   * @param {Boolean} [text=false] Set selected based on text not actual value
   * @function setSelectedValue
   * @memberof SelectTypeahead#
   */
  SelectTypeahead.prototype.setSelectedValue = function(value, text) {
    var found = find(this.data, function(iter) {
      if ( text ) {
        return iter.text === value || iter.label === value;
      }
      return String(iter.value) === String(value);
    });

    if ( found ) {
      this.setSelectedIndex(found.index);
    }
  };

  /**
   * Focus the element
   *
   * @function focus
   * @memberof SelectTypeahead#
   */
  SelectTypeahead.prototype.focus = function() {
    this.$input.focus();
    this._focus();
  };

  /**
   * Blur the element
   *
   * @function blur
   * @memberof SelectTypeahead#
   */
  SelectTypeahead.prototype.blur = function() {
    this.$input.blur();
    this._blur();
  };

  /**
   * Destroy the instance
   *
   * @function destroy
   * @memberof SelectTypeahead#
   */
  SelectTypeahead.prototype.destroy = function() {
    this.$target.removeAttribute('data-select-typeahead');
    this.$target.style.display = 'block';

    if ( this.$element && this.$element.parentNode ) {
      this.$element.parentNode.removeChild(this.$element);
    }

    this.$element = null;
    this.$dropdown = null;
    this.$button = null;
    this.$target = null;
    this._$selected = null;
    this._$previousSelected = null;
  };

  /////////////////////////////////////////////////////////////////////////////
  // EXPORTS
  /////////////////////////////////////////////////////////////////////////////

  // Vanilla JS export
  window.SelectTypeahead = function(e, q) {
    return new SelectTypeahead(e, q);
  };

  // Module
  if ( typeof module !== 'undefined' ) {
    /* eslint no-undef: "off"*/
    module.exports = {
      create: function(e, q) {
        return new SelectTypeahead(e, q);
      }
    };
  }

  // Make jQuery compatible export
  var $ = window.$ || window.jQuery;
  if ( $ ) {
    $.fn.SelectTypeahead = function(a) {
      var inst = this.get(0);
      if ( !inst.typeahead ) {
        inst.typeahead = new SelectTypeahead($(this).get(0), a);
      }
      return inst.typeahead;
    };
  }

})();
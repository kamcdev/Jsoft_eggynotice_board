
(function (global) {
  'use strict';

  var ROOT_ID = 'egnotice-root';
  var THUMB_HEIGHT = 24;

  var DEFAULTS = {
    assetsBase: 'css/egnotice/',
    firstTabTitle: '请添加节目',
    mainTitle: '',
    autoOpen: true,
    onClose: null
  };

  
  var config = {};
  var data = [];
  var root = null;
  var currentIndex = 0;
  var spyLock = false; 
  var leadBlocks = 0; 

  
  function extend() {
    var out = {};
    for (var i = 0; i < arguments.length; i++) {
      var src = arguments[i];
      if (!src) continue;
      for (var k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) {
          out[k] = src[k];
        }
      }
    }
    return out;
  }

  
  function assetUrl(path) {
    if (!path) return '';
    var p = String(path);
    if (/^(blob:|data:|https?:|file:|\/\/)/i.test(p) || p.charAt(0) === '/') {
      return p;
    }
    var base = config.assetsBase || '';
    if (base && base.charAt(base.length - 1) !== '/') base += '/';
    return base + p;
  }

  
  function parseColor(colorCode) {
    if (!colorCode) return '#000000';
    var s = String(colorCode);
    if (s.charAt(0) === '#' && s.charAt(1) === 'c') {
      s = '#' + s.substring(2);
    }
    if (s.charAt(0) !== '#' && /^[0-9a-fA-F]{6}$/.test(s)) {
      s = '#' + s;
    }
    return /^#[0-9a-fA-F]{6}$/.test(s) ? s : '#000000';
  }



  function parseStyleParams(paramStr) {
    var params = {};
    var pairs = String(paramStr || '').split('|');
    for (var i = 0; i < pairs.length; i++) {
      var idx = pairs[i].indexOf(':');
      if (idx > 0) {
        params[pairs[i].substring(0, idx)] = pairs[i].substring(idx + 1);
      }
    }
    return params;
  }

  function makeTextSpan(text, color) {
    var span = document.createElement('span');
    span.style.color = color;
    span.appendChild(document.createTextNode(text));
    return span;
  }

  function buildOutlineShadow(color, size) {
    var s = size || 1;
    var c = parseColor(color);
    var d = (s * 0.7).toFixed(1);
    return [
      s + 'px 0 0 ' + c, '-' + s + 'px 0 0 ' + c,
      '0 ' + s + 'px 0 ' + c, '0 -' + s + 'px 0 ' + c,
      d + 'px ' + d + 'px 0 ' + c, '-' + d + 'px ' + d + 'px 0 ' + c,
      d + 'px -' + d + 'px 0 ' + c, '-' + d + 'px -' + d + 'px 0 ' + c
    ];
  }

  function buildGlowShadow(color, size) {
    var s = parseInt(size, 10) || 5;
    var c = parseColor(color);
    return [
      '0 0 ' + s + 'px ' + c,
      '0 0 ' + (s * 2) + 'px ' + c,
      '0 0 ' + (s * 3) + 'px ' + c
    ];
  }

  function applyStyles(el, params, parentColor) {
    var color = params.c ? parseColor(params.c) : parentColor;
    el.style.color = color;

    if (params.s) {
      var sz = parseInt(params.s, 10);
      if (sz > 0) el.style.fontSize = sz + 'px';
    }

    var shadows = [];
    if (params.o) {
      shadows = shadows.concat(buildOutlineShadow(params.o, parseInt(params.O, 10) || 1));
    }
    if (params.g) {
      shadows = shadows.concat(buildGlowShadow(params.g, params.G));
    }
    if (shadows.length) {
      el.style.textShadow = shadows.join(', ');
    }

    if (params.y) {
      var yo = parseInt(params.Y, 10) || 2;
      el.style.filter = 'drop-shadow(' + yo + 'px ' + yo + 'px 0 ' + parseColor(params.y) + ')';
    }

    var decos = [];
    if (params.h) {
      decos.push('line-through');
    }
    if (params.u) {
      decos.push('underline');
    }
    if (decos.length) {
      el.style.textDecoration = decos.join(' ');
      el.style.textDecorationColor = parseColor(params.u || params.h);
    }
  }

  function buildStyledSpan(innerText, params, parentColor) {
    var color = params.c ? parseColor(params.c) : parentColor;

    var el;
    if (params.e) {
      el = document.createElement('a');
      el.className = 'egnotice-link';
      el.href = innerText.trim();
      el.target = '_blank';
      el.rel = 'noopener';
    } else {
      el = document.createElement('span');
      el.className = 'egnotice-styled';
    }

    applyStyles(el, params, color);
    el.appendChild(buildRichText(innerText, color));
    return el;
  }

  function buildInlineImage(params) {
    var img = document.createElement('img');
    img.className = 'egnotice-inline-img';
    img.alt = '';
    if (params.f) {
      img.src = assetUrl(params.f);
    }
    if (params.s) {
      var size = parseInt(params.s, 10);
      if (size > 0) {
        img.style.width = size + 'px';
        img.style.height = 'auto';
      }
    }
    img.onerror = function () { this.style.display = 'none'; };
    return img;
  }

  function findNextMarker(str, from) {
    var candidates = [];
    var idx;

    idx = str.indexOf('#l', from);
    if (idx !== -1) candidates.push(idx);

    idx = str.indexOf('#f(', from);
    if (idx !== -1) candidates.push(idx);

    idx = str.indexOf('#p(', from);
    if (idx !== -1) candidates.push(idx);

    var colorRe = /#c[0-9a-fA-F]{6}/g;
    colorRe.lastIndex = from;
    var cm = colorRe.exec(str);
    if (cm) candidates.push(cm.index);

    if (!candidates.length) return -1;
    return Math.min.apply(null, candidates);
  }

  function buildRichText(text, initialColor) {
    var frag = document.createDocumentFragment();
    if (!text) return frag;

    var str = String(text);
    var len = str.length;
    var currentColor = initialColor || '#000000';
    var i = 0;
    var buffer = '';

    function flushBuffer() {
      if (buffer) {
        frag.appendChild(makeTextSpan(buffer, currentColor));
        buffer = '';
      }
    }

    while (i < len) {
      if (str.charAt(i) === '#' && str.charAt(i + 1) === 'c' &&
          /^[0-9a-fA-F]{6}$/.test(str.substring(i + 2, i + 8))) {
        flushBuffer();
        currentColor = '#' + str.substring(i + 2, i + 8);
        i += 8;
        continue;
      }

      if (str.charAt(i) === '#' && str.charAt(i + 1) === 'f' && str.charAt(i + 2) === '(') {
        var closeParen = str.indexOf(')', i + 3);
        if (closeParen !== -1) {
          flushBuffer();
          var params = parseStyleParams(str.substring(i + 3, closeParen));
          var endIdx = findNextMarker(str, closeParen + 1);
          var innerText;
          if (endIdx !== -1) {
            innerText = str.substring(closeParen + 1, endIdx);
            i = endIdx;
          } else {
            innerText = str.substring(closeParen + 1);
            i = len;
          }
          frag.appendChild(buildStyledSpan(innerText, params, currentColor));
          continue;
        }
      }

      if (str.charAt(i) === '#' && str.charAt(i + 1) === 'p' && str.charAt(i + 2) === '(') {
        var imgClose = str.indexOf(')', i + 3);
        if (imgClose !== -1) {
          flushBuffer();
          var imgParams = parseStyleParams(str.substring(i + 3, imgClose));
          frag.appendChild(buildInlineImage(imgParams));
          i = imgClose + 1;
          continue;
        }
      }

      if (str.charAt(i) === '#' && str.charAt(i + 1) === 'l') {
        i += 2;
        continue;
      }

      buffer += str.charAt(i);
      i++;
    }

    flushBuffer();
    return frag;
  }

  
  function isSubtitleBlock(block) {
    return block.indexOf('#image#') !== -1;
  }

  function splitSubtitle(block) {
    var idx = block.indexOf('#image#');
    return {
      text: block.substring(0, idx).trim(),
      path: block.substring(idx + 7).trim() 
    };
  }


  function onDocKeydown(e) {
    if (e.key === 'Escape' && root) close();
  }

  function onWinResize() {
    applyScale();
  }

  function onImgLoad(e) {
    if (e.target && e.target.tagName === 'IMG' && root && root.contains(e.target)) {
      syncScrollbar();
    }
  }

  function detachListeners() {
    document.removeEventListener('keydown', onDocKeydown);
    document.removeEventListener('load', onImgLoad, true);
    window.removeEventListener('resize', onWinResize);
  }

  function resetState() {
    root = null;
    currentIndex = 0;
    spyLock = false;
    leadBlocks = 0;
  }

  function buildBoard() {
    
    if (root) {
      
      if (document.body && document.body.contains(root)) return;
      
      detachListeners();
      resetState();
    }

    root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'egnotice-overlay hidden';

    var dialog = document.createElement('div');
    dialog.className = 'egnotice-dialog';

    var bg = document.createElement('div');
    bg.className = 'egnotice-bg';

    var mainTitle = document.createElement('div');
    mainTitle.className = 'egnotice-main-title';

    var body = document.createElement('div');
    body.className = 'egnotice-body';

    var tabs = document.createElement('div');
    tabs.className = 'egnotice-tabs';

    var panel = document.createElement('div');
    panel.className = 'egnotice-panel';

    var scroll = document.createElement('div');
    scroll.className = 'egnotice-scroll';
    var content = document.createElement('div');
    content.className = 'egnotice-content';
    scroll.appendChild(content);

    var scrollbar = document.createElement('div');
    scrollbar.className = 'egnotice-scrollbar';
    var thumb = document.createElement('div');
    thumb.className = 'egnotice-scrollbar-thumb';
    scrollbar.appendChild(thumb);

    panel.appendChild(scroll);
    panel.appendChild(scrollbar);

    body.appendChild(tabs);
    body.appendChild(panel);

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'egnotice-close';
    closeBtn.setAttribute('aria-label', '关闭');

    dialog.appendChild(bg);
    dialog.appendChild(mainTitle);
    dialog.appendChild(body);
    dialog.appendChild(closeBtn);

    root.appendChild(dialog);
    document.body.appendChild(root);

    
    closeBtn.addEventListener('click', function () {
      close();
    });

    root.addEventListener('click', function (e) {
      if (e.target === root) close();
    });

    document.addEventListener('keydown', onDocKeydown);


    tabs.addEventListener('click', function (e) {
      var el = e.target;
      while (el && el !== tabs) {
        if (el.classList && el.classList.contains('egnotice-tab')) {
          switchCategory(parseInt(el.getAttribute('data-index'), 10));
          return;
        }
        el = el.parentNode;
      }
    });


    scroll.addEventListener('scroll', onScroll);


    document.addEventListener('load', onImgLoad, true);


    window.addEventListener('resize', onWinResize);

    root._dialog = dialog;

    root._mainTitle = mainTitle;
    root._tabs = tabs;
    root._content = content;
    root._scroll = scroll;
    root._scrollbar = scrollbar;
    root._thumb = thumb;
  }

  
  function renderTabs() {
    var tabsEl = root._tabs;
    tabsEl.textContent = '';
    for (var i = 0; i < data.length; i++) {
      
      var label = (data[i] && data[i].title) || (i === 0 ? config.firstTabTitle : '');
      var tab = document.createElement('div');
      tab.className = 'egnotice-tab' + (i === currentIndex ? ' active' : '');
      tab.setAttribute('data-index', i);
      var text = document.createElement('span');
      text.className = 'egnotice-tab-text';
      text.textContent = label;
      tab.appendChild(text);
      tabsEl.appendChild(tab);

      var divider = document.createElement('div');
      divider.className = 'egnotice-divider';
      tabsEl.appendChild(divider);
    }
  }

  
  function renderAllSections() {
    var contentEl = root._content;
    contentEl.textContent = '';
    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      var section = document.createElement('div');
      section.className = 'egnotice-cat-section';
      section.setAttribute('data-index', i);

      var blocks = Array.isArray(item.content) ? item.content : [];
      
      var blockStart = 0;
      if (i === 0 && leadBlocks > 0) {
        blockStart = Math.min(leadBlocks, blocks.length);
        for (var m = 0; m < blockStart; m++) {
          var leadBlock = blocks[m];
          if (!leadBlock || !String(leadBlock).trim()) continue;
          if (isSubtitleBlock(leadBlock)) {
            var leadSub = splitSubtitle(leadBlock);
            section.appendChild(buildSubtitle(leadSub.text, leadSub.path));
          } else {
            section.appendChild(buildParagraph(leadBlock, true));
          }
        }
      }

      
      if (item.title_bg_path) {
        var head = document.createElement('div');
        head.className = 'egnotice-cat-head';

        var img = document.createElement('img');
        img.className = 'egnotice-cat-head-bg';
        img.alt = '';
        img.src = assetUrl(item.title_bg_path);
        img.onerror = function () { this.style.display = 'none'; };

        var headText = document.createElement('div');
        headText.className = 'egnotice-cat-head-text';
        headText.textContent = item.title || '';

        head.appendChild(img);
        head.appendChild(headText);
        section.appendChild(head);
      } else {
        var plain = document.createElement('div');
        plain.className = 'egnotice-cat-title-plain';
        plain.textContent = item.title || '';
        section.appendChild(plain);
      }

      
      for (var b = blockStart; b < blocks.length; b++) {
        var block = blocks[b];
        if (!block || !String(block).trim()) continue;
        if (isSubtitleBlock(block)) {
          var sub = splitSubtitle(block);
          section.appendChild(buildSubtitle(sub.text, sub.path));
        } else {
          section.appendChild(buildParagraph(block, i === 0 && leadBlocks === 0));
        }
      }
      contentEl.appendChild(section);
    }
  }

  function buildSubtitle(text, path) {
    var wrap = document.createElement('div');
    wrap.className = 'egnotice-subtitle';

    var img = document.createElement('img');
    img.className = 'egnotice-subtitle-bg';
    img.alt = '';
    img.src = assetUrl(path);
    img.onerror = function () { this.style.display = 'none'; };

    var txt = document.createElement('div');
    txt.className = 'egnotice-subtitle-text';
    txt.textContent = text;

    wrap.appendChild(img);
    wrap.appendChild(txt);
    return wrap;
  }

  function buildParagraph(text, isMain) {
    var p = document.createElement('div');
    p.className = 'egnotice-paragraph' + (isMain ? ' egnotice-paragraph-main' : '');
    p.appendChild(buildRichText(text));
    return p;
  }

  
  function onScroll() {
    syncScrollbar();
    updateActiveTab();
  }

  
  function updateActiveTab() {
    if (spyLock) return; 
    if (!root) return;
    var sections = root.querySelectorAll('.egnotice-cat-section');
    if (!sections.length) return;
    var scroll = root._scroll;
    var rect = scroll.getBoundingClientRect();
    if (!rect.width || !rect.height) return; 
    var viewBottom = rect.bottom; 
    var current = 0;
    for (var i = 0; i < sections.length - 1; i++) {
      if (sections[i + 1].getBoundingClientRect().top <= viewBottom) {
        current = i + 1;
      } else {
        break;
      }
    }
    setActiveTab(current);
  }

  
  function setActiveTab(idx) {
    currentIndex = idx;
    var tabs = root._tabs.querySelectorAll('.egnotice-tab');
    for (var i = 0; i < tabs.length; i++) {
      if (i === idx) tabs[i].classList.add('active');
      else tabs[i].classList.remove('active');
    }
  }

  
  function switchCategory(idx) {
    if (idx < 0 || idx >= data.length) return;
    var sections = root.querySelectorAll('.egnotice-cat-section');
    var section = sections[idx];
    if (!section) return;

    var scroll = root._scroll;
    var rect = scroll.getBoundingClientRect();
    
    var scale = 1;
    if (root._dialog) {
      var v = parseFloat(root._dialog.style.getPropertyValue('--egnotice-scale'));
      if (isFinite(v) && v > 0) scale = v;
    }
    
    var target = 0;
    if (idx > 0 && sections[idx - 1]) {
      var anchorTop = sections[idx - 1].getBoundingClientRect().bottom;
      target = (anchorTop - rect.top) / scale + scroll.scrollTop;
    }
    if (target < 0) target = 0;
    scroll.scrollTo({ top: target, behavior: 'auto' });

    
    spyLock = true;
    setActiveTab(idx);
    syncScrollbar();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        spyLock = false;
      });
    });
  }

  
  function syncScrollbar() {
    if (!root) return;
    var scroll = root._scroll;
    var thumb = root._thumb;
    var maxScroll = scroll.scrollHeight - scroll.clientHeight;

    if (maxScroll <= 1) {
      thumb.style.display = 'none';
      return;
    }
    thumb.style.display = '';

    var trackHeight = root._scrollbar.offsetHeight;
    var maxTop = Math.max(0, trackHeight - THUMB_HEIGHT);
    var ratio = Math.min(1, Math.max(0, scroll.scrollTop / maxScroll));
    thumb.style.top = (ratio * maxTop) + 'px';
  }

  
  function applyScale() {
    if (!root || !root._dialog) return;
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    var scale = 1;
    if (vw > 0 && vh > 0) {
      scale = Math.min((vw * 0.92) / 770, (vh * 0.86) / 440);
      scale = Math.max(1, Math.min(4, scale));
    }
    root._dialog.style.setProperty('--egnotice-scale', scale.toFixed(3));
  }

  
  
  function normalizeData(items) {
    var arr = Array.isArray(items) ? items.slice() : [];
    leadBlocks = 0;
    if (arr.length >= 2 && arr[0] && arr[1] && !arr[0].title_bg_path) {
      var head = Array.isArray(arr[0].content) ? arr[0].content : [];
      var tail = Array.isArray(arr[1].content) ? arr[1].content : [];
      leadBlocks = head.length; 
      arr[1].content = head.concat(tail);
      arr.shift();
    }
    return arr;
  }

  function render(dataArr, options) {
    if (!Array.isArray(dataArr) || dataArr.length === 0) {
      throw new Error('[EgNotice] 缺少公告数据：请通过 render(data) 传入有效公告内容，或使用 open(url) 加载公告数据文件');
    }
    config = extend({}, DEFAULTS, config, options || {});
    data = normalizeData(dataArr);
    currentIndex = 0;

    buildBoard();

    
    root._mainTitle.textContent = config.mainTitle || (dataArr[0] && dataArr[0].title) || '';
    renderTabs();
    renderAllSections();
    
    root.classList.remove('hidden');
    root._scroll.scrollTop = 0;
    syncScrollbar();
    updateActiveTab();
    applyScale();
  }


  function close() {
    if (!root) return;

    detachListeners();

    if (root.parentNode) {
      root.parentNode.removeChild(root);
    }
    resetState();

    if (typeof config.onClose === 'function') {
      try { config.onClose(); } catch (e) { console.warn(e); }
    }
  }

  
  function init(options) {
    options = options || {};
    config = extend({}, DEFAULTS, config, options);
    if (config.url && config.autoOpen !== false) {
      open(config.url);
    }
  }

  function open(url, options) {
    if (options) config = extend({}, DEFAULTS, config, options);
    if (!url) {
      throw new Error('[EgNotice] open(url) 缺少数据地址，请传入公告数据 JSON 文件的路径');
    }
    return fetch(url, { credentials: 'omit' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (d) {
        render(d);
      });
  }

  global.EgNotice = {
    init: init,
    open: open,
    render: render,
    close: close
  };
})(window);
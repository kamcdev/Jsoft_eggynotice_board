
(function (global) {
  'use strict';

  var ROOT_ID = 'egnotice-root';
  var THUMB_HEIGHT = 24;

  var DEFAULTS = {
    assetsBase: 'css/egnotice/',
    firstTabTitle: '维护公告',
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
    return /^#[0-9a-fA-F]{6}$/.test(s) ? s : '#000000';
  }

  
  function extractParam(params, key) {
    if (!params) return null;
    var pairs = String(params).split('|');
    for (var i = 0; i < pairs.length; i++) {
      var idx = pairs[i].indexOf(':');
      if (idx > 0 && pairs[i].substring(0, idx) === key) {
        return pairs[i].substring(idx + 1);
      }
    }
    return null;
  }

  

  
  function parseColoredSegments(text) {
    var segments = [];
    if (!text) return segments;
    var regex = /#c([0-9a-fA-F]{6})/g;
    var currentColor = '#000000';
    var lastEnd = 0;
    var match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastEnd) {
        var content = text.substring(lastEnd, match.index).trim();
        if (content) segments.push({ text: content, color: currentColor });
      }
      currentColor = '#' + match[1];
      lastEnd = regex.lastIndex;
    }
    if (lastEnd < text.length) {
      var tail = text.substring(lastEnd).trim();
      if (tail) segments.push({ text: tail, color: currentColor });
    }
    return segments;
  }

  function makeTextSpan(text, color) {
    var span = document.createElement('span');
    span.style.color = color;
    span.appendChild(document.createTextNode(text));
    return span;
  }

  
  function buildRichText(text) {
    var frag = document.createDocumentFragment();
    var segments = parseColoredSegments(text);
    var linkRegex = /#f\(([^)]*)\)(.*?)#l/g;

    for (var i = 0; i < segments.length; i++) {
      var seg = segments[i];
      var segText = seg.text;
      var segColor = seg.color;
      linkRegex.lastIndex = 0;
      var m;
      var lastEnd = 0;
      while ((m = linkRegex.exec(segText)) !== null) {
        if (m.index > lastEnd) {
          frag.appendChild(makeTextSpan(segText.substring(lastEnd, m.index), segColor));
        }
        var linkText = m[2];
        var colorStr = extractParam(m[1], 'c');
        var linkColor = colorStr ? parseColor('#' + colorStr) : segColor;
        var a = document.createElement('a');
        a.className = 'egnotice-link';
        a.href = linkText;
        a.target = '_blank';
        a.rel = 'noopener';
        a.style.color = linkColor;
        a.appendChild(document.createTextNode(linkText));
        frag.appendChild(a);
        lastEnd = linkRegex.lastIndex;
      }
      if (lastEnd < segText.length) {
        frag.appendChild(makeTextSpan(segText.substring(lastEnd), segColor));
      }
    }
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
/* ============================================================
   公告创建器 - 核心逻辑 (all.js)
   负责:数据模型、标签页管理、数据增删改查、导入导出、刷新
   纯 ES5 兼容语法,无第三方依赖
   暴露: window.EditorApp
   ============================================================ */
(function (global) {
  'use strict';

  // 头部背景图文件名常量
  var HEAD_IMAGES = [
    'img_activity_pic.png', 'img_activity_pic_1.png', 'img_activity_pic_2.png',
    'img_activity_pic_3.png', 'img_activity_pic_4.png', 'img_activity_pic_5.png',
    'img_activity_pic_6.png', 'img_activity_pic_7.png', 'img_activity_pic_9.png',
    'img_adjust_pic.png', 'img_play_pic.png', 'img_paradise_pic.png'
  ];

  // ---------- 运行时状态 ----------
  var state = { columns: [] };
  var tabs = [];
  var activeTabId = null;
  var toastTimer = null;
  var resizeTimer = null;

  // ---------- 页面模块注册位 ----------
  // 由 main.js / column.js / subtitle.js 各自填充 render/refresh
  var pages = {
    main: { render: null, refresh: null },
    column: { render: null, refresh: null },
    subtitle: { render: null, refresh: null }
  };

  // ---------- 工具函数 ----------
  function $(id) {
    return document.getElementById(id);
  }

  function genId() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
  }

  function escapeHtml(str) {
    var s = (str == null) ? '' : String(str);
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(msg) {
    var el = $('editor-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'editor-toast';
      el.className = 'editor-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(function () {
      el.classList.remove('show');
    }, 2500);
  }

  // ---------- 查找函数 ----------
  function findColumn(columnId) {
    if (!columnId) return null;
    for (var i = 0; i < state.columns.length; i++) {
      if (state.columns[i].id === columnId) return state.columns[i];
    }
    return null;
  }

  function findSubtitle(columnId, subtitleId) {
    var col = findColumn(columnId);
    if (!col || !subtitleId) return null;
    for (var i = 0; i < col.subtitles.length; i++) {
      if (col.subtitles[i].id === subtitleId) return col.subtitles[i];
    }
    return null;
  }

  function findSubtitleColumn(subtitleId) {
    if (!subtitleId) return null;
    for (var i = 0; i < state.columns.length; i++) {
      var subs = state.columns[i].subtitles;
      for (var j = 0; j < subs.length; j++) {
        if (subs[j].id === subtitleId) return state.columns[i];
      }
    }
    return null;
  }

  function findTabById(tabId) {
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].id === tabId) return tabs[i];
    }
    return null;
  }

  // ---------- 标签页管理 ----------
  function getTabByTypeAndData(type, dataId) {
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].type === type && tabs[i].dataId === dataId) return tabs[i];
    }
    return null;
  }

  function updateTabBar() {
    var bar = $('editor-tabbar');
    if (!bar) return;
    bar.textContent = '';
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      var el = document.createElement('div');
      var cls = 'editor-tab';
      if (t.id === activeTabId) cls += ' active';
      if (t.type === 'main') cls += ' main';
      el.className = cls;
      el.setAttribute('data-tab-id', t.id);
      el.setAttribute('title', t.title || '');

      var text = document.createElement('span');
      text.className = 'editor-tab-text';
      text.textContent = t.title || '';
      el.appendChild(text);

      var close = document.createElement('span');
      close.className = 'editor-tab-close';
      close.textContent = '×';
      el.appendChild(close);

      bar.appendChild(el);
    }
  }

  function updateTabTitle(tabId, newTitle) {
    var t = findTabById(tabId);
    if (!t) return;
    t.title = newTitle;
    updateTabBar();
  }

  function updateDocumentTitle() {
    var t = findTabById(activeTabId);
    if (t) {
      document.title = t.title || '公告创建器';
    }
  }

  function switchTab(tabId) {
    var t = findTabById(tabId);
    if (!t) return;
    activeTabId = tabId;

    var pagesEls = document.querySelectorAll('#editor-content > .editor-page');
    for (var i = 0; i < pagesEls.length; i++) {
      pagesEls[i].classList.remove('active');
    }
    if (t.containerEl) {
      t.containerEl.classList.add('active');
    }

    updateTabBar();
    updateDocumentTitle();
  }

  function openTab(type, dataId) {
    // 主页:始终存在
    if (type === 'main') {
      switchTab('main');
      updateTabBar();
      updateDocumentTitle();
      return;
    }

    // 已存在则切换
    var existing = getTabByTypeAndData(type, dataId);
    if (existing) {
      switchTab(existing.id);
      updateTabBar();
      updateDocumentTitle();
      return;
    }

    var contentEl = $('editor-content');
    if (!contentEl) return;

    var title = '';
    var container = document.createElement('div');
    container.className = 'editor-page';
    contentEl.appendChild(container);

    var newTab = {
      id: genId(),
      type: type,
      dataId: dataId,
      title: '',
      containerEl: container
    };

    if (type === 'column') {
      var column = findColumn(dataId);
      if (!column) {
        if (container.parentNode) container.parentNode.removeChild(container);
        return;
      }
      title = '栏目编辑-' + column.name;
      if (pages.column.render) {
        pages.column.render(container, dataId);
      }
    } else if (type === 'subtitle') {
      var col = findSubtitleColumn(dataId);
      if (!col) {
        if (container.parentNode) container.parentNode.removeChild(container);
        return;
      }
      var subtitle = findSubtitle(col.id, dataId);
      var subName = subtitle ? subtitle.name : '';
      title = '内容编辑-' + subName;
      if (pages.subtitle.render) {
        pages.subtitle.render(container, col.id, dataId);
      }
    } else {
      // 未知类型,放弃
      if (container.parentNode) container.parentNode.removeChild(container);
      return;
    }

    newTab.title = title;
    tabs.push(newTab);
    switchTab(newTab.id);
    updateTabBar();
    updateDocumentTitle();
  }

  function closeTab(tabId) {
    // 主标签不可关闭
    if (tabId === 'main') return;
    var idx = -1;
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].id === tabId) { idx = i; break; }
    }
    if (idx === -1) return;

    var tab = tabs[idx];
    if (tab.containerEl && tab.containerEl.parentNode) {
      tab.containerEl.parentNode.removeChild(tab.containerEl);
    }
    tabs.splice(idx, 1);

    if (activeTabId === tabId) {
      switchTab('main');
    } else {
      updateTabBar();
    }
  }

  // ---------- 数据操作 ----------
  function addColumn() {
    if (state.columns.length >= 6) {
      showToast('最多只能添加6个栏目');
      return null;
    }
    var col = {
      id: genId(),
      name: '新栏目',
      headImage: 'none',
      headImageUrl: '',
      subtitles: []
    };
    state.columns.push(col);
    refreshDisplay();
    return col.id;
  }

  function removeColumn(columnId) {
    if (state.columns.length === 0) return;
    var idx = -1;
    if (columnId) {
      for (var i = 0; i < state.columns.length; i++) {
        if (state.columns[i].id === columnId) { idx = i; break; }
      }
    } else {
      idx = state.columns.length - 1;
    }
    if (idx === -1) return;
    // 关闭对应栏目标签页及子标题标签页
    var tabsToClose = [];
    for (var t = 0; t < tabs.length; t++) {
      if (tabs[t].type === 'column' && tabs[t].dataId === state.columns[idx].id) {
        tabsToClose.push(tabs[t].id);
      } else if (tabs[t].type === 'subtitle') {
        var subCol = findSubtitleColumn(tabs[t].dataId);
        if (subCol && subCol.id === state.columns[idx].id) {
          tabsToClose.push(tabs[t].id);
        }
      }
    }
    state.columns.splice(idx, 1);
    for (var j = 0; j < tabsToClose.length; j++) {
      closeTab(tabsToClose[j]);
    }
    refreshDisplay();
  }

  function moveColumn(columnId, direction) {
    if (!columnId) return;
    var idx = -1;
    for (var i = 0; i < state.columns.length; i++) {
      if (state.columns[i].id === columnId) { idx = i; break; }
    }
    if (idx === -1) return;
    if (direction === 'up' && idx > 0) {
      var tmpUp = state.columns[idx - 1];
      state.columns[idx - 1] = state.columns[idx];
      state.columns[idx] = tmpUp;
      refreshDisplay();
    } else if (direction === 'down' && idx < state.columns.length - 1) {
      var tmpDown = state.columns[idx + 1];
      state.columns[idx + 1] = state.columns[idx];
      state.columns[idx] = tmpDown;
      refreshDisplay();
    }
  }

  function addSubtitle(columnId) {
    var col = findColumn(columnId);
    if (!col) return null;
    var sub = {
      id: genId(),
      name: '新子标题',
      content: ''
    };
    col.subtitles.push(sub);
    refreshDisplay();
    return sub.id;
  }

  function removeSubtitle(columnId, subtitleId) {
    var col = findColumn(columnId);
    if (!col) return;
    if (col.subtitles.length === 0) return;
    var idx = -1;
    if (subtitleId) {
      for (var i = 0; i < col.subtitles.length; i++) {
        if (col.subtitles[i].id === subtitleId) { idx = i; break; }
      }
    } else {
      idx = col.subtitles.length - 1;
    }
    if (idx === -1) return;
    var removedId = col.subtitles[idx].id;
    col.subtitles.splice(idx, 1);
    // 关闭对应子标题标签页
    var tabsToClose = [];
    for (var t = 0; t < tabs.length; t++) {
      if (tabs[t].type === 'subtitle' && tabs[t].dataId === removedId) {
        tabsToClose.push(tabs[t].id);
      }
    }
    for (var j = 0; j < tabsToClose.length; j++) {
      closeTab(tabsToClose[j]);
    }
    refreshDisplay();
  }

  function moveSubtitle(columnId, subtitleId, direction) {
    var col = findColumn(columnId);
    if (!col || !subtitleId) return;
    var idx = -1;
    for (var i = 0; i < col.subtitles.length; i++) {
      if (col.subtitles[i].id === subtitleId) { idx = i; break; }
    }
    if (idx === -1) return;
    if (direction === 'up' && idx > 0) {
      var tmpUp = col.subtitles[idx - 1];
      col.subtitles[idx - 1] = col.subtitles[idx];
      col.subtitles[idx] = tmpUp;
      refreshDisplay();
    } else if (direction === 'down' && idx < col.subtitles.length - 1) {
      var tmpDown = col.subtitles[idx + 1];
      col.subtitles[idx + 1] = col.subtitles[idx];
      col.subtitles[idx] = tmpDown;
      refreshDisplay();
    }
  }

  function updateColumn(columnId, updates) {
    var col = findColumn(columnId);
    if (!col) return;
    Object.assign(col, updates || {});
    refreshDisplay();
  }

  function updateSubtitle(columnId, subtitleId, updates) {
    var sub = findSubtitle(columnId, subtitleId);
    if (!sub) return;
    Object.assign(sub, updates || {});
    refreshDisplay();
  }

  // ---------- 导入/导出 ----------
  // 解析头部背景路径 → headImage / headImageUrl
  function resolveHeadImage(titleBgPath) {
    if (!titleBgPath) {
      return { headImage: 'none', headImageUrl: '' };
    }
    if (HEAD_IMAGES.indexOf(titleBgPath) !== -1) {
      return { headImage: titleBgPath, headImageUrl: '' };
    }
    return { headImage: 'other', headImageUrl: titleBgPath };
  }

  // 解析 content 数组为 subtitles
  function parseContent(contentArr) {
    var subtitles = [];
    var blocks = Array.isArray(contentArr) ? contentArr : [];
    for (var i = 0; i < blocks.length; i++) {
      var block = String(blocks[i] == null ? '' : blocks[i]);
      if (block.indexOf('#image#') !== -1) {
        var idx = block.indexOf('#image#');
        var textBefore = block.substring(0, idx);
        subtitles.push({ id: genId(), name: textBefore, content: '' });
      } else {
        // 无 #image#:归入上一个内容为空的子标题,否则新建
        if (subtitles.length > 0 && subtitles[subtitles.length - 1].content === '') {
          subtitles[subtitles.length - 1].content = block;
        } else {
          subtitles.push({ id: genId(), name: '', content: block });
        }
      }
    }
    return subtitles;
  }

  function getOutputJSON() {
    var out = [];
    for (var i = 0; i < state.columns.length; i++) {
      var col = state.columns[i];
      var item = {};
      item.title = col.name;

      if (col.headImage === 'none') {
        // 省略 title_bg_path 字段
      } else if (col.headImage === 'other') {
        item.title_bg_path = col.headImageUrl || '';
      } else {
        item.title_bg_path = col.headImage;
      }

      var content = [];
      for (var j = 0; j < col.subtitles.length; j++) {
        var sub = col.subtitles[j];
        if (sub.name) {
          content.push(sub.name + '#image#img_title_bg.png');
        }
        if (sub.content) {
          content.push(sub.content);
        }
      }
      item.content = content;

      out.push(item);
    }
    return JSON.stringify(out, null, 2);
  }

  function exportJSON() {
    var text = getOutputJSON();
    var blob;
    try {
      blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    } catch (e) {
      showToast('导出失败:浏览器不支持 Blob');
      return;
    }
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'notice.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 200);
  }

  function importJSON(file) {
    if (!file) {
      showToast('请选择文件');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) {
          throw new Error('数据格式不正确:应为数组');
        }
        var newColumns = [];
        for (var i = 0; i < data.length; i++) {
          var item = data[i] || {};
          var resolved = resolveHeadImage(item.title_bg_path);
          newColumns.push({
            id: genId(),
            name: item.title || '',
            headImage: resolved.headImage,
            headImageUrl: resolved.headImageUrl,
            subtitles: parseContent(item.content)
          });
        }
        state.columns = newColumns;
        // 关闭所有非主标签页(从后往前遍历,避免索引错位)
        for (var k = tabs.length - 1; k >= 0; k--) {
          if (tabs[k].type !== 'main') {
            closeTab(tabs[k].id);
            k = tabs.length; // closeTab 会修改数组,重置索引重新遍历
          }
        }
        switchTab('main');
        refreshDisplay();
        showToast('导入成功');
      } catch (err) {
        showToast('导入失败:' + (err && err.message ? err.message : String(err)));
      }
    };
    reader.onerror = function () {
      showToast('导入失败:文件读取错误');
    };
    reader.readAsText(file);
  }

  // ---------- 刷新显示 ----------
  function refreshDisplay() {
    // 1. 更新各标签页标题
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      if (t.type === 'column' && t.dataId) {
        var col = findColumn(t.dataId);
        if (col) {
          t.title = '栏目编辑-' + col.name;
        }
      } else if (t.type === 'subtitle' && t.dataId) {
        var foundCol = findSubtitleColumn(t.dataId);
        if (foundCol) {
          var sub = findSubtitle(foundCol.id, t.dataId);
          if (sub) {
            t.title = '内容编辑-' + sub.name;
          }
        }
      }
    }

    // 2. 更新 JSON 输出区(若存在)
    var jsonArea = $('editor-json-output');
    if (jsonArea) {
      jsonArea.textContent = getOutputJSON();
    }

    // 3. 主标签页刷新
    if (pages.main.refresh) {
      pages.main.refresh();
    }

    // 4. 栏目标签页刷新(子标题列表等)
    if (pages.column.refresh) {
      for (var j = 0; j < tabs.length; j++) {
        if (tabs[j].type === 'column') {
          pages.column.refresh(tabs[j].containerEl, tabs[j].dataId);
        }
      }
    }

    // 5. 更新文档标题与标签栏
    updateTabBar();
    updateDocumentTitle();
  }

  // ---------- 布局 ----------
  function setupLayout() {
    // 响应式分栏由 CSS 媒体查询处理;
    // 此监听器保留给未来基于 JS 的附加调整。
    window.addEventListener('resize', handleResize);
  }

  function handleResize() {
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(function () {
      // 预留:可在此处补充 JS 级别的布局自适应逻辑
    }, 150);
  }

  // ---------- 初始化 ----------
  function init() {
    var contentEl = $('editor-content');
    if (!contentEl) return;

    // 创建主标签容器
    var mainContainer = document.createElement('div');
    mainContainer.className = 'editor-page active';
    mainContainer.id = 'editor-page-main';
    contentEl.appendChild(mainContainer);

    var mainTab = {
      id: 'main',
      type: 'main',
      title: '公告创建器',
      dataId: null,
      containerEl: mainContainer
    };
    tabs.push(mainTab);
    activeTabId = 'main';

    // 渲染主标签页内容(若已注册)
    if (pages.main.render) {
      pages.main.render(mainContainer);
    }

    // 标签栏点击委托
    var bar = $('editor-tabbar');
    if (bar) {
      bar.addEventListener('click', function (e) {
        var target = e.target;
        var tabEl = null;
        while (target && target !== bar) {
          if (target.classList && target.classList.contains('editor-tab')) {
            tabEl = target;
            break;
          }
          target = target.parentNode;
        }
        if (!tabEl) return;
        var tabId = tabEl.getAttribute('data-tab-id');
        if (!tabId) return;

        // 关闭按钮点击
        if (e.target.classList && e.target.classList.contains('editor-tab-close')) {
          if (e.stopPropagation) e.stopPropagation();
          closeTab(tabId);
        } else {
          switchTab(tabId);
        }
      });
    }

    updateTabBar();
    setupLayout();
    updateDocumentTitle();
  }

  // ---------- 暴露 EditorApp ----------
  var EditorApp = {
    // 数据模型
    state: state,
    HEAD_IMAGES: HEAD_IMAGES,
    pages: pages,

    // 标签页管理
    init: init,
    openTab: openTab,
    closeTab: closeTab,
    switchTab: switchTab,
    getTabByTypeAndData: getTabByTypeAndData,
    updateTabBar: updateTabBar,
    updateTabTitle: updateTabTitle,
    updateDocumentTitle: updateDocumentTitle,

    // 数据操作
    addColumn: addColumn,
    removeColumn: removeColumn,
    moveColumn: moveColumn,
    addSubtitle: addSubtitle,
    removeSubtitle: removeSubtitle,
    moveSubtitle: moveSubtitle,
    updateColumn: updateColumn,
    updateSubtitle: updateSubtitle,
    findColumn: findColumn,
    findSubtitle: findSubtitle,
    findSubtitleColumn: findSubtitleColumn,

    // 导入导出
    getOutputJSON: getOutputJSON,
    exportJSON: exportJSON,
    importJSON: importJSON,

    // 刷新与布局
    refreshDisplay: refreshDisplay,
    setupLayout: setupLayout,

    // 工具
    genId: genId,
    showToast: showToast,
    escapeHtml: escapeHtml
  };

  global.EditorApp = EditorApp;
})(window);

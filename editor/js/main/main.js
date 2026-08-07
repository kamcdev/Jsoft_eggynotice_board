/* ============================================================
   公告创建器 - 主标签页 (main.js)
   负责: 主页 DOM 构建、栏目列表渲染、按钮事件绑定
   纯 ES5 兼容语法,无第三方依赖
   依赖: window.EditorApp (all.js)
   ============================================================ */
(function (global) {
  'use strict';

  var EditorApp = global.EditorApp;

  // ---------- 工具函数 ----------
  function $(id) {
    return document.getElementById(id);
  }

  function createEl(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text != null) {
      node.textContent = text;
    }
    return node;
  }

  // ---------- 栏目列表渲染 ----------
  function renderColumnList() {
    var listEl = $('main-column-list');
    if (!listEl) {
      return;
    }
    listEl.textContent = '';

    var columns = (EditorApp.state && EditorApp.state.columns) || [];
    if (columns.length === 0) {
      var hint = createEl('div', 'main-empty-hint', '暂无栏目，点击「添加栏目」开始创建');
      listEl.appendChild(hint);
      return;
    }

    for (var i = 0; i < columns.length; i++) {
      var col = columns[i];
      var item = createEl('div', 'editor-list-item');
      item.setAttribute('data-column-id', col.id);

      var info = createEl('div', 'editor-list-item-info');

      var nameEl = createEl('div', 'editor-list-item-name');
      nameEl.innerHTML = EditorApp.escapeHtml(col.name);

      var meta = createEl('div', 'editor-list-item-meta', col.subtitles.length + '个子标题');

      info.appendChild(nameEl);
      info.appendChild(meta);
      item.appendChild(info);

      (function (columnId) {
        item.addEventListener('click', function () {
          EditorApp.openTab('column', columnId);
        });
      })(col.id);

      listEl.appendChild(item);
    }
  }

  // ---------- 按钮状态 ----------
  function updateButtonStates() {
    var removeBtn = $('main-remove-column');
    if (!removeBtn) {
      return;
    }
    var columns = (EditorApp.state && EditorApp.state.columns) || [];
    removeBtn.disabled = columns.length === 0;
  }

  // ---------- 主页渲染 ----------
  function render(container) {
    if (!container) {
      return;
    }
    container.textContent = '';

    // 布局分栏
    var split = createEl('div', 'editor-layout-split');

    // ---- 左侧编辑区 ----
    var editArea = createEl('div', 'editor-edit-area main-edit-area');

    var btnGroup = createEl('div', 'editor-btn-group main-btn-group');

    var addBtn = createEl('button', 'editor-btn editor-btn-primary', '添加栏目');
    addBtn.id = 'main-add-column';

    var removeBtn = createEl('button', 'editor-btn editor-btn-danger', '删除栏目');
    removeBtn.id = 'main-remove-column';

    var exportBtn = createEl('button', 'editor-btn', '导出');
    exportBtn.id = 'main-export';

    var importBtn = createEl('button', 'editor-btn', '导入');
    importBtn.id = 'main-import';

    var previewBtn = createEl('button', 'editor-btn', '预览');
    previewBtn.id = 'main-preview';

    var importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.id = 'main-import-input';
    importInput.setAttribute('accept', '.json');
    importInput.style.display = 'none';

    btnGroup.appendChild(addBtn);
    btnGroup.appendChild(removeBtn);
    btnGroup.appendChild(exportBtn);
    btnGroup.appendChild(importBtn);
    btnGroup.appendChild(previewBtn);
    btnGroup.appendChild(importInput);

    var listTitle = createEl('div', 'editor-section-title', '栏目列表');

    var columnList = createEl('div', 'main-column-list');
    columnList.id = 'main-column-list';

    editArea.appendChild(btnGroup);
    editArea.appendChild(listTitle);
    editArea.appendChild(columnList);

    // ---- 右侧输出区 ----
    var outputArea = createEl('div', 'editor-output-area main-output-area');

    var outputTitle = createEl('div', 'editor-section-title main-output-title', '公告 JSON 输出');

    var jsonPre = document.createElement('pre');
    jsonPre.id = 'editor-json-output';

    outputArea.appendChild(outputTitle);
    outputArea.appendChild(jsonPre);

    split.appendChild(editArea);
    split.appendChild(outputArea);

    container.appendChild(split);

    // ---- 事件绑定 ----
    addBtn.addEventListener('click', function () {
      var id = EditorApp.addColumn();
      if (id) {
        EditorApp.openTab('column', id);
      }
    });

    removeBtn.addEventListener('click', function () {
      EditorApp.removeColumn();
    });

    exportBtn.addEventListener('click', function () {
      EditorApp.exportJSON();
    });

    importBtn.addEventListener('click', function () {
      importInput.click();
    });

    importInput.addEventListener('change', function () {
      var file = (importInput.files && importInput.files.length > 0) ? importInput.files[0] : null;
      if (file) {
        EditorApp.importJSON(file);
      }
      importInput.value = '';
    });

    previewBtn.addEventListener('click', function () {
      var jsonText = EditorApp.getOutputJSON();
      var data;
      try {
        data = JSON.parse(jsonText);
      } catch (e) {
        EditorApp.showToast('预览失败:JSON 数据无效');
        return;
      }
      if (!Array.isArray(data) || data.length === 0) {
        EditorApp.showToast('暂无公告数据,请先添加栏目');
        return;
      }
      if (!global.EgNotice) {
        EditorApp.showToast('预览失败:EgNotice 未加载');
        return;
      }
      var blob;
      try {
        blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
      } catch (e) {
        EditorApp.showToast('预览失败:浏览器不支持 Blob');
        return;
      }
      var blobUrl = URL.createObjectURL(blob);
      try { EgNotice.close(); } catch (e) {}
      EgNotice.open(blobUrl, { assetsBase: '../css/egnotice/' })
        .then(function () {
          setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 5000);
        })
        .catch(function (err) {
          URL.revokeObjectURL(blobUrl);
          EditorApp.showToast('预览失败:' + (err && err.message ? err.message : String(err)));
        });
    });

    // ---- 初始渲染 ----
    renderColumnList();
    updateButtonStates();

    var jsonArea = $('editor-json-output');
    if (jsonArea) {
      jsonArea.textContent = EditorApp.getOutputJSON();
    }
  }

  // ---------- 主页刷新 ----------
  function refresh() {
    renderColumnList();
    updateButtonStates();
  }

  // ---------- 注册到 EditorApp ----------
  if (EditorApp && EditorApp.pages && EditorApp.pages.main) {
    EditorApp.pages.main.render = render;
    EditorApp.pages.main.refresh = refresh;
  }
})(window);

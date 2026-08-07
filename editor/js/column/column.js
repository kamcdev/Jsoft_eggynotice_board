/* ============================================================
   公告创建器 - 栏目编辑页 (column.js)
   依赖: all.js (EditorApp), rich-text.js (RichText)
   注册: EditorApp.pages.column.render / refresh
   纯 ES5 兼容语法,无第三方依赖
   ============================================================ */
(function (global) {
  'use strict';

  var EditorApp = global.EditorApp;
  var RichText = global.RichText;

  // 头图资源相对路径前缀(相对 editor 页面 HTML)
  var HEAD_IMG_PREFIX = '../css/egnotice/';

  // 根据栏目头图配置,刷新 URL 行与预览图的可见性
  function applyHeadImageState(col, urlRow, previewWrap, previewImg) {
    var headImage = col ? col.headImage : 'none';
    if (headImage === 'other') {
      urlRow.classList.add('is-visible');
      previewWrap.classList.remove('is-visible');
    } else if (headImage === 'none' || !headImage) {
      urlRow.classList.remove('is-visible');
      previewWrap.classList.remove('is-visible');
    } else {
      // 已知头图文件名:显示预览
      urlRow.classList.remove('is-visible');
      previewWrap.classList.add('is-visible');
      previewImg.src = HEAD_IMG_PREFIX + headImage;
    }
  }

  // 渲染子标题列表(同时更新删除按钮禁用态)
  function renderSubtitleList(container, columnId) {
    var col = EditorApp.findColumn(columnId);
    var subList = container.querySelector('.column-subtitle-list');
    var removeBtn = container.querySelector('.column-remove-subtitle');
    if (!subList) return;

    subList.innerHTML = '';

    var subs = (col && col.subtitles) ? col.subtitles : [];
    if (subs.length === 0) {
      var hint = document.createElement('div');
      hint.className = 'column-empty-hint';
      hint.textContent = '暂无子标题，点击「添加子标题」开始创建';
      subList.appendChild(hint);
    } else {
      for (var i = 0; i < subs.length; i++) {
        var sub = subs[i];
        var item = document.createElement('div');
        item.className = 'editor-list-item column-subtitle-item';

        var info = document.createElement('div');
        info.className = 'editor-list-item-info';

        var nameEl = document.createElement('div');
        nameEl.className = 'editor-list-item-name';
        // textContent 自动转义,安全显示子标题名称
        nameEl.textContent = sub.name || '';

        var metaEl = document.createElement('div');
        metaEl.className = 'editor-list-item-meta';
        metaEl.textContent = RichText.countNetChars(sub.content) + '字';

        info.appendChild(nameEl);
        info.appendChild(metaEl);
        item.appendChild(info);

        // 闭包锁定 subId,点击跳转到对应子标题编辑页
        (function (subId) {
          item.addEventListener('click', function () {
            EditorApp.openTab('subtitle', subId);
          });
        })(sub.id);

        subList.appendChild(item);
      }
    }

    // 删除按钮:无子标题时禁用
    if (removeBtn) {
      removeBtn.disabled = subs.length === 0;
    }
  }

  // 渲染整个栏目编辑页(仅在标签页打开时调用一次)
  function render(container, columnId) {
    var col = EditorApp.findColumn(columnId);
    if (!col) {
      container.textContent = '错误:找不到栏目';
      return;
    }

    container.innerHTML = '';

    var pageEl = document.createElement('div');
    pageEl.className = 'column-page';

    // ---- 设置区 ----
    var settings = document.createElement('div');
    settings.className = 'column-settings';

    var settingsTitle = document.createElement('div');
    settingsTitle.className = 'editor-section-title column-settings-title';
    settingsTitle.textContent = '栏目设置';
    settings.appendChild(settingsTitle);

    // 栏目名称
    var nameRow = document.createElement('div');
    nameRow.className = 'editor-form-row';
    var nameLabel = document.createElement('label');
    nameLabel.textContent = '栏目名称';
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'editor-input column-name-input';
    nameInput.value = col.name || '';
    nameRow.appendChild(nameLabel);
    nameRow.appendChild(nameInput);
    settings.appendChild(nameRow);

    // 标题头图选择
    var headRow = document.createElement('div');
    headRow.className = 'editor-form-row';
    var headLabel = document.createElement('label');
    headLabel.textContent = '标题头图';
    var headSelect = document.createElement('select');
    headSelect.className = 'editor-select column-head-image-select';

    var noneOpt = document.createElement('option');
    noneOpt.value = 'none';
    noneOpt.textContent = '无头图';
    headSelect.appendChild(noneOpt);

    var imgs = EditorApp.HEAD_IMAGES || [];
    for (var i = 0; i < imgs.length; i++) {
      var opt = document.createElement('option');
      opt.value = imgs[i];
      opt.textContent = imgs[i];
      headSelect.appendChild(opt);
    }

    var otherOpt = document.createElement('option');
    otherOpt.value = 'other';
    otherOpt.textContent = '其他';
    headSelect.appendChild(otherOpt);

    headSelect.value = col.headImage || 'none';
    headRow.appendChild(headLabel);
    headRow.appendChild(headSelect);
    settings.appendChild(headRow);

    // 头图 URL 行(默认隐藏)
    var urlRow = document.createElement('div');
    urlRow.className = 'editor-form-row column-head-url-row';
    var urlLabel = document.createElement('label');
    urlLabel.textContent = '头图 URL';
    var urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'editor-input column-head-url-input';
    urlInput.placeholder = '输入头图路径或URL';
    urlInput.value = col.headImageUrl || '';
    urlRow.appendChild(urlLabel);
    urlRow.appendChild(urlInput);
    settings.appendChild(urlRow);

    // 头图预览(默认隐藏)
    var previewWrap = document.createElement('div');
    previewWrap.className = 'column-head-preview';
    var previewImg = document.createElement('img');
    previewImg.className = 'column-head-preview-img';
    previewImg.alt = '头图预览';
    previewWrap.appendChild(previewImg);
    settings.appendChild(previewWrap);

    applyHeadImageState(col, urlRow, previewWrap, previewImg);

    pageEl.appendChild(settings);

    // ---- 子标题区 ----
    var subSection = document.createElement('div');
    subSection.className = 'column-subtitle-section';

    var btnGroup = document.createElement('div');
    btnGroup.className = 'editor-btn-group';
    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'editor-btn editor-btn-primary column-add-subtitle';
    addBtn.textContent = '添加子标题';
    var removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'editor-btn editor-btn-danger column-remove-subtitle';
    removeBtn.textContent = '删除子标题';
    btnGroup.appendChild(addBtn);
    btnGroup.appendChild(removeBtn);
    subSection.appendChild(btnGroup);

    var subTitle = document.createElement('div');
    subTitle.className = 'editor-section-title';
    subTitle.textContent = '子标题列表';
    subSection.appendChild(subTitle);

    var subList = document.createElement('div');
    subList.className = 'column-subtitle-list';
    subSection.appendChild(subList);

    pageEl.appendChild(subSection);

    container.appendChild(pageEl);

    // ---- 事件绑定 ----
    nameInput.addEventListener('input', function () {
      EditorApp.updateColumn(columnId, { name: nameInput.value });
    });

    headSelect.addEventListener('change', function () {
      var val = headSelect.value;
      if (val === 'other') {
        urlRow.classList.add('is-visible');
        previewWrap.classList.remove('is-visible');
        EditorApp.updateColumn(columnId, { headImage: 'other' });
      } else if (val === 'none') {
        urlRow.classList.remove('is-visible');
        previewWrap.classList.remove('is-visible');
        EditorApp.updateColumn(columnId, { headImage: 'none' });
      } else {
        urlRow.classList.remove('is-visible');
        previewWrap.classList.add('is-visible');
        previewImg.src = HEAD_IMG_PREFIX + val;
        EditorApp.updateColumn(columnId, { headImage: val });
      }
    });

    urlInput.addEventListener('input', function () {
      EditorApp.updateColumn(columnId, { headImageUrl: urlInput.value });
    });

    addBtn.addEventListener('click', function () {
      var subId = EditorApp.addSubtitle(columnId);
      if (subId) {
        EditorApp.openTab('subtitle', subId);
      }
    });

    removeBtn.addEventListener('click', function () {
      EditorApp.removeSubtitle(columnId);
    });

    // ---- 子标题列表初次渲染 ----
    renderSubtitleList(container, columnId);
  }

  // 数据变更时仅刷新子标题列表(保留输入框焦点)
  function refresh(containerEl, columnId) {
    renderSubtitleList(containerEl, columnId);
  }

  // 注册到 EditorApp
  EditorApp.pages.column.render = render;
  EditorApp.pages.column.refresh = refresh;
})(window);

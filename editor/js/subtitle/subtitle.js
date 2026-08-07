/* ============================================================
   公告创建器 - 子标题编辑页 (subtitle.js)
   负责:子标题名称编辑、正文编辑、富文本快捷插入
   纯 ES5 兼容语法,无第三方依赖
   注册: EditorApp.pages.subtitle.render
   ============================================================ */
(function (global) {
  'use strict';

  var EditorApp = global.EditorApp;
  var RichText = global.RichText;

  // ---------- 构建单个富文本卡片 ----------
  function buildCard(style) {
    var card = document.createElement('div');
    card.className = 'richtext-card';
    card.setAttribute('data-style-id', style.id);

    // 顶部:复选框 + 名称
    var top = document.createElement('div');
    top.className = 'richtext-card-top';

    var check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'richtext-card-check';

    var name = document.createElement('span');
    name.className = 'richtext-card-name';
    name.textContent = style.name;

    top.appendChild(check);
    top.appendChild(name);
    card.appendChild(top);

    // 参数概要
    var params = document.createElement('div');
    params.className = 'richtext-card-params';
    var paramText = (style.params && style.params.length)
      ? style.params.map(function (p) { return p.name; }).join(' · ')
      : '无参数';
    params.textContent = paramText;
    card.appendChild(params);

    // 参数输入区 (选中后才显示)
    var area = document.createElement('div');
    area.className = 'richtext-card-param-area';
    if (style.params && style.params.length) {
      for (var i = 0; i < style.params.length; i++) {
        var p = style.params[i];
        var group = document.createElement('div');
        group.className = 'richtext-param-group';

        var label = document.createElement('label');
        label.textContent = p.name;

        var input = document.createElement('input');
        input.type = (p.type === 'color') ? 'color' : 'text';
        input.setAttribute('data-param', p.name);
        input.setAttribute('placeholder', '输入' + p.name);

        // 数字参数:仅允许 0-9 . ,
        if (p.type === 'number') {
          (function (inp) {
            inp.addEventListener('input', function () {
              inp.value = inp.value.replace(/[^0-9.,]/g, '');
            });
          })(input);
        }

        group.appendChild(label);
        group.appendChild(input);
        area.appendChild(group);
      }
    }
    card.appendChild(area);

    return card;
  }

  // ---------- 渲染子标题编辑页 ----------
  function render(container, columnId, subtitleId) {
    container.textContent = '';

    // ===== 构建 DOM =====
    var page = document.createElement('div');
    page.className = 'subtitle-page';

    // 左侧功能区:子标题名称 + 富文本快捷插入
    var sideCol = document.createElement('div');
    sideCol.className = 'subtitle-side-col';

    // 名称区
    var nameSection = document.createElement('div');
    nameSection.className = 'subtitle-name-section';
    var nameRow = document.createElement('div');
    nameRow.className = 'editor-form-row';
    var nameLabel = document.createElement('label');
    nameLabel.textContent = '子标题名称';
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'editor-input subtitle-name-input';
    nameRow.appendChild(nameLabel);
    nameRow.appendChild(nameInput);
    nameSection.appendChild(nameRow);
    sideCol.appendChild(nameSection);

    // 富文本面板区
    var rtSection = document.createElement('div');
    rtSection.className = 'subtitle-richtext-section';
    var rtTitle = document.createElement('div');
    rtTitle.className = 'editor-section-title';
    rtTitle.textContent = '富文本快捷插入';
    var grid = document.createElement('div');
    grid.className = 'richtext-grid';
    var rtActions = document.createElement('div');
    rtActions.className = 'richtext-actions';
    var insertBtn = document.createElement('button');
    insertBtn.className = 'editor-btn editor-btn-primary richtext-insert-btn';
    insertBtn.textContent = '生成并插入';
    rtActions.appendChild(insertBtn);
    rtSection.appendChild(rtTitle);
    rtSection.appendChild(grid);
    rtSection.appendChild(rtActions);
    sideCol.appendChild(rtSection);

    page.appendChild(sideCol);

    // 右侧主区:正文编辑
    var mainCol = document.createElement('div');
    mainCol.className = 'subtitle-main-col';

    var editorSection = document.createElement('div');
    editorSection.className = 'subtitle-editor-section';
    var editorTitle = document.createElement('div');
    editorTitle.className = 'editor-section-title';
    editorTitle.textContent = '正文编辑';
    var textarea = document.createElement('textarea');
    textarea.className = 'subtitle-textarea';
    textarea.setAttribute('placeholder', '输入正文内容，可使用富文本标记...');
    var btnGroup = document.createElement('div');
    btnGroup.className = 'editor-btn-group';
    btnGroup.style.marginTop = '8px';
    var saveBtn = document.createElement('button');
    saveBtn.className = 'editor-btn editor-btn-primary subtitle-save-btn';
    saveBtn.textContent = '保存';
    var clearBtn = document.createElement('button');
    clearBtn.className = 'editor-btn subtitle-clear-btn';
    clearBtn.textContent = '清空';
    btnGroup.appendChild(saveBtn);
    btnGroup.appendChild(clearBtn);
    var hint = document.createElement('div');
    hint.className = 'subtitle-save-hint';
    hint.textContent = '点击「保存」后内容才会生效到数据模型';
    editorSection.appendChild(editorTitle);
    editorSection.appendChild(textarea);
    editorSection.appendChild(btnGroup);
    editorSection.appendChild(hint);
    mainCol.appendChild(editorSection);

    page.appendChild(mainCol);

    container.appendChild(page);

    // ===== 查找子标题 =====
    var sub = EditorApp.findSubtitle(columnId, subtitleId);
    if (!sub) {
      container.textContent = '';
      var err = document.createElement('div');
      err.className = 'subtitle-page';
      err.style.color = '#888';
      err.style.display = 'block';
      err.style.overflow = 'auto';
      err.textContent = '未找到该子标题，可能已被删除。';
      container.appendChild(err);
      return;
    }

    // 填充初始值
    nameInput.value = sub.name || '';
    textarea.value = sub.content || '';

    // ===== 渲染富文本卡片网格 =====
    var styles = RichText.STYLES;
    var cardEls = {};     // id -> card 元素
    var cardChecks = {};  // id -> checkbox 元素
    for (var i = 0; i < styles.length; i++) {
      var card = buildCard(styles[i]);
      grid.appendChild(card);
      cardEls[styles[i].id] = card;
      cardChecks[styles[i].id] = card.querySelector('.richtext-card-check');
    }

    // 本实例的选中状态 (与 4388336169.html 一致:默认选中 'color')
    var checkedIds = {};
    checkedIds['color'] = true;

    // ---------- 更新卡片视觉/禁用状态 ----------
    function updateCardStates() {
      var hasImage = !!checkedIds['image'];
      var hasEnd = !!checkedIds['end'];
      var hasOther = false;
      for (var k in checkedIds) {
        if (k !== 'image' && k !== 'end' && checkedIds[k]) {
          hasOther = true;
          break;
        }
      }

      for (var id in cardEls) {
        var cardEl = cardEls[id];
        var isChecked = !!checkedIds[id];
        if (isChecked) {
          cardEl.classList.add('checked');
        } else {
          cardEl.classList.remove('checked');
        }
        cardChecks[id].checked = isChecked;

        // 禁用逻辑:
        //   image 选中 → 其它全部禁用
        //   end    选中 → 其它全部禁用
        //   其它选中     → image / end 禁用
        var disabled = false;
        if (hasImage && id !== 'image') {
          disabled = true;
        } else if (hasEnd && id !== 'end') {
          disabled = true;
        } else if (hasOther && (id === 'image' || id === 'end')) {
          disabled = true;
        }
        if (disabled) {
          cardEl.classList.add('disabled');
        } else {
          cardEl.classList.remove('disabled');
        }
      }
    }

    // ---------- 选中/取消逻辑 ----------
    function selectStyle(id, checked) {
      if (checked) {
        if (id === 'image') {
          // 图片:取消其它全部,仅选 image
          for (var k in checkedIds) {
            delete checkedIds[k];
          }
          checkedIds['image'] = true;
        } else if (id === 'end') {
          // 结束:取消其它全部,仅选 end
          for (var k2 in checkedIds) {
            delete checkedIds[k2];
          }
          checkedIds['end'] = true;
        } else {
          // 普通样式:取消 image 与 end,加入自身
          delete checkedIds['image'];
          delete checkedIds['end'];
          checkedIds[id] = true;
        }
      } else {
        delete checkedIds[id];
      }
      updateCardStates();
    }

    // ---------- 卡片点击委托 ----------
    grid.addEventListener('click', function (e) {
      var target = e.target;
      var cardEl = null;
      while (target && target !== grid) {
        if (target.classList && target.classList.contains('richtext-card')) {
          cardEl = target;
          break;
        }
        target = target.parentNode;
      }
      if (!cardEl) return;
      var sid = cardEl.getAttribute('data-style-id');
      if (!sid) return;

      // 禁用卡片:不响应
      if (cardEl.classList.contains('disabled')) return;

      // 点击复选框:交给 change 事件处理
      if (e.target.classList && e.target.classList.contains('richtext-card-check')) {
        return;
      }
      // 点击参数输入框:不切换选中
      if (e.target.tagName === 'INPUT') {
        return;
      }

      // 切换
      var nowChecked = !checkedIds[sid];
      selectStyle(sid, nowChecked);
    });

    // ---------- 复选框 change 事件委托 ----------
    grid.addEventListener('change', function (e) {
      var target = e.target;
      if (!target.classList || !target.classList.contains('richtext-card-check')) return;
      var cardEl = null;
      var node = target.parentNode;
      while (node && node !== grid) {
        if (node.classList && node.classList.contains('richtext-card')) {
          cardEl = node;
          break;
        }
        node = node.parentNode;
      }
      if (!cardEl) return;
      var sid = cardEl.getAttribute('data-style-id');
      if (!sid) return;

      // 禁用卡片:回滚复选框状态
      if (cardEl.classList.contains('disabled')) {
        target.checked = !!checkedIds[sid];
        return;
      }
      selectStyle(sid, target.checked);
    });

    updateCardStates();

    // ===== 业务事件 =====

    // 名称自动保存
    nameInput.addEventListener('input', function () {
      EditorApp.updateSubtitle(columnId, subtitleId, { name: this.value });
    });

    // 保存按钮
    saveBtn.addEventListener('click', function () {
      EditorApp.updateSubtitle(columnId, subtitleId, { content: textarea.value });
      EditorApp.showToast('已保存');
    });

    // 清空按钮 (仅清空文本框,不保存)
    clearBtn.addEventListener('click', function () {
      textarea.value = '';
    });

    // 生成并插入
    insertBtn.addEventListener('click', function () {
      var selectedIds = [];
      for (var k in checkedIds) {
        if (checkedIds[k]) selectedIds.push(k);
      }
      if (!selectedIds.length) {
        EditorApp.showToast('请至少选择一个样式');
        return;
      }

      // 收集每个已选样式的参数值
      var paramValues = {};
      for (var idx = 0; idx < selectedIds.length; idx++) {
        var sid = selectedIds[idx];
        var cardEl = cardEls[sid];
        var inputs = cardEl.querySelectorAll('input[data-param]');
        var vals = {};
        for (var j = 0; j < inputs.length; j++) {
          var pname = inputs[j].getAttribute('data-param');
          vals[pname] = inputs[j].value;
        }
        paramValues[sid] = vals;
      }

      var generated = RichText.generate(selectedIds, paramValues);
      if (!generated) return;

      var start = textarea.selectionStart;
      var end = textarea.selectionEnd;
      textarea.value = textarea.value.substring(0, start) + generated + textarea.value.substring(end);
      textarea.focus();

      var phText = '';
      var phIdx = -1;
      if (generated.indexOf('链接url') !== -1) {
        phText = '链接url';
        phIdx = generated.indexOf('链接url');
      } else if (generated.indexOf('文字') !== -1) {
        phText = '文字';
        phIdx = generated.indexOf('文字');
      }
      if (phIdx !== -1) {
        textarea.selectionStart = start + phIdx;
        textarea.selectionEnd = start + phIdx + phText.length;
      } else {
        textarea.selectionStart = textarea.selectionEnd = start + generated.length;
      }
      EditorApp.showToast('已插入');
    });
  }

  // ---------- 注册 render ----------
  if (EditorApp && EditorApp.pages && EditorApp.pages.subtitle) {
    EditorApp.pages.subtitle.render = render;
  }
})(window);

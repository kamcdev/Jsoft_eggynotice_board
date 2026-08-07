/* ============================================================
   公告创建器 - 富文本工具 (rich-text.js)
   提供:富文本样式定义、字符串生成、净字数统计
   纯 ES5 兼容语法,无第三方依赖
   暴露: window.RichText
   ============================================================ */
(function (global) {
  'use strict';

  var STYLES = [
    { id: 'color', name: '颜色', params: [{ name: '颜色', type: 'color' }], format: 'c:{颜色}', end: false, image: false },
    { id: 'size', name: '字号', params: [{ name: '字号', type: 'number' }], format: 's:{字号}', end: false, image: false },
    { id: 'outline', name: '描边', params: [{ name: '颜色', type: 'color' }, { name: '大小', type: 'number' }], format: 'o:{颜色}|O:{大小}', end: false, image: false },
    { id: 'glow', name: '外发光', params: [{ name: '颜色', type: 'color' }, { name: '大小', type: 'number' }], format: 'g:{颜色}|G:{大小}', end: false, image: false },
    { id: 'shadow', name: '投影', params: [{ name: '颜色', type: 'color' }, { name: '偏移', type: 'number' }], format: 'y:{颜色}|Y:{偏移}', end: false, image: false },
    { id: 'strike', name: '中划线', params: [{ name: '颜色', type: 'color' }], format: 'h:{颜色}', end: false, image: false },
    { id: 'underline', name: '下划线', params: [{ name: '颜色', type: 'color' }], format: 'u:{颜色}', end: false, image: false },
    { id: 'link', name: '超链接', params: [], format: 'e:url_0|i:link_inner', end: false, image: false },
    { id: 'end', name: '结束富文本', params: [], format: '#l', end: true, image: false },
    { id: 'image', name: '插入图片', params: [{ name: 'url', type: 'text' }, { name: '大小', type: 'number' }], format: '#p(f:{url}|s:{大小})', end: false, image: true }
  ];

  // 根据 id 查找样式定义
  function getStyleById(id) {
    for (var i = 0; i < STYLES.length; i++) {
      if (STYLES[i].id === id) return STYLES[i];
    }
    return null;
  }

  // 填充格式模板:{参数名} 替换为对应值;color 类型去掉 # 前缀
  function fillFormat(formatStr, params, values) {
    var result = formatStr;
    var vals = values || {};
    for (var i = 0; i < params.length; i++) {
      var p = params[i];
      var placeholder = '{' + p.name + '}';
      var raw = vals[p.name] != null ? vals[p.name] : '';
      var val = String(raw);
      if (p.type === 'color') {
        val = val.replace(/^#/, '');
      }
      result = result.split(placeholder).join(val);
    }
    return result;
  }

  var RichText = {
    STYLES: STYLES,

    // selectedIds: 已选样式 id 数组
    // paramValues: { 样式id: { 参数名: 值 } }
    // 返回生成的富文本字符串
    generate: function (selectedIds, paramValues) {
      if (!selectedIds || !selectedIds.length) return '';

      // 1. 包含图片
      if (selectedIds.indexOf('image') !== -1) {
        var imgStyle = getStyleById('image');
        if (!imgStyle) return '';
        var imgVals = (paramValues && paramValues.image) || {};
        return fillFormat(imgStyle.format, imgStyle.params, imgVals);
      }

      // 2. 恰好仅结束
      if (selectedIds.length === 1 && selectedIds[0] === 'end') {
        return '#l';
      }

      // 3. 普通富文本组合
      var filtered = [];
      for (var i = 0; i < selectedIds.length; i++) {
        var sid = selectedIds[i];
        if (sid !== 'end' && sid !== 'image') filtered.push(sid);
      }
      if (!filtered.length) return '';

      var parts = [];
      for (var j = 0; j < filtered.length; j++) {
        var st = getStyleById(filtered[j]);
        if (!st) continue;
        var vals = (paramValues && paramValues[st.id]) || {};
        parts.push(fillFormat(st.format, st.params, vals));
      }
      if (!parts.length) return '';

      // 含超链接样式时占位符为"链接url",否则为"文字"
      var placeholder = filtered.indexOf('link') !== -1 ? '链接url' : '文字';
      return '#f(' + parts.join('|') + ')' + placeholder;
    },

    // 统计去掉富文本标记后的净字数
    countNetChars: function (text) {
      if (text == null) return 0;
      var s = String(text);

      // 1. 去掉 #cRRGGBB 颜色标记
      s = s.replace(/#c[0-9a-fA-F]{6}/g, '');

      // 2. 去掉 #f(...) 富文本开始标记(保留其包裹的文字)
      s = s.replace(/#f\([^)]*\)/g, '');

      // 3. 去掉 #l 结束标记
      s = s.replace(/#l/g, '');

      // 4. 去掉 #p(...) 内联图片标记
      s = s.replace(/#p\([^)]*\)/g, '');

      // 5. 去掉 #image# 到行尾的子标题图片标记
      s = s.replace(/#image#.*$/gm, '');

      // 6. 去掉换行
      s = s.replace(/\n/g, '');

      return s.length;
    }
  };

  global.RichText = RichText;
})(window);

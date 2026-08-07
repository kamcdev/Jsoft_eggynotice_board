
(function (global) {
  'use strict';

  var DEFAULT_URL = 'https://u5.update.netease.com/game_notice/android.txt';

  
  function isAbsolutePath(p) {
    return /^(blob:|data:|https?:|file:|\/\/)/i.test(p) || p.charAt(0) === '/';
  }

  
  function fileNameOf(path) {
    var parts = String(path).split('/');
    return parts[parts.length - 1];
  }

  
  function toDirectPath(path) {
    if (!path) return '';
    if (isAbsolutePath(path)) return path;
    return fileNameOf(path);
  }

  
  function replacePaths(items) {
    (Array.isArray(items) ? items : []).forEach(function (item) {
      if (!item) return;
      if (item.title_bg_path) item.title_bg_path = toDirectPath(item.title_bg_path);
      if (Array.isArray(item.content)) {
        for (var i = 0; i < item.content.length; i++) {
          var block = String(item.content[i]);
          var idx = block.indexOf('#image#');
          if (idx !== -1) {
            item.content[i] = block.substring(0, idx) + '#image#' + toDirectPath(block.substring(idx + 7).trim());
          }
        }
      }
    });
    return items;
  }

  
  function load(url) {
    var dataUrl = url || DEFAULT_URL;

    return fetch(dataUrl, { credentials: 'omit' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var items = JSON.parse(text);
        if (!Array.isArray(items) || items.length === 0) {
          throw new Error('公告数据格式不正确');
        }
        
        replacePaths(items);
        
        var blob = new Blob([JSON.stringify(items)], { type: 'application/json; charset=utf-8' });
        return URL.createObjectURL(blob);
      });
  }

  global.EgNoticeEgg = {
    load: load,
    DEFAULT_URL: DEFAULT_URL
  };
})(window);

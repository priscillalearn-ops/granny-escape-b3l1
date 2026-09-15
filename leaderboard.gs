/**
 * 恐怖阿嬤的英文逃脫 —— 班級排行榜後端 (v2)
 * 貼到 Google 試算表的「擴充功能 → Apps Script」，部署成網頁應用程式。
 * 「誰可以存取」一定要選「任何人」，學生才不用登入 Google。
 */

const SHEET_NAME = 'scores';
const HEADERS = ['時間', '名字', '班級', '題庫範圍', '關卡', '天數', '答對', '答錯', '是否破關', '難度'];

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * 寫入與讀取都走 GET —— Apps Script 的 POST 在跨網域會被瀏覽器擋，
 * 所以遊戲端一律用 GET 呼叫。
 *   新增成績：?action=add&name=小明&cls=三年五班&scope=B3 L1&level=3&day=2&correct=40&wrong=3&win=1
 *   讀排行榜：?limit=50
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const cb = p.callback || null;
  try {
    if (String(p.action || '') === 'add') return out_(addScore_(p), cb);
    return out_(topList_(p), cb);
  } catch (err) {
    return out_({ ok: false, error: String(err) }, cb);
  }
}

/** 保留 POST 介面（有些情況仍可用） */
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    return out_(addScore_(d), null);
  } catch (err) {
    return out_({ ok: false, error: String(err) }, null);
  }
}

function addScore_(d) {
  const name = String(d.name || '').trim().slice(0, 20);
  if (!name) return { ok: false, error: 'no name' };
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    getSheet().appendRow([
      new Date(),
      name,
      String(d.cls || '').trim().slice(0, 20),
      String(d.scope || '').trim().slice(0, 40),
      Number(d.level) || 1,
      Number(d.day) || 0,
      Number(d.correct) || 0,
      Number(d.wrong) || 0,
      (d.win === true || d.win === 1 || d.win === '1' || d.win === 'true') ? 1 : 0,
      (d.easy === true || d.easy === 1 || d.easy === '1' || d.easy === 'true') ? '簡單' : '普通'
    ]);
    return { ok: true };
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function topList_(p) {
  const cls = String(p.cls || '').trim();
  const scope = String(p.scope || '').trim();
  const limit = Math.min(Number(p.limit) || 30, 100);

  const sh = getSheet();
  const rows = sh.getLastRow() > 1
    ? sh.getRange(2, 1, sh.getLastRow() - 1, HEADERS.length).getValues()
    : [];

  let list = rows.map(function (r) {
    return {
      ts: r[0] ? new Date(r[0]).getTime() : 0,
      name: String(r[1] || '').trim(),
      cls: String(r[2] || '').trim(),
      scope: String(r[3] || '').trim(),
      level: Number(r[4]) || 0,
      day: Number(r[5]) || 0,
      correct: Number(r[6]) || 0,
      wrong: Number(r[7]) || 0,
      win: r[8] === 1 || r[8] === '1' || r[8] === true
    };
  }).filter(function (x) {
    // 濾掉空列，以及不小心重複寫入的標題列
    return x.name && x.name !== HEADERS[1];
  });

  if (cls) list = list.filter(function (x) { return x.cls === cls; });
  if (scope) list = list.filter(function (x) { return x.scope === scope; });

  const best = {};
  list.forEach(function (x) {
    const k = x.cls + '|' + x.name;
    if (!best[k] || rank_(x) > rank_(best[k])) best[k] = x;
  });

  const top = Object.keys(best).map(function (k) { return best[k]; })
    .sort(function (a, b) { return rank_(b) - rank_(a); })
    .slice(0, limit);

  const classes = {};
  list.forEach(function (x) { if (x.cls) classes[x.cls] = 1; });

  return { ok: true, list: top, classes: Object.keys(classes).sort(), total: list.length };
}

/** 排序分數：破關優先 → 答對多 → 天數少 */
function rank_(x) {
  return (x.win ? 1e12 : 0) + x.correct * 1e6 + (999 - Math.min(x.day, 999)) * 1e3;
}

function out_(obj, cb) {
  const body = JSON.stringify(obj);
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + body + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 恐怖阿嬤的英文逃脫 —— 班級排行榜後端
 * 請貼到 Google 試算表的「擴充功能 → Apps Script」裡，然後部署成網頁應用程式。
 * 詳細步驟見 README。
 */

const SHEET_NAME = 'scores';
const HEADERS = ['時間', '名字', '班級', '題庫範圍', '關卡', '天數', '答對', '答錯', '是否破關', '難度'];

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** 學生破關或失敗時，遊戲會打這支上傳成績 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const d = JSON.parse(e.postData.contents);
    const name = String(d.name || '').trim().slice(0, 20);
    if (!name) return out_({ ok: false, error: 'no name' }, null);
    getSheet().appendRow([
      new Date(),
      name,
      String(d.cls || '').trim().slice(0, 20),
      String(d.scope || '').trim().slice(0, 40),
      Number(d.level) || 1,
      Number(d.day) || 0,
      Number(d.correct) || 0,
      Number(d.wrong) || 0,
      d.win ? 1 : 0,
      d.easy ? '簡單' : '普通'
    ]);
    return out_({ ok: true }, null);
  } catch (err) {
    return out_({ ok: false, error: String(err) }, null);
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/** 遊戲讀取排行榜：?cls=三年五班&scope=B3 L1&limit=30 （都可省略） */
function doGet(e) {
  const p = (e && e.parameter) || {};
  const cb = p.callback || null;
  try {
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
        name: String(r[1] || ''),
        cls: String(r[2] || ''),
        scope: String(r[3] || ''),
        level: Number(r[4]) || 0,
        day: Number(r[5]) || 0,
        correct: Number(r[6]) || 0,
        wrong: Number(r[7]) || 0,
        win: r[8] === 1 || r[8] === '1' || r[8] === true
      };
    }).filter(function (x) { return x.name; });

    if (cls) list = list.filter(function (x) { return x.cls === cls; });
    if (scope) list = list.filter(function (x) { return x.scope === scope; });

    // 同一個人只留最好的一筆
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

    return out_({ ok: true, list: top, classes: Object.keys(classes).sort(), total: list.length }, cb);
  } catch (err) {
    return out_({ ok: false, error: String(err) }, cb);
  }
}

/** 排序分數：破關優先 → 答對多 → 天數少 → 早上傳 */
function rank_(x) {
  return (x.win ? 1e12 : 0) + x.correct * 1e6 + (999 - Math.min(x.day, 999)) * 1e3 - (x.ts % 1e3);
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

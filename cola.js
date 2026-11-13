// Cola de registros en IndexedDB. La usan la página y el service worker.
var Cola = (function () {
  var DB = 'registro-prueba', V = 1;

  function abrir() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB, V);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains('filas')) db.createObjectStore('filas', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('config')) db.createObjectStore('config');
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(store, modo, fn) {
    return abrir().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(store, modo), s = t.objectStore(store), out = fn(s);
        t.oncomplete = function () { res(out instanceof IDBRequest ? out.result : out); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }

  function agregar(fila) { return tx('filas', 'readwrite', function (s) { s.put(fila); }); }
  function todas() { return tx('filas', 'readonly', function (s) { return s.getAll(); }); }
  function marcar(ids) {
    return tx('filas', 'readwrite', function (s) {
      ids.forEach(function (id) {
        var g = s.get(id);
        g.onsuccess = function () { if (g.result) { g.result.subido = true; s.put(g.result); } };
      });
    });
  }
  function getConfig() { return tx('config', 'readonly', function (s) { return s.get('servidor'); }); }
  function setConfig(c) { return tx('config', 'readwrite', function (s) { s.put(c, 'servidor'); }); }

  // Manda lo pendiente al Apps Script. Devuelve cuántas quedaron subidas.
  function subir() {
    return Promise.all([getConfig(), todas()]).then(function (r) {
      var cfg = r[0], pend = r[1].filter(function (f) { return !f.subido; });
      if (!cfg || !cfg.url || !pend.length) return 0;
      var filas = pend.map(function (f) { return { id: f.id, fecha: f.fecha, monto: f.monto, origen: f.origen, creado: f.creado }; });
      return fetch(cfg.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita la verificación previa (CORS)
        body: JSON.stringify({ clave: cfg.clave, filas: filas })
      }).then(function (resp) { return resp.json(); }).then(function (j) {
        if (!j.ok) throw new Error(j.error || 'error');
        return marcar(j.recibidos).then(function () { return j.recibidos.length; });
      });
    });
  }

  return { agregar: agregar, todas: todas, subir: subir, getConfig: getConfig, setConfig: setConfig };
})();

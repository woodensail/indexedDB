/*global indexedDB*/
'use strict';
(function (factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof define === 'function' && define.cmd) {
        define(function (require, exports, module) {
            module.exports = factory();
        });
    }
}(function () {
    var DbPromise = function (fun) {
        this.state = 'pending';
        this.resolveList = [];
        this.rejectList = [];
        var _this = this;
        fun(function () {
            _this.resolve.apply(_this, arguments)
        }, function () {
            _this.reject.apply(_this, arguments)
        });
    };
    DbPromise.prototype = {};
    DbPromise.prototype.resolve = function (data) {
        this.state = 'resolved';
        this.data = data;
        var _this = this;
        this.resolveList.forEach(function (fun) {
            _this.data = fun(_this.data)
        });
    };
    DbPromise.prototype.reject = function (data) {
        this.state = 'rejected';
        this.error = data;
        this.rejectList.forEach(function (fun) {
            fun(data);
        });
    };
    DbPromise.prototype.then = function (fun) {
        if (this.state === 'pending') {
            this.resolveList.push(fun);
        } else {
            this.data = fun(this.data);
        }
        return this;
    };
    DbPromise.prototype.catch = function (fun) {
        if (this.state === 'pending') {
            this.rejectList.push(fun);
        } else {
            fun(this.error);
        }
        return this;
    };

    var DB = function (name, upgrade, version) {
        var _this = this;
        if (DB.dbMap[name]) {
            var map = DB.dbMap[name];
            return _open(name, map.upgrade, map.version).then(function (db) {
                _this.db = db;
                return _this;
            }).then(map.nextStep);
        } else {
            return _open(name, upgrade, version).then(function (db) {
                _this.db = db;
                return _this;
            });
        }
    };
    DB.prototype = {};

    DB.prototype.put = function (table, data, tx) {
        return _put(this.db, table, data, tx || this.tx);
    };
    DB.prototype.get = function (table, name, tx) {
        return _get(this.db, table, name, tx || this.tx);
    };
    DB.prototype.clear = function (table, tx) {
        return _clear(this.db, table, tx || this.tx);
    };
    DB.prototype.transaction = function (table, type, asDefault) {
        var tx = _transaction(this.db, table, type);
        if (asDefault) {
            this.tx = tx;
        }
        return tx;
    };
    DB.prototype.transactionEnd = function () {
        this.tx = void 0;
    };
    DB.prototype.getKv = function (table, k, tx) {
        return _get(this.db, table, k, tx).then(o=>(o.target.result || {}).v);
    };
    DB.prototype.putKv = function (table, k, v, tx) {
        return _put(this.db, table, {k, v}, tx).then(o=>(o.target.result));
    };

    DB.prototype.getKvStore = function (name) {
        var _this = this;
        return function (k, v) {
            if (v === void 0) {
                return _get(_this.db, name, k).then(o=>(o.target.result || {}).v);
            } else {
                return _put(_this.db, name, {k, v}).then(o=>(o.target.result || {}).v);
            }
        }
    };
    DB.dbMap = {};
    return DB;

    function _open(name, upgrade, version) {
        return new Promise(function (resolve) {
            var request = indexedDB.open(name, version);
            request.onupgradeneeded = upgrade;
            request.onsuccess = function (e) {
                resolve(request.result);
            };

        });
    }

    function _put(db, table, data, tx, g) {
        return new DbPromise(function (resolve) {
            tx = tx || db.transaction(table, 'readwrite');
            var store = tx.objectStore(table);
            store.put(data).onsuccess = function (e) {
                resolve(e);
            };
        });
    }

    function _clear(db, table, tx) {
        return new Promise(function (resolve) {
            tx = tx || db.transaction(table, 'readwrite');
            var store = tx.objectStore(table);
            store.clear();
            tx.oncomplete = function (e) {
                resolve(e);
            };
        });
    }

    function _get(db, table, key, tx, g) {
        return new DbPromise(function (resolve) {
            tx = tx || db.transaction(table, 'readonly');
            var store = tx.objectStore(table);
            store.get(key).onsuccess = function (e) {
                resolve(e);
            };
        });
    }

    function _transaction(db, table, type) {
        return db.transaction(table, type);
    }
}));
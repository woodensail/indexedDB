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
    var Transaction = function (db, table, type) {
        this.transaction = db.transaction(table, type);
        this.requests = [];
        this.nexts = [];
        this.errorFuns = [];
    };
    Transaction.prototype = {};
    Transaction.prototype.put = function (table, data) {
        var store = this.transaction.objectStore(table);
        this.requests.push([store.put(data)]);
    };
    Transaction.prototype.get = function (table, key) {
        var store = this.transaction.objectStore(table);
        this.requests.push([store.get(key)]);
    };
    Transaction.prototype.putKV = function (table, k, v) {
        var store = this.transaction.objectStore(table);
        this.requests.push([store.put({k, v})]);
    };
    Transaction.prototype.getKV = function (table, key) {
        var store = this.transaction.objectStore(table);
        this.requests.push([store.get(key), item=>(item || {}).v]);
    };
    Transaction.prototype.then = function (fun) {
        var _this = this;
        if (this.errored) {
            return this;
        }
        if (!_this.nexts.length) {
            _this.nexts.push(fun);
            fun(_this.results);
            _this.goNext();
        } else {
            _this.nexts.push(fun);
        }
        return _this;
    };
    Transaction.prototype.goNext = function () {
        var _this = this;
        var total = _this.requests.length;
        _this.counter = 0;
        var success = function () {
            if (_this.errored) {
                return;
            }
            _this.nexts.shift();
            _this.requests = [];
            _this.results = _this.events.map(function (e, index) {
                if (_this.parser[index]) {
                    return _this.parser[index](e.target.result);
                } else {
                    return e.target.result;
                }
            });
            if (_this.nexts.length) {
                _this.nexts[0](..._this.results);
                _this.goNext();
            }
        };
        _this.events = new Array(total);
        _this.parser = {};

        if (total === 0) {
            success();
        }

        _this.requests.forEach(function (request, index) {
            _this.parser[index] = request[1];
            request[0].onsuccess = _this.onsuccess(total, index, success);
            request[0].onerror = _this.onerror;
        })
    };
    Transaction.prototype.onsuccess = function (total, index, callback) {
        var _this = this;
        return function (e) {
            _this.events[index] = e;
            _this.counter++;
            if (_this.counter === total) {
                callback();
            }
        }
    };
    Transaction.prototype.onerror = function (e) {
        this.errored = true;
        this.errorEvent = e;
        this.errorFuns.forEach(fun=>fun(e));
    };
    Transaction.prototype.catch = function (fun) {
        if (this.errored) {
            fun(this.errorEvent);
        } else {
            this.errorFuns.push(fun);
        }
    };

    var DB = function (name, upgrade, version) {
        var _this = this;
        if (DB.dbMap[name]) {
            return DB.dbMap[name](this);
        } else {
            return _open(name, upgrade, version).then(function (db) {
                _this.db = db;
                return _this;
            });
        }
    };
    DB.prototype = {};

    DB.prototype.put = function (table, data, tx) {
        return _put(this.db, table, data, tx);
    };
    DB.prototype.get = function (table, name, tx) {
        return _get(this.db, table, name, tx);
    };
    DB.prototype.clear = function (table, tx) {
        return _clear(this.db, table, tx);
    };
    DB.prototype.transaction = function (table, type) {
        return new Transaction(this.db, table, type);//_transaction(this.db, table, type);
    };
    DB.prototype.getKv = function (name) {
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

    function _put(db, table, data) {
        return new Promise(function (resolve) {
            var tx = db.transaction(table, 'readwrite');
            var store = tx.objectStore(table);
            store.put(data).onsuccess = function (e) {
                resolve(e);
            };
        });
    }

    function _clear(db, table) {
        return new Promise(function (resolve) {
            var tx = db.transaction(table, 'readwrite');
            var store = tx.objectStore(table);
            store.clear();
            tx.oncomplete = function (e) {
                resolve(e);
            };
        });
    }

    function _get(db, table, key) {
        return new Promise(function (resolve) {
            var tx = db.transaction(table, 'readwrite');
            var store = tx.objectStore(table);
            store.get(key).onsuccess = function (e) {
                resolve(e);
            };
        });
    }
}));

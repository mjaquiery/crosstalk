"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManagerComponent = void 0;
var ManagerComponent = /** @class */ (function () {
    function ManagerComponent(manager) {
        this._manager = manager;
    }
    Object.defineProperty(ManagerComponent.prototype, "state", {
        get: function () { return null; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ManagerComponent.prototype, "loggable", {
        get: function () { return this.state ? this.state : this; },
        enumerable: false,
        configurable: true
    });
    return ManagerComponent;
}());
exports.ManagerComponent = ManagerComponent;
//# sourceMappingURL=ManagerComponent.js.map
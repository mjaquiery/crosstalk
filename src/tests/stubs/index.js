"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
exports.manager_stub = exports.VideoManagerStub = void 0;
var classes_1 = require("../../classes");
var VideoManager_1 = require("../../classes/VideoManager");
var VideoManagerStub = /** @class */ (function (_super) {
    __extends(VideoManagerStub, _super);
    function VideoManagerStub() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    VideoManagerStub.prototype.get_token = function (player, i) {
        if (i === void 0) { i = 0; }
        return new Promise(function (res, rej) { return "".concat(player.id, "_token"); });
    };
    VideoManagerStub.prototype.close_all = function () { };
    VideoManagerStub.prototype.create_session = function () { };
    return VideoManagerStub;
}(VideoManager_1.VideoManager));
exports.VideoManagerStub = VideoManagerStub;
exports.manager_stub = new classes_1.Manager(null, "test_stub_game", {
    logger: console,
    video_manager: (function () { return new VideoManagerStub(_this); })()
});
//# sourceMappingURL=index.js.map
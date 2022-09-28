"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var classes_1 = require("../classes");
var stubs_1 = require("./stubs");
describe('Manager', function () {
    it('should initialize', function (done) {
        var _this = this;
        var manager = new classes_1.Manager(null, "test_game", {
            logger: console,
            video_manager: (function () { return new stubs_1.VideoManagerStub(_this); })()
        });
        expect(manager).toBeInstanceOf(classes_1.Manager);
        done();
    });
});
//# sourceMappingURL=Manager.test.js.map
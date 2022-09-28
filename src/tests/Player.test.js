"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var classes_1 = require("../classes");
describe('Player', function () {
    it('should initialize', function (done) {
        var player = new classes_1.Player(null, {
            socket: null,
            name: "Test Player",
            network_token: "network-token",
            index: 0
        });
        expect(player).toBeInstanceOf(classes_1.Player);
        expect(player.name).toEqual("Test Player");
        expect(player.id).toEqual("network-token");
        player.name = "New name";
        expect(player.name).toEqual("New name");
        done();
    });
});
//# sourceMappingURL=Player.test.js.map
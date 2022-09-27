"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var manager_1 = require("../manager");
describe('Player', function () {
    it('should initialize', function (done) {
        var player = new manager_1.Player(null, {
            socket: null,
            name: "Test Player",
            network_token: "network-token",
            index: 0
        });
        expect(player).toBeInstanceOf(manager_1.Player);
        expect(player.name).toEqual("Test Player");
        expect(player.id).toEqual("network-token");
        player.name = "New name";
        expect(player.name).toEqual("New name");
        done();
    });
});
//# sourceMappingURL=player.test.js.map
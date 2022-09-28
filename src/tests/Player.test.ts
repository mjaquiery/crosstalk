import { Player} from "../classes";

describe('Player', function () {

    it('should initialize', function (done) {
        const player = new Player(null, {
            socket: null,
            name: "Test Player",
            network_token: "network-token",
            index: 0
        })
        expect(player).toBeInstanceOf(Player)
        expect(player.name).toEqual("Test Player")
        expect(player.id).toEqual("network-token")

        player.name = "New name"
        expect(player.name).toEqual("New name")
        done()
    })
})
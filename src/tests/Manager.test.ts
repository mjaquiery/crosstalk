import {Manager} from "../classes";
import {VideoManagerStub} from "./stubs";

describe('Manager', function () {

    it('should initialize', function (done) {
        const manager = new Manager(
            null,
            "test_game",
            {
                logger: console,
                video_manager: (() => new VideoManagerStub(this))()
            })
        expect(manager).toBeInstanceOf(Manager)
        done()
    })
})
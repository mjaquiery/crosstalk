import {Manager, Player} from "../../classes";
import {VideoManager} from "../../classes/VideoManager";

export class VideoManagerStub extends VideoManager {
    get_token(player: Player, i: number = 0): Promise<string | null> {
        return new Promise((res, rej) => `${player.id}_token`)
    }
    close_all() {}
    create_session() {}
}
export const manager_stub: Manager = new Manager(
    null,
    "test_stub_game",
    {
        logger: console,
        video_manager: (() => new VideoManagerStub(this))()
    }
    )
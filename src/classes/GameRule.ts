import {GameRules, GameStage, EnabledStatus} from "../enums/enums";

export class GameRule {
    name: GameRules
    values: { [k in GameStage]: EnabledStatus }

    /**
     * A Rule maps GameStages to EnabledStatuses.
     * The value can be supplied as a single EnabledStatus, which will be copied to all GameStages,
     * or as an object with GameStages as keys and EnabledStatuses as values.
     *
     * If given an object, the following rules are used for working out what the EnabledStatus will
     * be at each GameStage:
     * * If an EnabledStatus is declared for this GameStage, use that
     * * Otherwise, use the EnabledStatus last declared.
     * * Otherwise, use the first EnabledStatus that is declared
     */
    constructor(name: GameRules, values: EnabledStatus | Partial<{ [k in GameStage]: EnabledStatus }>) {
        this.name = name
        const _values: Partial<{ [k in GameStage]: EnabledStatus }> = {}

        if(values instanceof Object) {
            let last_value
            const backfill = []
            for(const gamestage in GameStage) {
                const stage: GameStage = GameStage[gamestage as keyof typeof GameStage]
                if(values[stage] in EnabledStatus) {
                    _values[stage] = values[stage]
                    last_value = values[stage]
                    while(backfill.length) {
                        _values[backfill.pop()] = last_value
                    }
                } else if(typeof last_value !== 'undefined') {
                    _values[stage] = last_value
                } else {
                    backfill.push(stage)
                }
            }
        } else {
            // Single value supplied
            for(const gamestage in GameStage) {
                const stage: GameStage = GameStage[gamestage as keyof typeof GameStage]
                _values[stage] = values
            }
        }
        // @ts-ignore -- we know we have a full set of values here because we iterated through
        this.values = _values
    }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameRule = void 0;
var enums_1 = require("../enums/enums");
var GameRule = /** @class */ (function () {
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
    function GameRule(name, values) {
        this.name = name;
        var _values = {};
        if (values instanceof Object) {
            var last_value = void 0;
            var backfill = [];
            for (var gamestage in enums_1.GameStage) {
                var stage = enums_1.GameStage[gamestage];
                if (values[stage] in enums_1.EnabledStatus) {
                    _values[stage] = values[stage];
                    last_value = values[stage];
                    while (backfill.length) {
                        _values[backfill.pop()] = last_value;
                    }
                }
                else if (typeof last_value !== 'undefined') {
                    _values[stage] = last_value;
                }
                else {
                    backfill.push(stage);
                }
            }
        }
        else {
            // Single value supplied
            for (var gamestage in enums_1.GameStage) {
                var stage = enums_1.GameStage[gamestage];
                _values[stage] = values;
            }
        }
        // @ts-ignore -- we know we have a full set of values here because we iterated through
        this.values = _values;
    }
    return GameRule;
}());
exports.GameRule = GameRule;
//# sourceMappingURL=GameRule.js.map
export enum GameStage {
    Pre_begin = 'Pre-begin',
    Initial_presentation = 'Initial presentation',
    Player_moves_enabled = 'Player moves enabled',
    Player_moves_in_progress = 'Player moves in progress',
    Player_moves_complete = 'Player moves complete',
    Reveal_moves = 'Reveal moves',
    Reveal_payoff = 'Reveal payoff',
    End = 'End',
    Cleanup = 'Cleanup',
}

export enum EnabledStatus {
    Force_off = -1,
    Unset = 0,
    Force_on = 1
}

export enum GameRules {
    allow_chat = 'allow chat',
    allow_video = 'allow video',
    allow_player_move = 'allow player move',
    show_description = 'show description',
    show_own_score = 'show own score',
    show_payoff_matrix = 'show payoff matrix',
    show_partner_moves = 'show partner moves',
    show_partner_payoff = 'show partner payoff',
    show_partner_score = 'show partner score'
}

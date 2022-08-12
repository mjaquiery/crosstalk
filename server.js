let { Manager, Game } = new require('./build/manager')
let manager
let app = require('express')()
let http = require('http').Server(app)
let io = require('socket.io')(http, {
    cors: {
        origin: "http://localhost:8080",
        methods: ["GET", "POST"],
        credentials: true
    },
    allowEIO3: true
})

// app.get('/', (req, res) => {
//     res.sendFile(__dirname + '/index.html')
// })

store = {}

http.listen(3000, () => {
    console.log('Listening on port *: 3000')
})


function new_manger(game_count = 5) {
    const manager = new Manager(io)

    const coop = {value: 2, label: 'Small fine'}
    const betrayed = {value: 0, label: 'Huge sentence'}
    const betrayer = {value: 10, label: 'No punishment'}
    const mutual_defection = {value: 1, label: 'Heavy sentence'}
    const cooperate = {
        resultString: (p1, p2) => `
    <span data-player-index="${p1.index}">${p1.name}</span>
     and 
    <span data-player-index="${p2.index}">${p2.name}</span>
     cooperate`,
        payoffs: [coop, coop]
    }
    const p1_betrays = {
        resultString: (p1, p2) => `
    <span data-player-index="${p1.index}">${p1.name}</span>
     betrays 
    <span data-player-index="${p2.index}">${p2.name}</span>`,
        payoffs: [betrayer, betrayed]
    }
    const p2_betrays = {
        resultString: (p1, p2) => `
    <span data-player-index="${p2.index}">${p2.name}</span>
     betrays 
    <span data-player-index="${p1.index}">${p1.name}</span>`,
        payoffs: [betrayed, betrayer]
    }
    const both_defect = {
        resultString: (p1, p2) => `
    <span data-player-index="${p1.index}">${p1.name}</span>
     and 
    <span data-player-index="${p2.index}">${p2.name}</span>
     betray one another`,
        payoffs: [mutual_defection, mutual_defection]
    }

    const game = () => new Game(manager, {
        name: 'Prisoner\'s dilemma',
        description: `
    <p>
        You are sat at a table being interrogated. 
        Across the hall you can see your partner, also being interrogated.
        You know they haven't got much on you; 
        if neither you nor your partner talk, the most you'll get is a small fine.
    </p>
    <p>
        If one of you talks and the other doesn't, 
        whoever talks walks away and lets the other bear a much heavier sentence.
        If you both talk, though, you're both in for a heavy sentence.
    </p>
    `,
        prompt: `
    <p>
        The pressure is on. What are you going to do?
    </p>
    `,
        decision_labels: [
            {text: 'Keep quiet', icon: '&#129296;'},
            {text: 'Talk', icon: '&#128516;'}
        ],
        payoff_matrix: [
            // Payoff values [P1, P2] for:
            // P1 Co-op     P1 Defect
            [cooperate,     p1_betrays],    // P2 Co-op
            [p2_betrays,    both_defect],   // P2 Defect
        ]
    })

    for(let i = 0; i < game_count; i++) {
        manager.add_games(game())
    }
    return manager
}

io.on('connection', (socket) => {

    session = socket.handshake.headers.cookie
        .split(';')
        .map(x => x.split('='))
        .find(x => x[0].match("^ *sessionid$"))[1]
    console.log(`New connection: ${socket.id} [${session}]`)
    try {console.debug(`Current manager player count: ${manager.payers.length}`)}
    catch (e) {console.debug(`Creating new manager`)}

    if(typeof manager === 'undefined' || manager.players.length === 2) {
        manager = new_manger()
    }
    manager.add_player(socket)

});
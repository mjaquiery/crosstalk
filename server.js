let { Manager, Game } = new require('./build/manager')
let manager

const express = require('express');
const session = require('express-session');
const fs = require('fs');
const cors = require('cors');
const https = require('https');
const socketIO = require("socket.io");

const origins = ["https://localhost:8080", "https://192.168.0.84:8080"]
const corsOptions = {
    origin: origins,
    credentials: true
};
const sshOptions = {
    key: fs.readFileSync('openvidukey.pem'),
    cert: fs.readFileSync('openviducert.pem')
};

const http = https.createServer(sshOptions, express()).listen(3000, () => {
    console.log('Listening on port *:3000')
});

const io = new socketIO.Server(http, {
    cors: corsOptions,
    allowEIO3: true,
    cookie: {
        sameSite: "none",
        secure: true
    }
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
    try {
        console.log(`New connection: ${socket.id}`)
        try {console.debug(`Current manager player count: ${manager.payers.length}`)}
        catch (e) {console.debug(`Creating new manager`)}

        if(typeof manager === 'undefined' || manager.players.length === 2) {
            manager = new_manger()
        }
        manager.add_player(socket)
    } catch (e) {
        console.debug({headers: socket.handshake.headers})
        console.error(e)
    }
});

/* Video channel */
// Adapted from
// https://github.com/OpenVidu/openvidu-tutorials/tree/master/openvidu-mvc-node/server.js

/* CONFIGURATION */

let OpenVidu = require('openvidu-node-client').OpenVidu;
const { Recording, RecordingMode } = require('openvidu-node-client')
let OpenViduRole = require('openvidu-node-client').OpenViduRole;

// Environment variable: URL where our OpenVidu server is listening
const OPENVIDU_URL = process.env.OPENVIDU_URL;
// Environment variable: secret shared with our OpenVidu server
const OPENVIDU_SECRET = process.env.OPENVIDU_SECRET;

// For demo purposes we ignore self-signed certificate
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

// Node imports
let bodyParser = require('body-parser'); // Pull information from HTML POST (express4)
let video_app = express(); // Create our app with express

// Server configuration
video_app.use(session({
    saveUninitialized: true,
    resave: false,
    secret: OPENVIDU_SECRET,
    cookie: {
        sameSite: "none",
        secure: true,
    },
}));
// Handle CORS (https://stackoverflow.com/a/49189275)
video_app.use(cors(corsOptions));
video_app.use(express.static(__dirname + '/public')); // Set the static files location
video_app.use(bodyParser.urlencoded({
    'extended': 'true'
})); // Parse application/x-www-form-urlencoded
video_app.use(bodyParser.json()); // Parse application/json
video_app.use(bodyParser.json({
    type: 'application/vnd.api+json'
})); // Parse application/vnd.api+json as json
video_app.set('view engine', 'ejs'); // Embedded JavaScript as template engine

// Listen (start app with node server.js)
https.createServer(sshOptions, video_app).listen(5000, () => {
    console.log('Video server listening on port *:5000')
});

// Mock database
const users = [{
    user: "publisher1",
    pass: "pass",
    role: OpenViduRole.PUBLISHER
}, {
    user: "subscriber",
    pass: "pass",
    role: OpenViduRole.SUBSCRIBER
}];

// Entrypoint to OpenVidu Node Client SDK
const OV = new OpenVidu(OPENVIDU_URL, OPENVIDU_SECRET);

// Collection to pair session names with OpenVidu Session objects
const mapSessions = {};
// Collection to pair session names with tokens
const mapSessionNamesTokens = {};

/* CONFIGURATION */

/* App interface */

video_app.post('/api/login', (req, res) => {
    console.log({session: req.session, body: req.body})
    // Check if the user is already logged in
    if (isLogged(req.session)) {
        // User is already logged. Immediately return dashboard
        user = req.session.loggedUser;
        res.json({user, warning: "Already logged on."});
    } else {
        // User wasn't logged and wants to

        // Retrieve params from POST body
        const user = req.body.user;
        const pass = req.body.pass;
        console.log("Logging in | {user, pass}={" + user + ", " + pass + "}");

        if (login(user, pass)) { // Correct user-pass
            // Validate session and return OK
            // Value stored in req.session allows us to identify the user in future requests
            console.log("'" + user + "' has logged in");
            req.session.loggedUser = user;
            res.json({user});
        } else { // Wrong user-pass
            // Invalidate session and return index template
            console.log("'" + user + "' invalid credentials");
            req.session.destroy();
            res.json({"error": "Invalid credentials."});
        }
    }
})

video_app.post('/api/session', (req, res) => {
    console.log({session: req.session, body: req.body})
    if (!isLogged(req.session)) {
        req.session.destroy();
        console.error("Not logged in.")
        res.json({error: "Not logged in."});
    } else {
        // The nickname sent by the client
        const clientData = req.body.data;
        // The video-call to connect
        const sessionName = req.body.sessionname;

        // Role associated to this user
        const role = users.find(u => (u.user === req.session.loggedUser)).role;

        // Optional data to be passed to other users when this user connects to the video-call
        // In this case, a JSON with the value we stored in the req.session object on login
        const serverData = JSON.stringify({ serverData: req.session.loggedUser });

        console.log("Getting a token | {sessionName}={" + sessionName + "}");

        // Build connectionProperties object with the serverData and the role
        const connectionProperties = {
            data: serverData,
            role: role
        };

        if (mapSessions[sessionName]) {
            // Session already exists
            console.log('Existing session ' + sessionName);

            // Get the existing Session from the collection
            const mySession = mapSessions[sessionName];

            // Generate a new token asynchronously with the recently created connectionProperties
            mySession.createConnection(connectionProperties)
                .then(connection => {

                    console.debug({connection})

                    // Store the new token in the collection of tokens
                    mapSessionNamesTokens[sessionName].push(connection.token);

                    // Return session template with all the needed attributes
                    res.json({
                        sessionId: mySession.getSessionId(),
                        token: connection.token,
                        nickName: clientData,
                        userName: req.session.loggedUser,
                        sessionName: sessionName
                    });
                })
                .catch(error => {
                    console.error(error);
                    res.json({error})
                });
        } else {
            // New session
            console.log('New session ' + sessionName);

            // Create a new OpenVidu Session asynchronously
            OV.createSession({
                recordingMode: RecordingMode.ALWAYS,
                defaultRecordingProperties: {
                    outputMode: Recording.OutputMode.INDIVIDUAL,
                    resolution: "640x480",
                    frameRate: 24
                }
            })
                .then(session => {
                    console.debug({session})
                    // Store the new Session in the collection of Sessions
                    mapSessions[sessionName] = session;
                    // Store a new empty array in the collection of tokens
                    mapSessionNamesTokens[sessionName] = [];

                    // Generate a new token asynchronously with the recently created connectionProperties
                    session.createConnection(connectionProperties)
                        .then(connection => {

                            console.debug({connection})

                            // Store the new token in the collection of tokens
                            mapSessionNamesTokens[sessionName].push(connection.token);

                            // Return session template with all the needed attributes
                            res.json({
                                sessionName: sessionName,
                                token: connection.token,
                                nickName: clientData,
                                userName: req.session.loggedUser,
                            });
                        })
                        .catch(error => {
                            console.error(error);
                            res.json({error})
                        });
                })
                .catch(error => {
                    console.error(error);
                    res.json({error})
                });
        }
    }
});

/* REST API */

video_app.post('/', loginController);
video_app.get('/', loginController);

function loginController(req, res) {
    if (req.session.loggedUser) { // User is logged
        user = req.session.loggedUser;
        res.redirect('/dashboard');
    } else { // User is not logged
        req.session.destroy();
        res.render('index.ejs');
    }
}

video_app.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

video_app.post('/dashboard', dashboardController);
video_app.get('/dashboard', dashboardController);

function dashboardController(req, res) {

    // Check if the user is already logged in
    if (isLogged(req.session)) {
        // User is already logged. Immediately return dashboard
        user = req.session.loggedUser;
        res.render('dashboard.ejs', {
            user: user
        });
    } else {
        // User wasn't logged and wants to

        // Retrieve params from POST body
        const user = req.body.user;
        const pass = req.body.pass;
        console.log("Logging in | {user, pass}={" + user + ", " + pass + "}");

        if (login(user, pass)) { // Correct user-pass
            // Validate session and return OK
            // Value stored in req.session allows us to identify the user in future requests
            console.log("'" + user + "' has logged in");
            req.session.loggedUser = user;
            res.render('dashboard.ejs', {
                user: user
            });
        } else { // Wrong user-pass
            // Invalidate session and return index template
            console.log("'" + user + "' invalid credentials");
            req.session.destroy();
            res.redirect('/');
        }
    }
}

video_app.post('/session', (req, res) => {
    if (!isLogged(req.session)) {
        req.session.destroy();
        res.redirect('/');
    } else {
        // The nickname sent by the client
        const clientData = req.body.data;
        // The video-call to connect
        const sessionName = req.body.sessionname;

        // Role associated to this user
        const role = users.find(u => (u.user === req.session.loggedUser)).role;

        // Optional data to be passed to other users when this user connects to the video-call
        // In this case, a JSON with the value we stored in the req.session object on login
        const serverData = JSON.stringify({ serverData: req.session.loggedUser });

        console.log("Getting a token | {sessionName}={" + sessionName + "}");

        // Build connectionProperties object with the serverData and the role
        const connectionProperties = {
            data: serverData,
            role: role
        };

        if (mapSessions[sessionName]) {
            // Session already exists
            console.log('Existing session ' + sessionName);

            // Get the existing Session from the collection
            const mySession = mapSessions[sessionName];

            // Generate a new token asynchronously with the recently created connectionProperties
            mySession.createConnection(connectionProperties)
                .then(connection => {

                    // Store the new token in the collection of tokens
                    mapSessionNamesTokens[sessionName].push(connection.token);

                    // Return session template with all the needed attributes
                    res.render('session.ejs', {
                        sessionId: mySession.getSessionId(),
                        token: connection.token,
                        nickName: clientData,
                        userName: req.session.loggedUser,
                        sessionName: sessionName
                    });
                })
                .catch(error => {
                    console.error(error);
                });
        } else {
            // New session
            console.log('New session ' + sessionName);

            // Create a new OpenVidu Session asynchronously
            OV.createSession({
                recordingMode: RecordingMode.ALWAYS,
                defaultRecordingProperties: {
                    outputMode: Recording.OutputMode.INDIVIDUAL,
                    resolution: "640x480",
                    frameRate: 24
                }
            })
                .then(session => {
                    // Store the new Session in the collection of Sessions
                    mapSessions[sessionName] = session;
                    // Store a new empty array in the collection of tokens
                    mapSessionNamesTokens[sessionName] = [];

                    // Generate a new token asynchronously with the recently created connectionProperties
                    session.createConnection(connectionProperties)
                        .then(connection => {

                            // Store the new token in the collection of tokens
                            mapSessionNamesTokens[sessionName].push(connection.token);

                            // Return session template with all the needed attributes
                            res.render('session.ejs', {
                                sessionName: sessionName,
                                token: connection.token,
                                nickName: clientData,
                                userName: req.session.loggedUser,
                            });
                        })
                        .catch(error => {
                            console.error(error);
                        });
                })
                .catch(error => {
                    console.error(error);
                });
        }
    }
});

video_app.post('/leave-session', (req, res) => {
    if (!isLogged(req.session)) {
        req.session.destroy();
        res.render('index.ejs');
    } else {
        // Retrieve params from POST body
        const sessionName = req.body.sessionname;
        const token = req.body.token;
        console.log('Removing user | {sessionName, token}={' + sessionName + ', ' + token + '}');

        // If the session exists
        if (mapSessions[sessionName] && mapSessionNamesTokens[sessionName]) {
            const tokens = mapSessionNamesTokens[sessionName];
            const index = tokens.indexOf(token);

            // If the token exists
            if (index !== -1) {
                // Token removed
                tokens.splice(index, 1);
                console.log(sessionName + ': ' + tokens.toString());
            } else {
                const msg = 'Problems in the app server: the TOKEN wasn\'t valid';
                console.log(msg);
                res.redirect('/dashboard');
            }
            if (tokens.length === 0) {
                // Last user left: session must be removed
                console.log(sessionName + ' empty!');
                delete mapSessions[sessionName];
            }
            res.redirect('/dashboard');
        } else {
            const msg = 'Problems in the app server: the SESSION does not exist';
            console.log(msg);
            res.status(500).send(msg);
        }
    }
});

/* REST API */

/* AUXILIARY METHODS */

function login(user, pass) {
    if(user && pass && users.find(u => u.user === user && u.pass === pass))
        return true
    if(/^publisher[0-9]{2}$/.test(user) && pass === 'pass') {
        users.push({user, pass, role: OpenViduRole.PUBLISHER})
        return true
    }
    return false
}

function isLogged(session) {
    return (session.loggedUser != null);
}

function getBasicAuth() {
    return 'Basic ' + (new Buffer('OPENVIDUAPP:' + OPENVIDU_SECRET).toString('base64'));
}

/* AUXILIARY METHODS */
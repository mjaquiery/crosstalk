# Crosstalk server

[![Node.js CI](https://github.com/mjaquiery/crosstalk/actions/workflows/node.js.yml/badge.svg)](https://github.com/mjaquiery/crosstalk/actions/workflows/node.js.yml)

## Background

Crosstalk is a project to collect interactive video data from participants in head-to-head
economic games.
In the basic setup, participants play consecutive rounds of the Prisoners' Dilemma
with one another while being able to view the other player's webcam footage.
Game activity and video data are recorded for scientific analysis.

## Deployment

This repository houses two components that are deployed together 
with a WebRTC server (OpenVidu). 
The components are the crosstalk game manager itself, 
and a simple web service to facilitate access to the data.
These services are deployed together using Docker compose.

### OpenVidu WebRTC

The OpenVidu WebRTC server connects the players directly using WebRTC
and also records the webcam data they stream to one another.

### crosstalk

The crosstalk game manager spawns two-player economic games on demand,
each composed of a number of rounds that are played through sequentially.
Games are defined in terms of their prompt text and payoff structure.

Players join and play through a frontend (e.g. this one written in VueJS)
which communicates with crosstalk via websockets.

#### `Manager`

A manager is spawned for each new continuous set of games that 
are to be played between two players.
It links a webserver instance with a list of `Game`s that it will play through sequentially. 
When the second player joins, the first `Game` begins.

#### `Game`

Games are primarily defined in terms of their `PayoffMatrix`.
These are in turn made up of `PayoffSets`, 
that provide the `Payoffs` for the two players.

Each Payoff consists of a value (number of points) and a label (text description).
A pair of `Payoffs` make up a `PayoffSet`, which has a `resultString` 
(a function that takes the `Player` names and returns a text description of what happend)
and the `payoffs`.

A `PayoffMatrix` is a list of lists containing `PayoffSet` pairs.
The first of these lists is consulted when Player Two cooperates, 
the second when Player Two defects.
The first entry of the relevant list is chosen when Player One cooperates,
and the second when Player One defects.

Player moves are defined by a pair of `decision_labels`, 
each label having `text` and `icon` properties. 

A `Game` may also have a `name`, `description`, and `prompt`. 
Generally, the frontend will show these to the players, 
showing the description during the initial setup and the prompt
when actions are required.

### Data server

A simple webserver facilitates password-protected access to 
the game and video data generated by the other two services.

## Contributing

The repository can be cloned

```shell
git clone https://github.com/mjaquiery/crosstalk.git
cd crosstalk
```

and then hosted with docker:

```shell
docker-compose up
```

The ports exposed are:
* `3000` - crosstalk wss interface
* `8000` - data server http interface
* `4443` - OpenVidu http interface

These values can be edited in `docker-compose.yml`. 
You may wish to change the IP assigned to the `rtc` service.
If you change it in `rtc`'s environment (`DOMAIN_OR_PUBLIC_IP`),
you will also have to change it in `app`'s environment (`OPENVIDU_URL`).

A relevant frontend will need to be downloaded and run
(in two different browser windows simultaneously)
in order to actually play the games during development.

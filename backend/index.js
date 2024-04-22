const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
var uniqid = require('uniqid');
const GameService = require('./services/game.service');

// ---------------------------------------------------
// -------- CONSTANTS AND GLOBAL VARIABLES -----------
// ---------------------------------------------------

let games = [];
let queue = [];

// ---------------------------------
// -------- GAME METHODS -----------
// ---------------------------------


const updateClientsViewTimers = (games) => {

  // On notifie finalement les clients que les données sont mises à jour.
  games.player1Socket.emit('game.timer', GameService.send.forPlayer.gameTimer('player:1', games.gameState));
  games.player2Socket.emit('game.timer', GameService.send.forPlayer.gameTimer('player:2', games.gameState));

}

const updateClientsViewDecks = (games) => {

  setTimeout(() => {
    // On notifie finalement les clients que les données sont mises à jour.
    games.player1Socket.emit('game.decks.view-state', GameService.send.forPlayer.deckViewState('player:1', games.gameState));
    games.player2Socket.emit('game.decks.view-state', GameService.send.forPlayer.deckViewState('player:2', games.gameState));

  }, 200)

}

const newPlayerInQueue = (socket) => {

  queue.push(socket);

  // Queue management
  if (queue.length >= 2) {
    const player1Socket = queue.shift();
    const player2Socket = queue.shift();
    createGame(player1Socket, player2Socket);
  }
  else {
    socket.emit('queue.added', GameService.send.forPlayer.viewQueueState());
  }
};

const createGame = (player1Socket, player2Socket) => {

  const newGame = GameService.init.gameState();
  newGame['idGame'] = uniqid();
  newGame['player1Socket'] = player1Socket;
  newGame['player2Socket'] = player2Socket;

  games.push(newGame);

  const gameIndex = GameService.utils.findGameIndexById(games, newGame.idGame);

  games[gameIndex].player1Socket.emit('game.start', GameService.send.forPlayer.viewGameState('player:1', games[gameIndex]));
  games[gameIndex].player2Socket.emit('game.start', GameService.send.forPlayer.viewGameState('player:2', games[gameIndex]));

  games[gameIndex].player1Socket.emit('game.decks.view-state', GameService.send.forPlayer.deckViewState('player:1', games[gameIndex]));
  games[gameIndex].player2Socket.emit('game.decks.view-state', GameService.send.forPlayer.deckViewState('player:2', games[gameIndex]));


  const gameInterval = setInterval(() => {
    games[gameIndex].gameState.timer--;


    // Si le timer tombe à zéro
    if (games[gameIndex].gameState.timer === 0) {

      // On change de tour en inversant le clé dans 'currentTurn'
      games[gameIndex].gameState.currentTurn = games[gameIndex].gameState.currentTurn === 'player:1' ? 'player:2' : 'player:1';
      // Méthode du service qui renvoie la constante 'TURN_DURATION'
      games[gameIndex].gameState.timer = GameService.timer.getTurnDuration();
      GameService.init.deck();
      GameService.send.forPlayer.deckViewState(playerKey, gameState)

    }

    updateClientsViewDecks(games[gameIndex]);

    updateClientsViewTimers(games[gameIndex]);

    }, 1000);


  // On prévoit de couper l'horloge
  // pour le moment uniquement quand le socket se déconnecte
  player1Socket.on('disconnect', () => {
    clearInterval(gameInterval);
  });
  player2Socket.on('disconnect', () => {
    clearInterval(gameInterval);
  });

  // combinations management
  const dices = { ...games[gameIndex].gameState.deck.dices};
  const isDefi = false;
  const isSec = games[gameIndex].gameState.deck.rollsCounter === 2;
  const combinations = GameService.choices.findCombinations(dices, isDefi, isSec);

  // we affect changes to gameState
  games[gameIndex].gameState.choices.availableChoices = combinations;

  // emitters
  updateClientsViewChoices(games[gameIndex]);

  socket.on('game.choices.selected', (data) => {
    // gestion des choix
    const gameIndex = GameService.utils.findGameIndexBySocketId(games, socket.id);
    games[gameIndex].gameState.choices.idSelectedChoice = data.choiceId;

    updateClientsViewChoices(games[gameIndex]);
  });

};



// ---------------------------------------
// -------- SOCKETS MANAGEMENT -----------
// ---------------------------------------

io.on('connection', socket => {
  console.log(`[${socket.id}] socket connected`);

  socket.on('queue.join', () => {
    console.log(`[${socket.id}] new player in queue `)
    newPlayerInQueue(socket);
  });

  socket.on('disconnect', reason => {
    console.log(`[${socket.id}] socket disconnected - ${reason}`);
  });
});

// -----------------------------------
// -------- SERVER METHODS -----------
// -----------------------------------

app.get('/', (req, res) => res.sendFile('index.html'));
// Start the express server
http.listen(3001, function(){
  console.log('listening on *:3001');
});

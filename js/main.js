// Main app - Navigation and game switching
(function () {
  const landing = document.getElementById('landing');
  const gameScreen = document.getElementById('game-screen');
  const gameContainer = document.getElementById('game-container');
  const gameTitle = document.getElementById('game-title');
  const gameScore = document.getElementById('game-score');
  const gameControls = document.getElementById('game-controls');
  const backBtn = document.getElementById('back-btn');

  let currentGame = null;

  const games = {
    kancha: { name: 'Kancha (Marbles)', obj: KanchaGame },
    lagori: { name: 'Lagori (Seven Stones)', obj: LagoriGame },
    stapu: { name: 'Stapu (Hopscotch)', obj: StapuGame },
    lattu: { name: 'Lattu (Top Spinning)', obj: LattuGame },
  };

  function showScreen(id) {
    landing.classList.remove('active');
    gameScreen.classList.remove('active');
    document.getElementById(id).classList.add('active');
  }

  function startGame(gameId) {
    const game = games[gameId];
    if (!game) return;

    // Clean up previous game
    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }
    gameContainer.innerHTML = '';
    gameScore.textContent = '';

    gameTitle.textContent = game.name;
    showScreen('game-screen');

    game.obj.init(gameContainer, (scoreText) => {
      gameScore.textContent = scoreText;
    });

    gameControls.textContent = game.obj.getControls();
    currentGame = game.obj;

    // Scroll to top
    window.scrollTo(0, 0);
  }

  function goBack() {
    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }
    gameContainer.innerHTML = '';
    gameScore.textContent = '';
    gameControls.textContent = '';
    showScreen('landing');
  }

  // Event listeners
  document.querySelectorAll('.game-card').forEach((card) => {
    card.addEventListener('click', () => {
      startGame(card.dataset.game);
    });
  });

  backBtn.addEventListener('click', goBack);
})();

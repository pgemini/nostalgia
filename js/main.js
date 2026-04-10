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
    kancha: { name: 'Kancha (Marbles)', obj: () => KanchaGame },
    lagori: { name: 'Lagori (Seven Stones)', obj: () => LagoriGame },
    stapu: { name: 'Stapu (Hopscotch)', obj: () => StapuGame },
    lattu: { name: 'Lattu (Top Spinning)', obj: () => LattuGame },
    tyre: { name: 'Taayra (Tyre Rolling)', obj: () => TyreGame },
    gillidanda: { name: 'Gilli Danda', obj: () => GilliDandaGame },
    atyapatya: { name: 'Atya Patya', obj: () => AtyaPatyaGame },
    rumaal: { name: 'Rumaal Jhapatta', obj: () => RumaalGame },
  };

  function showScreen(id) {
    landing.classList.remove('active');
    gameScreen.classList.remove('active');
    document.getElementById(id).classList.add('active');
  }

  function startGame(gameId) {
    const game = games[gameId];
    if (!game) return;

    // Initialize sound on user interaction
    if (window.Sounds) Sounds.init();

    if (currentGame) {
      currentGame.destroy();
      currentGame = null;
    }
    gameContainer.innerHTML = '';
    gameScore.textContent = '';

    gameTitle.textContent = game.name;
    showScreen('game-screen');

    const gameObj = game.obj();
    gameObj.init(gameContainer, (scoreText) => {
      gameScore.textContent = scoreText;
    });

    gameControls.textContent = gameObj.getControls();
    currentGame = gameObj;

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

  // Sound toggle button
  const soundBtn = document.createElement('button');
  soundBtn.id = 'sound-toggle';
  soundBtn.className = 'sound-toggle';
  soundBtn.setAttribute('aria-label', 'Toggle sound');
  soundBtn.innerHTML = '&#x1F50A;';
  soundBtn.title = 'Sound On (click to mute)';
  soundBtn.addEventListener('click', () => {
    if (window.Sounds) {
      const enabled = Sounds.toggle();
      soundBtn.innerHTML = enabled ? '&#x1F50A;' : '&#x1F507;';
      soundBtn.title = enabled ? 'Sound On (click to mute)' : 'Sound Off (click to unmute)';
      if (enabled) Sounds.pop();
    }
  });
  document.body.appendChild(soundBtn);

  // Event listeners
  document.querySelectorAll('.game-card').forEach((card) => {
    card.addEventListener('click', () => {
      if (window.Sounds) Sounds.click();
      startGame(card.dataset.game);
    });
  });

  backBtn.addEventListener('click', () => {
    if (window.Sounds) Sounds.click();
    goBack();
  });
})();

import {
    getResponsiveCanvasSize, setCanvasSize,
    applyDifficulty, GooseState, currentDifficulty,
} from './constants.js';
import { Game } from './game.js';

let game;
let scoreSubmitted = false;
let submitScore = null;
let getTopScores = null;
let rulesMode = false;
let rulesPausedGame = false;

import('./leaderboard.js').then(m => {
    submitScore = m.submitScore;
    getTopScores = m.getTopScores;
}).catch(err => console.warn('Leaderboard unavailable:', err));

window.addEventListener('load', () => {
    const size = getResponsiveCanvasSize();
    setCanvasSize(size.width, size.height);

    const container = document.querySelector('.container');
    container.style.maxWidth = (size.width + 60) + 'px';

    const canvas = document.getElementById('gameCanvas');
    game = new Game(canvas);
    window.game = game;

    const keysHeld = new Set();
    const arrowKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
    window.addEventListener('keydown', e => { if (arrowKeys.has(e.key)) { keysHeld.add(e.key); e.preventDefault(); } });
    window.addEventListener('keyup',   e => keysHeld.delete(e.key));

    function gameLoop() {
        if (!game.paused && keysHeld.size) {
            const moveSpeed = 4;
            const movable = game.geese.filter(g => g.state === GooseState.ADULT && !g.hatching && !g.hiding);
            movable.forEach(g => {
                g.vx = 0; g.vy = 0;
                if (keysHeld.has('ArrowLeft'))  { g.x = Math.max(50, g.x - moveSpeed); g.facingLeft = true; }
                if (keysHeld.has('ArrowRight')) { g.x = Math.min(game.width - 50, g.x + moveSpeed); g.facingLeft = false; }
                if (keysHeld.has('ArrowUp'))    g.y = Math.max(50, g.y - moveSpeed);
                if (keysHeld.has('ArrowDown'))  g.y = Math.min(game.height - 50, g.y + moveSpeed);
            });
        }
        game.update();
        game.draw();
        requestAnimationFrame(gameLoop);
    }
    gameLoop();

    document.getElementById('pauseBtn').addEventListener('click', () => {
        const paused = game.togglePause();
        document.getElementById('pauseBtn').textContent = paused ? 'Resume' : 'Pause';
    });

    document.getElementById('fullscreenBtn').addEventListener('click', () => {
        const container = document.querySelector('.container');
        const btn = document.getElementById('fullscreenBtn');
        if (!document.fullscreenElement) {
            container.classList.add('fullscreen');
            (container.requestFullscreen || container.webkitRequestFullscreen || container.msRequestFullscreen).call(container);
            btn.textContent = '⛶ Exit Fullscreen';
        } else {
            container.classList.remove('fullscreen');
            (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
            btn.textContent = '⛶ Fullscreen';
        }
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.querySelector('.container').classList.remove('fullscreen');
            document.getElementById('fullscreenBtn').textContent = '⛶ Fullscreen';
        }
    });

    document.getElementById('mateBtn').addEventListener('click', () => { if (game.gameOver) return; game.forceMating(); });

    const directionButtons = ['migrateNorth', 'migrateSouth', 'migrateEast', 'migrateWest'];
    directionButtons.forEach(btnId => {
        document.getElementById(btnId).addEventListener('click', () => {
            if (game.gameOver) return;
            const direction = document.getElementById(btnId).dataset.direction;
            game.triggerMigration(direction);
            directionButtons.forEach(id => document.getElementById(id).classList.remove('active'));
            document.getElementById(btnId).classList.add('active');
            setTimeout(() => document.getElementById(btnId).classList.remove('active'), 2000);
        });
    });

    document.getElementById('hideAllBtn').addEventListener('click', () => { if (game.gameOver) return; game.hideAllGeese(); });
    document.getElementById('honkBtn').addEventListener('click', () => { if (game.gameOver) return; game.honk(); });

    function lockDiffButtons() { ['diffEasy', 'diffNormal', 'diffHard'].forEach(id => document.getElementById(id).disabled = true); }
    lockDiffButtons();

    ['diffEasy', 'diffNormal', 'diffHard'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => { /* locked — read-only visual */ });
    });

    document.getElementById('fastMigrateToggle').addEventListener('click', () => {
        if (game.gameOver) return;
        game.fastMigration = !game.fastMigration;
        document.getElementById('fastMigrateToggle').textContent =
            game.fastMigration ? 'Long Flight' : 'Short Flight';
    });

    // Instructions → Difficulty → Countdown flow
    game.paused = true;

    function startCountdown(afterReset) {
        game.paused = true;

        if (afterReset) {
            scoreSubmitted = false;
            game.reset();
            document.getElementById('fastMigrateToggle').textContent = 'Short Flight';
        } else {
            const loc = game.randomStartLocation();
            game.latitude  = loc.lat;
            game.longitude = loc.lng;
            game.vegWarnThreshold = 4 + Math.floor(Math.random() * 5);
            game.regenerateTerrain();
            game.updateUI();
        }

        // THIS IS THE OTHER JOB
        game.startBGM();
        game.startAmbientForWeather();
        game.ambientStarted = true;

        const wrapper = document.querySelector('.game-wrapper');
        const overlay = document.createElement('div');
        overlay.className = 'countdown-overlay';
        wrapper.appendChild(overlay);

        const counts = ['3', '2', '1', 'GO!'];
        let i = 0;

        function showNext() {
            overlay.innerHTML = '';

            if (i >= counts.length) {
                overlay.remove();
                game.paused = false;
                document.getElementById('pauseBtn').textContent = ' Pause';
                lockDiffButtons();
                return;
            }

            const el = document.createElement('div');
            el.className   = 'countdown-number';
            el.textContent = counts[i];
            overlay.appendChild(el);

            i++;
            setTimeout(showNext, 900);
        }

        showNext();
    }

    function showDifficultyModal(afterReset) {
        const modal    = document.getElementById('difficultyModal');
        modal.classList.remove('hidden');
        const newModal = modal.cloneNode(true);
        modal.parentNode.replaceChild(newModal, modal);

        newModal.querySelectorAll('.diff-choice').forEach(btn => {
            btn.addEventListener('click', () => {
                const level = btn.dataset.diff;
                applyDifficulty(level);
                ['diffEasy', 'diffNormal', 'diffHard'].forEach(id => document.getElementById(id).classList.remove('btn-diff-active'));
                const map = { easy: 'diffEasy', normal: 'diffNormal', hard: 'diffHard' };
                document.getElementById(map[level]).classList.add('btn-diff-active');
                newModal.classList.add('hidden');
                startCountdown(afterReset);
            });
        });
    }

    function closeInstructions() {
        document.getElementById('instructionsModal').classList.add('hidden');
        document.getElementById('startGameBtn').textContent = "Let's Go! 🪿";
        if (!rulesMode) {
            showDifficultyModal(false);
        } else {
            if (rulesPausedGame) {
                game.paused = false;
                if (game.ambientAudio) game.ambientAudio.play().catch(() => {});
                if (game.bgmAudio)     game.bgmAudio.play().catch(() => {});
            }
            rulesPausedGame = false;
        }
        rulesMode = false;
    }

    document.getElementById('closeModal').addEventListener('click', closeInstructions);
    document.getElementById('startGameBtn').addEventListener('click', closeInstructions);

    document.getElementById('rulesBtn').addEventListener('click', () => {
        rulesMode = true;
        rulesPausedGame = !game.manuallyPaused && !game.gameOver;
        if (rulesPausedGame) {
            game.paused = true;
            if (game.ambientAudio) game.ambientAudio.pause();
            if (game.bgmAudio)     game.bgmAudio.pause();
        }
        document.getElementById('startGameBtn').textContent = 'Close';
        document.getElementById('instructionsModal').classList.remove('hidden');
    });
    document.getElementById('exitGameBtn').addEventListener('click', () => {
        if (!game.gameOver) game.gameOver = true;
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
        if (!game.gameOver) {
            game.gameOver = true;
        } else {
            showDifficultyModal(true);
        }
    });

    // Show score submit modal when game ends
    function checkGameOver() {
        if (game.gameOver && !scoreSubmitted) {
            scoreSubmitted = true;
            const survivedWeeks = Math.floor(game.gameTime / 120);
            document.getElementById('scoreModalText').textContent =
                `You survived ${survivedWeeks} week${survivedWeeks === 1 ? '' : 's'}! Submit your score?`;
            document.getElementById('scoreModal').classList.remove('hidden');
        }
        requestAnimationFrame(checkGameOver);
    }
    requestAnimationFrame(checkGameOver);

    document.getElementById('submitScoreBtn').addEventListener('click', async () => {
        const raw = document.getElementById('usernameInput').value.trim();
        const clean = raw.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
        const errorEl = document.getElementById('scoreModalError');
        if (!clean) { errorEl.textContent = 'Username can only contain letters, numbers and _.'; return; }
        if (!submitScore) { errorEl.textContent = 'Leaderboard not available right now.'; return; }
        errorEl.textContent = '';
        document.getElementById('submitScoreBtn').textContent = 'Submitting...';
        try {
            await submitScore(clean, Math.floor(game.gameTime / 120), currentDifficulty);
            document.getElementById('scoreSubmitForm').style.display = 'none';
            document.getElementById('scoreModalText').textContent = '🎉 Score submitted! Ready to play again?';
            document.getElementById('viewLeaderboardBtn').style.display = '';
        } catch {
            errorEl.textContent = 'Failed to submit, try again.';
            document.getElementById('submitScoreBtn').textContent = 'Submit Score';
        }
    });

    document.getElementById('skipScoreBtn').addEventListener('click', () => {
        document.getElementById('scoreSubmitForm').style.display = 'none';
        document.getElementById('scoreModalText').textContent = 'Better luck next time! Ready to play again?';
    });

    document.getElementById('viewLeaderboardBtn').addEventListener('click', () => {
        const diff = currentDifficulty;
        document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active-tab'));
        document.querySelector(`.lb-tab[data-diff="${diff}"]`)?.classList.add('active-tab');
        document.getElementById('leaderboardModal').classList.remove('hidden');
        loadLeaderboard(diff);
    });

    document.getElementById('playAgainBtn').addEventListener('click', () => {
        document.getElementById('scoreModal').classList.add('hidden');
        document.getElementById('scoreSubmitForm').style.display = '';
        document.getElementById('scoreModalText').textContent = '';
        document.getElementById('submitScoreBtn').textContent = 'Submit Score';
        document.getElementById('usernameInput').value = '';
        document.getElementById('scoreModalError').textContent = '';
        document.getElementById('viewLeaderboardBtn').style.display = 'none';
        showDifficultyModal(true);
    });

    // Leaderboard viewer
    async function loadLeaderboard(difficulty) {
        const body = document.getElementById('leaderboardBody');
        if (!getTopScores) { body.innerHTML = '<tr><td colspan="3" style="padding:6px;color:#888">Leaderboard not available.</td></tr>'; return; }
        body.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
        const scores = await getTopScores(difficulty, 10);
        body.innerHTML = scores.length ? scores.map((s, i) =>
            `<tr><td style="padding:6px">${i + 1}</td><td style="padding:6px">${s.username}</td><td style="text-align:right;padding:6px">${s.score}</td></tr>`
        ).join('') : '<tr><td colspan="3" style="padding:6px;color:#888">No scores yet!</td></tr>';
    }

    document.getElementById('leaderboardBtn').addEventListener('click', () => {
        document.getElementById('leaderboardModal').classList.remove('hidden');
        const activeDiff = document.querySelector('.lb-tab.active-tab')?.dataset.diff || currentDifficulty;
        loadLeaderboard(activeDiff);
    });

    document.querySelectorAll('.lb-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active-tab'));
            tab.classList.add('active-tab');
            loadLeaderboard(tab.dataset.diff);
        });
    });

    document.getElementById('closeLeaderboardBtn').addEventListener('click', () => {
        document.getElementById('leaderboardModal').classList.add('hidden');
    });
});

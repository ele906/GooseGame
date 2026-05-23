import {
    getResponsiveCanvasSize, setCanvasSize,
    applyDifficulty, GooseState,
} from './constants.js';
import { Game } from './game.js';

let game;

window.addEventListener('load', () => {
    const size = getResponsiveCanvasSize();
    setCanvasSize(size.width, size.height);

    const container = document.querySelector('.container');
    container.style.maxWidth = (size.width + 60) + 'px';

    const canvas = document.getElementById('gameCanvas');
    game = new Game(canvas);
    window.game = game;

    function gameLoop() {
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

    document.getElementById('mateBtn').addEventListener('click', () => game.forceMating());

    const directionButtons = ['migrateNorth', 'migrateSouth', 'migrateEast', 'migrateWest'];
    directionButtons.forEach(btnId => {
        document.getElementById(btnId).addEventListener('click', () => {
            const direction = document.getElementById(btnId).dataset.direction;
            game.triggerMigration(direction);
            directionButtons.forEach(id => document.getElementById(id).classList.remove('active'));
            document.getElementById(btnId).classList.add('active');
            setTimeout(() => document.getElementById(btnId).classList.remove('active'), 2000);
        });
    });

    document.getElementById('hideAllBtn').addEventListener('click', () => game.hideAllGeese());
    document.getElementById('honkBtn').addEventListener('click', () => game.honk());

    function lockDiffButtons() { ['diffEasy', 'diffNormal', 'diffHard'].forEach(id => document.getElementById(id).disabled = true); }
    lockDiffButtons();

    ['diffEasy', 'diffNormal', 'diffHard'].forEach(id => {
        document.getElementById(id).addEventListener('click', () => { /* locked — read-only visual */ });
    });

    document.getElementById('fastMigrateToggle').addEventListener('click', () => {
        game.fastMigration = !game.fastMigration;
        document.getElementById('fastMigrateToggle').textContent =
            game.fastMigration ? 'Long Flight' : 'Short Flight';
    });

    window.addEventListener('keydown', (e) => {
        if (game.paused) return;
        const moveSpeed = 15;
        const movable = game.geese.filter(g =>
                g.state === GooseState.ADULT && !g.hatching
            );
        if (!movable.length) return;

        // Flock centroid — stragglers get extra pull toward the center
        const cx = movable.reduce((s, g) => s + g.x, 0) / movable.length;
        const cy = movable.reduce((s, g) => s + g.y, 0) / movable.length;
        const cohesion = 0.35; // how strongly outliers are pulled in

        switch (e.key) {
            case 'ArrowUp':
                movable.forEach(g => {
                    const pull = Math.max(0, g.y - cy) * cohesion;
                    g.y = Math.max(50, g.y - (moveSpeed + pull));
                });
                e.preventDefault(); break;
            case 'ArrowDown':
                movable.forEach(g => {
                    const pull = Math.max(0, cy - g.y) * cohesion;
                    g.y = Math.min(game.height - 50, g.y + (moveSpeed + pull));
                });
                e.preventDefault(); break;
            case 'ArrowLeft':
                movable.forEach(g => {
                    g.facingLeft = true;
                    g.x = Math.max(50, g.x - moveSpeed);
                });
                e.preventDefault();
                break;

            case 'ArrowRight':
                movable.forEach(g => {
                    g.facingLeft = false;
                    g.x = Math.min(game.width - 50, g.x + moveSpeed);
                });
                e.preventDefault();
                break;
        }
    });

    // Instructions → Difficulty → Countdown flow
    game.paused = true;

    function startCountdown(afterReset) {
        game.paused = true;

        if (afterReset) {
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
        showDifficultyModal(false);
    }

    document.getElementById('closeModal').addEventListener('click', closeInstructions);
    document.getElementById('startGameBtn').addEventListener('click', closeInstructions);
    document.getElementById('resetBtn').addEventListener('click', () => showDifficultyModal(true));
});

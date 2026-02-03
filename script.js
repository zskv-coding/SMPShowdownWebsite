// Global state to store player stats for cross-tab linking
let allPlayersData = {};

function showSection(sectionId) {
    const transition = document.getElementById('tab-transition');
    if (!transition) {
        performSectionSwitch(sectionId);
        return;
    }

    // Start wipe in
    transition.classList.remove('wipe-out');
    transition.classList.add('active');

    setTimeout(() => {
        performSectionSwitch(sectionId);
        
        // Hold slightly longer for the bounce to be visible
        setTimeout(() => {
            // Start wipe out
            transition.classList.add('wipe-out');
            transition.classList.remove('active');
            
            // Clean up classes after animation
            setTimeout(() => {
                transition.classList.remove('wipe-out');
            }, 600);
        }, 300);
    }, 600);
}

function performSectionSwitch(sectionId) {
    // Hide all sections
    document.querySelectorAll('main section').forEach(section => {
        section.classList.add('hidden');
    });

    // Remove active class from all buttons
    document.querySelectorAll('.centered-nav button').forEach(button => {
        button.classList.remove('active');
    });

    // Show selected section
    document.getElementById(sectionId).classList.remove('hidden');

    // Add active class to clicked button
    const btn = document.getElementById(`btn-${sectionId}`);
    if (btn) btn.classList.add('active');

    // Scroll to top
    window.scrollTo(0, 0);
}

// Initialize Everything
document.addEventListener('DOMContentLoaded', () => {
    // Start Live Scores Update immediately
    updateLiveScores();
    setInterval(updateLiveScores, 5000); // Update every 5 seconds

    // Start Countdown
    startCountdown();

    // Initialize Bubbly Background
    initBubbles();

    // Load Players Data
    loadPlayers();

    // Initialize Twitch Embed with safety check
    try {
        if (typeof Twitch !== 'undefined') {
            new Twitch.Embed("twitch-embed", {
                width: "100%",
                height: "100%",
                channel: "smpshowdown",
                parent: [window.location.hostname, "localhost"]
            });
        } else {
            console.warn('Twitch Embed Script not loaded yet.');
        }
    } catch (e) {
        console.error('Twitch Embed failed to load:', e);
    }
});

async function updateLiveScores() {
    const teams = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'];
    
    // Helper to clear "Loading..." and reset scores
    const clearLoading = () => {
        teams.forEach(t => {
            const container = document.getElementById(`players-${t}`);
            // Only clear if it actually contains "Loading..." to avoid flicker
            if (container && container.innerHTML.includes('Loading...')) {
                container.innerHTML = '';
            }
        });
    };

    try {
        // Clear Loading state if present
        clearLoading();

        // Add a timeout to the fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        // Use absolute URL for the API
        const response = await fetch('https://apismpshowdown.vercel.app/api/scores', {
            signal: controller.signal,
            cache: 'no-store'
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API Data received:', data);

        // 1. Group Players by Team and Filter Duplicates
        const playersByTeam = {};
        teams.forEach(t => playersByTeam[t] = []);
        
        const seenPlayers = new Set();
        
        if (data.players && Array.isArray(data.players)) {
            console.log(`Processing ${data.players.length} players...`);
            data.players.forEach(player => {
                // Prevent duplicates across all teams
                if (!player.username || seenPlayers.has(player.username)) return;
                seenPlayers.add(player.username);

                if (!player.team) return;
                const rawTeam = player.team.toLowerCase();
                const teamName = rawTeam
                    .replace(/team/g, '')
                    .replace(/_/g, '')
                    .trim();
                
                if (playersByTeam[teamName]) {
                    playersByTeam[teamName].push(player);
                } else {
                    console.log(`Skipping player ${player.username} from unknown team: ${player.team} (${teamName})`);
                }
            });
        }

        // 2. Map Team Scores
        const teamScores = {};
        if (data.teams && Array.isArray(data.teams)) {
            console.log(`Processing ${data.teams.length} teams...`);
            data.teams.forEach(team => {
                if (!team.team) return;
                const name = team.team.toLowerCase()
                    .replace(/team/g, '')
                    .replace(/_/g, '')
                    .trim();
                teamScores[name] = team.score;
            });
        }

        // 3. Update DOM without full clear to prevent flicker
        teams.forEach(t => {
            // Update Team Score
            const scoreElement = document.getElementById(`score-${t}`);
            if (scoreElement) {
                const score = teamScores[t] !== undefined ? Number(teamScores[t]).toLocaleString() : '0';
                if (scoreElement.innerText !== score) {
                    scoreElement.innerText = score;
                }
            }

            // Update Player Slots
            const container = document.getElementById(`players-${t}`);
            if (container) {
                let html = '';
                const players = playersByTeam[t];
                
                // Add actual players
                players.forEach(player => {
                    const score = player.score !== undefined && player.score !== null ? Number(player.score).toLocaleString() : '0';
                    const username = player.username;
                    const lowerName = username.toLowerCase();
                    
                    if (allPlayersData[lowerName]) {
                        const p = allPlayersData[lowerName];
                        html += `
                            <div class="player-slot clickable" onclick="showPlayerStats('${p.username}', '${p.uuid}', ${p.won}, ${p.played})">
                                <div class="player-slot-info">
                                    <img src="https://mc-heads.net/avatar/${p.uuid}/24" alt="" class="slot-head">
                                    <span>${username}</span>
                                </div>
                                <span class="player-score">${score}</span>
                            </div>`;
                    } else {
                        html += `
                            <div class="player-slot">
                                <div class="player-slot-info">
                                    <img src="https://mc-heads.net/avatar/${username}/24" alt="" class="slot-head">
                                    <span>${username}</span>
                                </div>
                                <span class="player-score">${score}</span>
                            </div>`;
                    }
                });

                // Fill with TBD slots to maintain consistent height
                for (let i = players.length; i < 5; i++) {
                    html += `<div class="player-slot tbd">TBD</div>`;
                }

                // Only update DOM if content changed
                if (container.innerHTML !== html) {
                    container.innerHTML = html;
                }
            }
        });

    } catch (error) {
        console.error('Score Update Failed:', error);
        
        // On failure, fill all containers with TBD to avoid showing stale data
        teams.forEach(t => {
            const container = document.getElementById(`players-${t}`);
            if (container) {
                let html = '';
                for (let i = 0; i < 5; i++) {
                    html += `<div class="player-slot tbd">TBD</div>`;
                }
                container.innerHTML = html;
            }
        });
    }
}

function startCountdown() {
    const targetDate = new Date("February 15, 2026 14:00:00 CST").getTime();

    const update = () => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance < 0) {
            document.querySelector(".countdown-container").innerHTML = "<h2 style='color: var(--gold)'>LIVE NOW!</h2>";
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        document.getElementById("days").innerText = days.toString().padStart(2, '0');
        document.getElementById("hours").innerText = hours.toString().padStart(2, '0');
        document.getElementById("minutes").innerText = minutes.toString().padStart(2, '0');
        document.getElementById("seconds").innerText = seconds.toString().padStart(2, '0');
    };

    update();
    setInterval(update, 1000);
}

function initBubbles() {
    const container = document.getElementById('bubbles-container');
    const bubbleCount = 15;

    for (let i = 0; i < bubbleCount; i++) {
        createBubble(container);
    }
}

function createBubble(container) {
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    const size = Math.random() * 60 + 20;
    const left = Math.random() * 100;
    const duration = Math.random() * 10 + 10;
    const delay = Math.random() * 10;

    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${left}%`;
    bubble.style.setProperty('--duration', `${duration}s`);
    bubble.style.animationDelay = `${delay}s`;

    container.appendChild(bubble);

    // Re-create bubble after it finishes its animation
    bubble.addEventListener('animationiteration', () => {
        bubble.style.left = `${Math.random() * 100}%`;
    });
}

async function loadPlayers() {
    const playersContainer = document.querySelector('.players-tab-content');
    if (!playersContainer) return;

    try {
        const response = await fetch('stats');
        if (!response.ok) throw new Error('Failed to fetch stats');
        
        const text = await response.text();
        const lines = text.trim().split('\n');
        const players = [];
        allPlayersData = {}; // Reset global data

        // Skip header line
        for (let i = 1; i < lines.length; i++) {
            const [username, uuid, won, played] = lines[i].split('\t');
            if (username && uuid) {
                const playerData = { username, uuid, won: Number(won), played: Number(played) };
                players.push(playerData);
                allPlayersData[username.toLowerCase()] = playerData;
            }
        }

        let html = '<div class="players-grid">';
        players.forEach(player => {
            html += `
                <div class="player-card" onclick="showPlayerStats('${player.username}', '${player.uuid}', ${player.won}, ${player.played})">
                    <img src="https://mc-heads.net/avatar/${player.uuid}/100" alt="${player.username}" class="player-head">
                    <div class="player-name">${player.username}</div>
                </div>
            `;
        });
        html += '</div>';
        playersContainer.innerHTML = html;

    } catch (error) {
        console.error('Error loading players:', error);
        playersContainer.innerHTML = '<p style="text-align: center; color: #ff6b6b;">Failed to load player list.</p>';
    }
}

function showPlayerStats(username, uuid, won, played) {
    const modal = document.getElementById('player-modal');
    const modalContent = document.getElementById('modal-player-details');
    
    if (!modal || !modalContent) return;

    modalContent.innerHTML = `
        <img src="https://mc-heads.net/body/${uuid}/150" alt="${username}" class="modal-player-body">
        <h2>${username}</h2>
        <div class="stats-info">
            <div class="stat-item">
                <span class="stat-label">Events Won</span>
                <span class="stat-value">${won}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Events Played</span>
                <span class="stat-value">${played}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Win Rate</span>
                <span class="stat-value">${played > 0 ? Math.round((won / played) * 100) : 0}%</span>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('player-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('player-modal');
    if (event.target == modal) {
        closeModal();
    }
}

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('main section').forEach(section => {
        section.classList.add('hidden');
    });

    // Remove active class from all buttons
    document.querySelectorAll('.nav-links button').forEach(button => {
        button.classList.remove('active');
    });

    // Show selected section
    document.getElementById(sectionId).classList.remove('hidden');

    // Add active class to clicked button
    document.getElementById(`btn-${sectionId}`).classList.add('active');

    // Scroll to top
    window.scrollTo(0, 0);
}

// Initialize Twitch Embed
document.addEventListener('DOMContentLoaded', () => {
    // Start Live Scores Update immediately
    updateLiveScores();
    setInterval(updateLiveScores, 5000); // Update every 5 seconds

    // Start Countdown
    startCountdown();

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
        // Add a timeout to the fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const response = await fetch('/api/scores', {
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
            data.players.forEach(player => {
                // Prevent duplicates across all teams
                if (seenPlayers.has(player.username)) return;
                seenPlayers.add(player.username);

                const teamName = player.team.toLowerCase()
                    .replace(/team/g, '')
                    .replace(/_/g, '')
                    .trim();
                if (playersByTeam[teamName]) {
                    playersByTeam[teamName].push(player);
                }
            });
        }

        // 2. Map Team Scores
        const teamScores = {};
        if (data.teams && Array.isArray(data.teams)) {
            data.teams.forEach(team => {
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
                    html += `<div class="player-slot"><span>${player.username}</span> <span class="player-score">${Number(player.score).toLocaleString()}</span></div>`;
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

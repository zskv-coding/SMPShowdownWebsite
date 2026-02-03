console.log('SMP Showdown Script Loaded');

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
    setInterval(updateLiveScores, 30000); // Update every 30 seconds

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
        console.log('Fetching scores...');
        
        // Add a timeout to the fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const response = await fetch('https://apismpshowdown.vercel.app/api/scores', {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            console.error('API Response not OK:', response.status);
            throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Scores data received:', data);

        // Clear everything before rendering new data
        teams.forEach(t => {
            const container = document.getElementById(`players-${t}`);
            if (container) container.innerHTML = '';
            const scoreElement = document.getElementById(`score-${t}`);
            if (scoreElement) scoreElement.innerText = '0';
        });

        // 1. Update Team Scores
        if (data.teams && Array.isArray(data.teams)) {
            data.teams.forEach(team => {
                const name = team.team.toLowerCase()
                    .replace(/team/g, '')
                    .replace(/_/g, '')
                    .trim();
                const scoreElement = document.getElementById(`score-${name}`);
                if (scoreElement) scoreElement.innerText = Number(team.score).toLocaleString();
            });
        }

        // 2. Process Players
        if (data.players && Array.isArray(data.players)) {
            data.players.forEach(player => {
                const teamName = player.team.toLowerCase()
                    .replace(/team/g, '')
                    .replace(/_/g, '')
                    .trim();
                const container = document.getElementById(`players-${teamName}`);
                if (container) {
                    const slot = document.createElement('div');
                    slot.className = 'player-slot';
                    slot.innerHTML = `<span>${player.username}</span> <span class="player-score">${Number(player.score).toLocaleString()}</span>`;
                    container.appendChild(slot);
                }
            });
        }
        
        console.log('Scores update complete');
        
        // 3. Fill empty or partial teams with TBD slots
        teams.forEach(t => {
            const container = document.getElementById(`players-${t}`);
            if (container) {
                const currentCount = container.children.length;
                if (currentCount < 5) {
                    for (let i = currentCount; i < 5; i++) {
                        const slot = document.createElement('div');
                        slot.className = 'player-slot tbd';
                        slot.innerText = 'TBD';
                        container.appendChild(slot);
                    }
                }
            }
        });

    } catch (error) {
        console.error('Score Update Failed:', error);
        clearLoading(); // Ensure Loading... is removed on error
        
        // Fill all empty containers with TBD on failure
        teams.forEach(t => {
            const container = document.getElementById(`players-${t}`);
            if (container && container.innerHTML === '') {
                for (let i = 0; i < 5; i++) {
                    const slot = document.createElement('div');
                    slot.className = 'player-slot tbd';
                    slot.innerText = 'TBD';
                    container.appendChild(slot);
                }
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

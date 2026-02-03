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
    new Twitch.Embed("twitch-embed", {
        width: "100%",
        height: "100%",
        channel: "smpshowdown",
        parent: [window.location.hostname, "localhost"]
    });

    // Start Countdown
    startCountdown();

    // Start Live Scores Update
    updateLiveScores();
    setInterval(updateLiveScores, 30000); // Update every 30 seconds
});

async function updateLiveScores() {
    const teams = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'];
    
    try {
        const response = await fetch('https://apismpshowdown.vercel.app/api/scores');
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();

        // 1. Update Team Scores
        if (data.teams && Array.isArray(data.teams)) {
            data.teams.forEach(team => {
                // Robust name matching: "Red Team", "Red", "team_red" all become "red"
                const name = team.team.toLowerCase().replace('team', '').replace('_', '').trim();
                const scoreElement = document.getElementById(`score-${name}`);
                if (scoreElement) scoreElement.innerText = Number(team.score).toLocaleString();
            });
        }

        // 2. Process Players
        // Clear all containers first to remove "Loading..."
        teams.forEach(t => {
            const container = document.getElementById(`players-${t}`);
            if (container) container.innerHTML = '';
        });

        if (data.players && Array.isArray(data.players)) {
            data.players.forEach(player => {
                const teamName = player.team.toLowerCase().replace('team', '').replace('_', '').trim();
                const container = document.getElementById(`players-${teamName}`);
                if (container) {
                    const slot = document.createElement('div');
                    slot.className = 'player-slot';
                    slot.innerHTML = `<span>${player.username}</span> <span class="player-score">${Number(player.score).toLocaleString()}</span>`;
                    container.appendChild(slot);
                }
            });
        }
        
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
        // Fallback: Clear loading and show TBD
        teams.forEach(t => {
            const container = document.getElementById(`players-${t}`);
            if (container && container.innerHTML.includes('Loading...')) {
                container.innerHTML = '';
                for (let i = 0; i < 5; i++) {
                    container.innerHTML += '<div class="player-slot tbd">TBD</div>';
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

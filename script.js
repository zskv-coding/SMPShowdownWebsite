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
    try {
        // REPLACE THIS URL with your deployed Vercel URL later
        const response = await fetch('https://your-vercel-app.vercel.app/api/scores');
        const data = await response.json();

        if (data.teams) {
            data.teams.forEach(team => {
                const scoreElement = document.getElementById(`score-${team.team.toLowerCase()}`);
                if (scoreElement) scoreElement.innerText = team.score.toLocaleString();
            });
        }

        if (data.players) {
            // Clear existing slots first
            const teams = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'];
            teams.forEach(t => {
                const container = document.getElementById(`players-${t}`);
                if (container) container.innerHTML = '';
            });

            data.players.forEach(player => {
                const container = document.getElementById(`players-${player.team.toLowerCase()}`);
                if (container) {
                    const slot = document.createElement('div');
                    slot.className = 'player-slot';
                    slot.innerHTML = `<span>${player.username}</span> <span class="player-score">${player.score.toLocaleString()}</span>`;
                    container.appendChild(slot);
                }
            });
            
            // Fill empty slots with "TBD" if less than 5
            teams.forEach(t => {
                const container = document.getElementById(`players-${t}`);
                if (container && container.children.length < 5) {
                    for (let i = container.children.length; i < 5; i++) {
                        const slot = document.createElement('div');
                        slot.className = 'player-slot tbd';
                        slot.innerText = 'TBD';
                        container.appendChild(slot);
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error fetching scores:', error);
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

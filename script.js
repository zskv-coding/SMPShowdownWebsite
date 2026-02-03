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
        // REPLACE THIS URL with your actual Vercel URL
        const response = await fetch('https://apismpshowdown.vercel.app/api/scores');
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();

        if (data.teams) {
            data.teams.forEach(team => {
                // Remove " Team" if it exists in the name for matching IDs
                const teamId = team.team.toLowerCase().replace(' team', '').trim();
                const scoreElement = document.getElementById(`score-${teamId}`);
                if (scoreElement) scoreElement.innerText = team.score.toLocaleString();
            });
        }

        if (data.players) {
            const teams = ['red', 'orange', 'yellow', 'green', 'aqua', 'blue', 'purple', 'pink'];
            
            // Clear existing slots
            teams.forEach(t => {
                const container = document.getElementById(`players-${t}`);
                if (container) container.innerHTML = '';
            });

            data.players.forEach(player => {
                const teamId = player.team.toLowerCase().replace(' team', '').trim();
                const container = document.getElementById(`players-${teamId}`);
                if (container) {
                    const slot = document.createElement('div');
                    slot.className = 'player-slot';
                    slot.innerHTML = `<span>${player.username}</span> <span class="player-score">${player.score.toLocaleString()}</span>`;
                    container.appendChild(slot);
                }
            });
            
            // Fill empty slots with "TBD"
            teams.forEach(t => {
                const container = document.getElementById(`players-${t}`);
                if (container && container.children.length === 0) {
                    for (let i = 0; i < 5; i++) {
                        const slot = document.createElement('div');
                        slot.className = 'player-slot tbd';
                        slot.innerText = 'TBD';
                        container.appendChild(slot);
                    }
                } else if (container && container.children.length < 5) {
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
        // If it fails, show TBD instead of stuck loading
        const containers = document.querySelectorAll('.player-slots');
        containers.forEach(c => {
            if (c.innerHTML.includes('Loading...')) {
                c.innerHTML = '<div class="player-slot tbd">Offline</div>';
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

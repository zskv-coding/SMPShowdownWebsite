// Global state to store player stats for cross-tab linking
let allPlayersData = {};

function showSection(sectionId) {
    const transition = document.getElementById('tab-transition');
    const bg = transition?.querySelector('.transition-bg');
    if (!transition || !bg) {
        performSectionSwitch(sectionId);
        return;
    }

    // 1. Prepare: Hide display and move to start position instantly
    transition.style.display = 'flex';
    bg.style.transition = 'none';
    transition.classList.remove('active', 'wipe-out');
    void transition.offsetWidth; // Force layout
    
    // 2. Wipe In
    bg.style.transition = 'transform 0.8s cubic-bezier(0.77, 0, 0.175, 1)';
    transition.classList.add('active');

    setTimeout(() => {
        // Change section when screen is covered
        performSectionSwitch(sectionId);
        
        setTimeout(() => {
            // 3. Wipe Out
            transition.classList.add('wipe-out');
            
            // 4. Cleanup: Hide the whole container after it moves off screen
            setTimeout(() => {
                transition.style.display = 'none';
                transition.classList.remove('active', 'wipe-out');
            }, 800);
        }, 600);
    }, 800);
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

        // 3. Sort and Reorder Teams
        const teamData = teams.map((t, index) => ({
            id: t,
            score: teamScores[t] || 0,
            originalIndex: index
        }));

        // Sort: Score Descending, then Original Index Ascending
        teamData.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.originalIndex - b.originalIndex;
        });

        const teamsContainer = document.querySelector('.teams-container');
        if (teamsContainer) {
            teamData.forEach(team => {
                const teamElement = document.getElementById(`team-${team.id}`);
                if (teamElement) {
                    teamsContainer.appendChild(teamElement);
                }
            });
        }

        // 4. Update DOM content (scores and players)
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
                            <div class="player-slot clickable" onclick="showPlayerStats('${p.username}', '${p.uuid}', ${p.won}, ${p.played}, '${p.event1}')">
                                <div class="player-slot-info">
                                    <img src="https://mc-heads.net/avatar/${p.uuid}/24" alt="" class="slot-head">
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
            const [username, uuid, won, played, event1] = lines[i].split('\t');
            if (username && uuid) {
                const playerData = { username, uuid, won: Number(won), played: Number(played), event1: event1 || '0' };
                players.push(playerData);
                allPlayersData[username.toLowerCase()] = playerData;
            }
        }

        let html = '<div class="players-grid">';
        players.forEach(player => {
            html += `
                <div class="player-card" onclick="showPlayerStats('${player.username}', '${player.uuid}', ${player.won}, ${player.played}, '${player.event1}')">
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

function showPlayerStats(username, uuid, won, played, event1) {
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
            <div class="stat-item">
                <span class="stat-label">Last Event Score</span>
                <span class="stat-value">${Number(event1).toLocaleString()}</span>
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

/* Applications Logic */
const APP_DATA = {
    'Playtester': {
        title: 'SMP Showdown | Playtester Application',
        description: 'Apply to be a playtester for SMP Showdown!',
        sections: [
            {
                title: 'General Information',
                fields: [
                    { label: 'Preferred name?', name: 'preferred_name', type: 'text', required: true },
                    { label: 'Discord name?', name: 'discord', type: 'text', required: true },
                    { label: 'Minecraft username?', name: 'username', type: 'text', required: true }
                ]
            },
            {
                title: 'Agreements',
                fields: [
                    { label: 'Do you promise not to record the playtesting session unless instructed by the Head of Playtesting?', name: 'promise_no_record', type: 'select', options: ['Yes', 'No'], required: true },
                    { label: 'Do you promise that you will not release, stream, or otherwise make your footage of the SMP Showdown Playtesting Sessions public in any way?', name: 'promise_no_leak', type: 'select', options: ['Yes', 'No'], required: true },
                    { label: 'Do you understand that we will REVOKE your playtester role if you violate playtester policy?', name: 'understand_revoke', type: 'select', options: ['Yes', 'No'], required: true }
                ]
            },
            {
                title: 'Availability & Final Acknowledgement',
                fields: [
                    { label: 'What time & days are you typically free?', name: 'availability', type: 'textarea', required: true },
                    { label: 'By typing "I understand" you acknowledge that SMP Showdown has all rights to remove you as a playtester and ban you from anything SMP Showdown related if you break any of the playtesting rules or leak anything.', type: 'info' },
                    { label: 'If you agree. Please type "I understand."', name: 'agreement_text', type: 'text', required: true, validation: 'I understand' }
                ]
            }
        ]
    },
    'Builder': {
        title: 'SMP Showdown | Builder Application',
        description: 'Welcome to the SMP Showdown Builder Applications! By filling out this application, you understand that you may not be accepted as a staff member.',
        sections: [
            {
                title: 'Section 1 of 3',
                fields: [
                    { label: 'Discord Username', name: 'discord', type: 'text', required: true },
                    { label: 'Minecraft Username', name: 'username', type: 'text', required: true }
                ]
            },
            {
                title: 'Section 2 of 3: Builder Questions',
                fields: [
                    { label: 'Why do you have an interest in building for SMP Showdown?', name: 'interest', type: 'textarea', required: true },
                    { label: 'How would you describe your building style/skill?', name: 'style', type: 'textarea', required: true },
                    { label: 'Do you have any examples of your builds?', name: 'has_examples', type: 'text', required: true },
                    { label: 'Please submit your builds below (if you have examples)', name: 'portfolio_file', type: 'file', required: false }
                ]
            },
            {
                title: 'Section 3 of 3: General Questions',
                fields: [
                    { label: 'Have you ever worked with someone ON the current staff team?', name: 'staff_connection', type: 'text', required: true },
                    { label: 'By checking this box, you understand SMP Showdown has full right to remove you from the staff team at ANY time.', name: 'understand_removal', type: 'checkbox', required: true }
                ]
            }
        ]
    },
    'Coding': {
        title: 'SMP Showdown | Coder Applications',
        description: 'Are you looking to code for a MC Event? Then you\'ve come to the right spot! Apply for SMP Showdown coder below!',
        sections: [
            {
                title: 'Section 1 of 2',
                fields: [
                    { label: 'MC Name:', name: 'username', type: 'text', required: true },
                    { label: 'Discord Name:', name: 'discord', type: 'text', required: true }
                ]
            },
            {
                title: 'Section 2 of 2: Questions',
                fields: [
                    { label: 'How much experience do you have in coding MC Plugins, Datapacks, and more?', name: 'experience', type: 'textarea', required: true },
                    { label: 'What are some things that you have coded?', name: 'portfolio', type: 'textarea', required: true },
                    { label: 'Submit your code samples (ZIP/Files)', name: 'code_samples', type: 'file', required: false },
                    { label: 'Are you fine with working alone on a Plugin Project?', name: 'work_alone', type: 'select', options: ['Yes', 'No'], required: true },
                    { label: 'Do you understand that you can be removed from the staff team at any moment?', name: 'understand_removal', type: 'select', options: ['Yes', 'No'], required: true },
                    { label: 'Other:', name: 'other_info', type: 'textarea', required: false }
                ]
            }
        ]
    },
    'Sound/Music Designer': {
        title: 'SMP Showdown | Music Artist Applications',
        description: 'If you are filling out this application, you are interested in becoming a Music artist for SMP Showdown.',
        sections: [
            {
                title: 'Section 1 of 3',
                fields: [
                    { label: 'Discord Username', name: 'discord', type: 'text', required: true },
                    { label: 'Minecraft Username', name: 'username', type: 'text', required: true }
                ]
            },
            {
                title: 'Section 2 of 3: Experience',
                fields: [
                    { label: 'Please attach some examples of your work below:', name: 'portfolio_file', type: 'file', required: true },
                    { label: 'Are you wanting to-do Sound Effects, Music, or both?', name: 'role_type', type: 'text', required: true }
                ]
            },
            {
                title: 'Section 3 of 3: Acknowledgement',
                fields: [
                    { label: 'Do you understand that you can be removed from the Sound design team at any moment?', name: 'understand_removal', type: 'select', options: ['Yes', 'No'], required: true }
                ]
            }
        ]
    }
};

let currentStep = 0;
let currentAppData = null;
let formAnswers = {};

function openAppForm(type) {
    const modal = document.getElementById('app-modal');
    currentAppData = APP_DATA[type];
    if (!modal || !currentAppData) return;

    currentStep = 0;
    formAnswers = {}; // Clear previous answers
    document.getElementById('app-type-input').value = type;
    document.getElementById('app-type-title').innerText = currentAppData.title;
    document.getElementById('app-description').innerText = currentAppData.description;
    document.getElementById('form-status').classList.add('hidden');
    document.getElementById('application-form').reset();
    
    renderStep();
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
}

function renderStep() {
    const container = document.getElementById('dynamic-questions');
    const section = currentAppData.sections[currentStep];
    
    let html = `<div class="form-section-header">`;
    html += `<h3 class="section-title">${section.title}</h3>`;
    html += `</div>`;
    
    section.fields.forEach(f => {
        const savedValue = formAnswers[f.name] || '';
        html += `<div class="form-question-card">`;
        if (f.type === 'info') {
            html += `<p class="info-text">${f.label}</p>`;
        } else {
            html += `<label class="question-label">${f.label}${f.required ? ' <span class="required-asterisk">*</span>' : ''}</label>`;
            if (f.type === 'textarea') {
                html += `<textarea name="${f.name}" required="${f.required}" rows="3" placeholder="Your answer">${savedValue}</textarea>`;
            } else if (f.type === 'select') {
                html += `<select name="${f.name}" required="${f.required}">
                    <option value="" disabled ${!savedValue ? 'selected' : ''}>Choose</option>
                    ${f.options.map(o => `<option value="${o}" ${savedValue === o ? 'selected' : ''}>${o}</option>`).join('')}
                </select>`;
            } else if (f.type === 'checkbox') {
                const checked = formAnswers[f.name] === 'on' ? 'checked' : '';
                html += `<div class="checkbox-container">
                    <input type="checkbox" name="${f.name}" required="${f.required}" class="checkbox-input" id="check-${f.name}" ${checked}>
                    <label for="check-${f.name}" class="checkbox-label">I agree/understand</label>
                </div>`;
            } else if (f.type === 'file') {
                html += `<input type="file" name="${f.name}" required="${f.required}" class="file-input" onchange="handleFileChange(this)">
                         <div id="feedback-${f.name}" class="file-feedback"></div>`;
            } else {
                html += `<input type="${f.type}" name="${f.name}" required="${f.required}" ${f.validation ? `data-validation="${f.validation}"` : ''} placeholder="Your answer" value="${savedValue}">`;
            }
        }
        html += `</div>`;
    });

    html += `<div class="form-nav">`;
    if (currentStep > 0) {
        html += `<button type="button" class="nav-btn prev" onclick="changeStep(-1)">Back</button>`;
    }
    if (currentStep < currentAppData.sections.length - 1) {
        html += `<button type="button" class="nav-btn next" onclick="changeStep(1)">Next</button>`;
    } else {
        html += `<button type="submit" class="submit-btn">Submit Application</button>`;
    }
    html += `</div>`;

    container.innerHTML = html;
}

function handleFileChange(input) {
    const feedback = document.getElementById(`feedback-${input.name}`);
    if (!feedback) return;

    if (input.files && input.files[0]) {
        const file = input.files[0];
        const sizeMB = file.size / (1024 * 1024);
        
        feedback.style.display = 'block';
        feedback.classList.remove('error');
        
        if (sizeMB > 25) {
            feedback.innerText = `⚠️ File too large (${sizeMB.toFixed(1)}MB). Max 25MB for Discord.`;
            feedback.classList.add('error');
            input.value = ''; // Reset
        } else {
            feedback.innerText = `✅ Selected: ${file.name} (${sizeMB.toFixed(1)}MB)`;
        }
    } else {
        feedback.style.display = 'none';
    }
}

function saveCurrentAnswers() {
    const container = document.getElementById('dynamic-questions');
    const inputs = container.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
        if (input.type === 'file') return;
        if (input.type === 'checkbox') {
            formAnswers[input.name] = input.checked ? 'on' : '';
        } else {
            formAnswers[input.name] = input.value;
        }
    });
}

function changeStep(delta) {
    if (delta > 0) {
        const currentFields = document.getElementById('dynamic-questions').querySelectorAll('[required]');
        for (let field of currentFields) {
            if (!field.checkValidity()) {
                field.reportValidity();
                return;
            }
            if (field.dataset.validation && field.value !== field.dataset.validation) {
                alert(`Please type "${field.dataset.validation}" exactly.`);
                return;
            }
        }
    }
    
    saveCurrentAnswers();
    currentStep += delta;
    renderStep();
}

function closeAppModal() {
    const modal = document.getElementById('app-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
    }
}

// Form Submission
document.getElementById('application-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    saveCurrentAnswers();
    
    const form = e.target;
    const status = document.getElementById('form-status');
    const submitBtn = form.querySelector('.submit-btn');
    
    const validationFields = form.querySelectorAll('[data-validation]');
    for (let field of validationFields) {
        if (field.value !== field.dataset.validation) {
            alert(`Please type "${field.dataset.validation}" exactly.`);
            return;
        }
    }

    const formData = new FormData(form);
    // Add previously saved answers that might not be on current page
    Object.keys(formAnswers).forEach(key => {
        if (!formData.has(key)) {
            formData.append(key, formAnswers[key]);
        }
    });
    
    submitBtn.disabled = true;
    submitBtn.innerText = 'Submitting...';
    status.innerText = 'Sending application...';
    status.className = 'form-status-msg';
    status.classList.remove('hidden');

    try {
        // Use full URL to avoid potential relative path issues on some hosting setups
        const response = await fetch('/api/applications', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            status.innerText = 'Application submitted successfully!';
            status.classList.add('success');
            setTimeout(closeAppModal, 2000);
        } else {
            throw new Error(result.message || result.error || 'Failed to submit application');
        }
    } catch (err) {
        console.error('Submission Error:', err);
        status.innerText = 'Error: ' + err.message;
        status.classList.add('error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = currentStep < currentAppData.sections.length - 1 ? 'Next' : 'Submit Application';
    }
});


// Close modal when clicking outside
window.onclick = function(event) {
    const playerModal = document.getElementById('player-modal');
    const appModal = document.getElementById('app-modal');
    if (event.target == playerModal) {
        closeModal();
    }
    if (event.target == appModal) {
        closeAppModal();
    }
}



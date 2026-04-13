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

let twitchPlayer = null;

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
    const selectedSection = document.getElementById(sectionId);
    if (selectedSection) {
        selectedSection.classList.remove('hidden');
    }

    // Initialize Twitch Player when the section is shown
    if (sectionId === 'live' && !twitchPlayer) {
        try {
            if (typeof Twitch !== 'undefined') {
                twitchPlayer = new Twitch.Player("twitch-embed", {
                    width: "100%",
                    height: "100%",
                    channel: "smpshowdown",
                    parent: [window.location.hostname, "localhost"]
                });
            } else {
                console.warn('Twitch Player Script not loaded yet.');
            }
        } catch (e) {
            console.error('Twitch Player failed to load:', e);
        }
    }

    // Add active class to clicked button
    const btn = document.getElementById(`btn-${sectionId}`);
    if (btn) btn.classList.add('active');

    // Scroll to top
    window.scrollTo(0, 0);

    // Update URL if switching to/from /vote
    if (sectionId === 'voting') {
        window.history.pushState({}, '', '/vote');
    } else if (sectionId === 'live-submissions') {
        window.history.pushState({}, '', '/live-submissions');
    } else if (sectionId === 'admin-live-link-submissions') {
        window.history.pushState({}, '', '/admin-live-link-submissions');
    } else if (['/vote', '/live-submissions', '/admin-live-link-submissions'].includes(window.location.pathname)) {
        window.history.pushState({}, '', '/');
    }
}

// Initialize Everything
document.addEventListener('DOMContentLoaded', async () => {
    // Check URL to show correct section
    const path = window.location.pathname;
    
    // Initial data load
    await loadPlayers();
    populatePlayerDropdown();

    if (path === '/live-submissions') {
        performSectionSwitch('live-submissions');
    } else if (path === '/admin-live-link-submissions') {
        performSectionSwitch('admin-live-link-submissions');
        checkAdminSession();
    }
    
    // Check voting status before showing section
    try {
        const response = await fetch('https://apismpshowdown.vercel.app/api/votes');
        const data = await response.json();
        votingActive = data.votingActive;
        
        const voteBtn = document.getElementById('btn-voting');
        if (voteBtn) voteBtn.style.display = votingActive ? 'block' : 'none';

        if ((path === '/vote' || path === '/vote.html')) {
            if (votingActive) {
                performSectionSwitch('voting');
            } else {
                performSectionSwitch('home');
                showToast("Viewer vote isn't active!");
            }
        } else {
            updateLiveScores();
        }
    } catch (e) {
        console.error("Failed to check initial voting status", e);
        if (!(path === '/vote' || path === '/vote.html')) {
            updateLiveScores();
        }
    }
    
    // Start Updates
    updateVotes();
    setInterval(updateVotes, 5000); 
    setInterval(updateLiveScores, 5000); 
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

function initBees() {
}

function createBee(container) {
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
    },
    'Photography': {
        title: 'SMP Showdown | Photography Application',
        description: 'We are looking for people who can take great in-game photos of our events and builds.',
        sections: [
            {
                title: 'The Basics',
                fields: [
                    { label: 'What is your preferred name?', name: 'preferred_name', type: 'text', required: true },
                    { label: 'What is your Discord username?', name: 'discord', type: 'text', required: true },
                    { label: 'What is your Minecraft username?', name: 'username', type: 'text', required: true }
                ]
            },
            {
                title: 'Your Work',
                fields: [
                    { label: 'Do you have a portfolio or some examples of your work?', name: 'portfolio', type: 'textarea', required: true },
                    { label: 'You can also upload some of your favorite shots here:', name: 'portfolio_file', type: 'file', required: false },
                    { label: 'What kind of photography do you usually do, such as shaders or cinematics?', name: 'style', type: 'textarea', required: true }
                ]
            },
            {
                title: 'Final Details',
                fields: [
                    { label: 'Do you understand that you can be removed from the team at any time?', name: 'understand_removal', type: 'select', options: ['Yes', 'No'], required: true },
                    { label: 'Is there anything else you would like to tell us?', name: 'other_info', type: 'textarea', required: false }
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
                const hasFile = formAnswers[f.name] instanceof File;
                const isRequired = f.required && !hasFile;
                html += `<input type="file" name="${f.name}" ${isRequired ? 'required="true"' : ''} class="file-input" onchange="handleFileChange(this)">
                         <div id="feedback-${f.name}" class="file-feedback" style="display: ${hasFile ? 'block' : 'none'}">
                            ${hasFile ? `✅ Selected: ${formAnswers[f.name].name} (${(formAnswers[f.name].size / (1024 * 1024)).toFixed(1)}MB)` : ''}
                         </div>`;
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


const VERCEL_BACKEND_URL = 'https://smp-showdown-website.vercel.app'; 
const DRIVE_UPLOAD_URL = 'https://script.google.com/macros/s/AKfycbxj_dEaGur0jqJCOQYCjuAXkkjZwrpsoH8obgZXLquLRq5Y6GAKAjWr-g_R8aHVfgil/exec'; 
const DRIVE_FOLDER_URL = 'https://drive.google.com/drive/u/0/folders/1dOIpLc5bBj9cjTUpeNDHrlVWIZS6NrQV';

async function handleFileChange(input) {
    const feedback = document.getElementById(`feedback-${input.name}`);
    if (!feedback) return;

    if (input.files && input.files[0]) {
        const file = input.files[0];
        const sizeMB = file.size / (1024 * 1024);
        
        feedback.style.display = 'block';
        feedback.classList.remove('error');
        feedback.innerText = `⏳ Uploading to Drive...`;

        // Get username for file naming
        const username = formAnswers['username'] || formAnswers['mc_name'] || 'Unknown';

        // GOOGLE DRIVE UPLOAD LOGIC
        try {
            const reader = new FileReader();
            reader.onload = async function(e) {
                const base64Content = e.target.result.split(',')[1];
                
                try {
                    await fetch(DRIVE_UPLOAD_URL, {
                        method: 'POST',
                        mode: 'no-cors', 
                        headers: {
                            'Content-Type': 'text/plain'
                        },
                        body: JSON.stringify({
                            filename: file.name,
                            mimeType: file.type,
                            base64: base64Content,
                            username: username
                        })
                    });

                    feedback.innerText = `✅ Sent to Google Drive!`;
                    formAnswers[input.name] = `(UPLOADED TO DRIVE) File: ${file.name}`;
                    formAnswers['drive_folder_url'] = DRIVE_FOLDER_URL;
                } catch (fetchErr) {
                    console.error('Fetch Error:', fetchErr);
                    feedback.innerText = `❌ Error: ${fetchErr.message}`;
                    feedback.classList.add('error');
                }
            };
            reader.readAsDataURL(file);

        } catch (err) {
            console.error('Drive Upload Error:', err);
            feedback.innerText = `❌ Drive Upload Failed: ${err.message}`;
            feedback.classList.add('error');
        }

    } else {
        feedback.style.display = 'none';
        delete formAnswers[input.name];
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
    
    // Add all saved answers (including files from previous steps)
    Object.keys(formAnswers).forEach(key => {
        const value = formAnswers[key];
        if (!formData.has(key) || (value instanceof File)) {
            if (value instanceof File) {
                formData.delete(key);
                formData.append(key, value);
            } else {
                formData.append(key, value);
            }
        }
    });

    // Capture field labels and section structure for better Discord formatting
    const structure = [];
    currentAppData.sections.forEach(sec => {
        const fields = sec.fields
            .filter(f => f.name && f.type !== 'info')
            .map(f => ({ name: f.name, label: f.label }));
        structure.push({ title: sec.title, fields });
    });
    formData.append('form_structure', JSON.stringify(structure));
    
    submitBtn.disabled = true;
    submitBtn.innerText = 'Submitting...';
    status.innerText = 'Sending application...';
    status.className = 'form-status-msg';
    status.classList.remove('hidden', 'success', 'error');

    try {
        const apiPath = VERCEL_BACKEND_URL 
            ? `${VERCEL_BACKEND_URL.replace(/\/$/, '')}/api/applications`
            : 'api/applications';

        console.log('Submitting to:', apiPath);

        const response = await fetch(apiPath, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        });

        const contentType = response.headers.get("content-type");
        let result;
        
        if (contentType && contentType.includes("application/json")) {
            result = await response.json();
        } else {
            const text = await response.text();
            console.error("Server returned non-JSON:", text);
            throw new Error(`Server Error: Expected JSON but got ${contentType || 'unknown'}. Please ensure DISCORD_WEBHOOK_URL is set in Vercel environment variables.`);
        }

        if (response.ok) {
            status.innerText = '✅ Application submitted successfully!';
            status.classList.add('success');
            setTimeout(closeAppModal, 2000);
        } else {
            throw new Error(result.message || result.error || 'Failed to submit application');
        }
    } catch (err) {
        console.error('Submission Error:', err);
        status.innerText = '❌ Error: ' + err.message;
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

/* Voting Logic */
let votingActive = true; // Default to true until we check API

async function castVote(gameName) {
    if (!votingActive) {
        showToast("Viewer vote isn't active!");
        return;
    }

    // Check if user has already voted
    const lastVote = localStorage.getItem('last_vote');
    if (lastVote) {
        alert("You have already cast your vote!");
        return;
    }

    // Confirm vote
    if (!confirm(`Are you sure you want to vote for ${gameName}? You cannot change your vote later!`)) {
        return;
    }

    try {
        const response = await fetch('https://apismpshowdown.vercel.app/api/votes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game: gameName })
        });

        if (!response.ok) throw new Error('Vote failed');

        localStorage.setItem('last_vote', gameName);
        
        // Use current session ID if available, else let updateVotes handle it
        const currentData = await (await fetch('https://apismpshowdown.vercel.app/api/votes')).json();
        if (currentData.sessionId) {
            localStorage.setItem('vote_session', String(currentData.sessionId));
        }
        
        await updateVotes();
    } catch (error) {
        console.error('Error casting vote:', error);
        alert('Failed to cast vote. Please try again later.');
    }
}

function updateVoteUI(selectedGame) {
    const buttons = document.querySelectorAll('.vote-btn');
    const hasVoted = !!selectedGame;
    
    buttons.forEach(btn => {
        const isThisGame = btn.innerText.trim() === selectedGame;
        if (isThisGame) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
        
        // Lock buttons if user has voted, unlock otherwise
        if (hasVoted) {
            btn.disabled = true;
            btn.style.opacity = isThisGame ? '1' : '0.5';
            btn.style.cursor = 'not-allowed';
            btn.style.transform = 'none';
        } else {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.style.transform = ''; // Reset transform
        }
    });
}

function showToast(message) {
    let toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

async function updateVotes() {
    const votesBody = document.getElementById('votes-body');
    if (!votesBody) return;

    try {
        const response = await fetch('https://apismpshowdown.vercel.app/api/votes', {
            cache: 'no-store'
        });
        if (!response.ok) throw new Error('Failed to fetch votes');

        const data = await response.json();
        
        // Handle Voting Visibility
        votingActive = data.votingActive;
        const voteBtn = document.getElementById('btn-voting');
        if (voteBtn) {
            voteBtn.style.display = votingActive ? 'block' : 'none';
        }

        // Redirect if on /vote and not active
        const isVotingPath = window.location.pathname === '/vote' || window.location.pathname === '/vote.html';
        const isVotingSection = !document.getElementById('voting').classList.contains('hidden');
        
        if (!votingActive && (isVotingPath || isVotingSection)) {
            showSection('home');
            showToast("Viewer vote isn't active!");
        }

        const apiSession = data.sessionId;
        const localSession = localStorage.getItem('vote_session');
        const votes = data.games || [];
        const totalVotes = votes.reduce((sum, v) => sum + v.votes, 0);

        // GLOBAL RESET: If database is empty or total votes is 0, unlock for everyone
        if (!apiSession || totalVotes === 0) {
            if (localStorage.getItem('last_vote')) {
                console.log('Vote reset detected (Empty Database)');
                localStorage.removeItem('last_vote');
                localStorage.removeItem('vote_session');
            }
        } 
        // SESSION CHANGE: If a new voting round started, unlock
        else if (localSession && String(apiSession) !== localSession) {
            console.log('New voting round detected');
            localStorage.removeItem('last_vote');
            localStorage.setItem('vote_session', String(apiSession));
        }
        // INITIAL SYNC: If we haven't recorded the current session yet
        else if (!localSession && apiSession) {
            localStorage.setItem('vote_session', String(apiSession));
        }

        const maxVotes = Math.max(...votes.map(v => v.votes), 1);

        // Sort votes by count descending
        votes.sort((a, b) => b.votes - a.votes);

        let html = '';
        votes.forEach(v => {
            const percentage = (v.votes / maxVotes) * 100;
            html += `
                <tr>
                    <td>
                        <div>${v.game}</div>
                        <div class="vote-bar-container">
                            <div class="vote-bar" style="width: ${percentage}%"></div>
                        </div>
                    </td>
                    <td class="vote-count">${v.votes.toLocaleString()}</td>
                </tr>
            `;
        });

        if (votesBody.innerHTML !== html) {
            votesBody.innerHTML = html;
        }

        // Highlight selected game
        const lastVote = localStorage.getItem('last_vote');
        updateVoteUI(lastVote || null);
    } catch (error) {
        console.error('Error updating votes:', error);
    }
}

/* Live Submissions & Admin Logic */

function populatePlayerDropdown() {
    const dropdown = document.getElementById('player-dropdown');
    if (!dropdown) return;

    const players = Object.values(allPlayersData).sort((a, b) => a.username.localeCompare(b.username));
    
    if (players.length === 0) {
        dropdown.innerHTML = '<option value="">No players found</option>';
        return;
    }

    let html = '<option value="">-- Select Player --</option>';
    players.forEach(p => {
        html += `<option value="${p.username}">${p.username}</option>`;
    });
    dropdown.innerHTML = html;
}

function toggleOtherPlatform(radio) {
    const otherInput = document.getElementById('other-platform');
    if (otherInput) {
        otherInput.style.display = radio.value === 'other' ? 'block' : 'none';
        otherInput.required = radio.value === 'other';
    }
}

async function submitLiveForm(event) {
    event.preventDefault();
    const form = event.target;
    const status = document.getElementById('live-form-status');
    const submitBtn = form.querySelector('.submit-btn');

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    submitBtn.disabled = true;
    submitBtn.innerText = 'Submitting...';
    status.className = 'form-status-msg';
    status.innerText = 'Processing...';
    status.classList.remove('hidden', 'success', 'error');

    try {
        const apiPath = (typeof VERCEL_BACKEND_URL !== 'undefined' && VERCEL_BACKEND_URL)
            ? `${VERCEL_BACKEND_URL.replace(/\/$/, '')}/api/live-submissions`
            : '/api/live-submissions';

        const response = await fetch(apiPath, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            status.innerText = '✅ Submitted successfully! Redirecting...';
            status.classList.add('success');
            form.reset();
            setTimeout(() => {
                showSection('home');
            }, 2000);
        } else {
            const result = await response.json();
            throw new Error(result.error || 'Failed to submit');
        }
    } catch (error) {
        status.innerText = '❌ Error: ' + error.message;
        status.classList.add('error');
        submitBtn.disabled = false;
        submitBtn.innerText = 'Submit';
    }
}

function adminLogin(event) {
    event.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    const error = document.getElementById('login-error');

    if (email === 'zskvbusiness@gmail.com' && password === 'SMPShowdownAdminSection2024124') {
        const auth = btoa(`${email}:${password}`);
        localStorage.setItem('admin_auth', auth);
        error.style.display = 'none';
        checkAdminSession();
    } else {
        error.style.display = 'block';
    }
}

function logoutAdmin() {
    localStorage.removeItem('admin_auth');
    checkAdminSession();
}

function checkAdminSession() {
    const auth = localStorage.getItem('admin_auth');
    const loginContainer = document.getElementById('admin-login-container');
    const adminContent = document.getElementById('admin-content');

    if (auth) {
        loginContainer.classList.add('hidden');
        adminContent.classList.remove('hidden');
        loadSubmissions();
    } else {
        loginContainer.classList.remove('hidden');
        adminContent.classList.add('hidden');
    }
}

async function loadSubmissions() {
    const list = document.getElementById('submissions-list');
    const auth = localStorage.getItem('admin_auth');
    if (!list || !auth) return;

    list.innerHTML = '<p style="text-align: center; color: #aaa; margin: 20px;">Loading submissions...</p>';

    try {
        const apiPath = (typeof VERCEL_BACKEND_URL !== 'undefined' && VERCEL_BACKEND_URL)
            ? `${VERCEL_BACKEND_URL.replace(/\/$/, '')}/api/live-submissions`
            : '/api/live-submissions';

        const response = await fetch(apiPath, {
            headers: { 'Authorization': `Basic ${auth}` }
        });

        if (!response.ok) throw new Error('Unauthorized or fetch failed');

        const submissions = await response.json();
        
        if (submissions.length === 0) {
            list.innerHTML = '<p>No submissions found.</p>';
            return;
        }

        let html = '<table style="width:100%; border-collapse: collapse; margin-top: 10px;">';
        html += '<tr style="border-bottom: 2px solid #555;">';
        html += '<th style="text-align:left; padding: 10px;">User</th>';
        html += '<th style="text-align:left; padding: 10px;">Player</th>';
        html += '<th style="text-align:left; padding: 10px;">Platform</th>';
        html += '<th style="text-align:left; padding: 10px;">Link</th>';
        html += '<th style="text-align:left; padding: 10px;">Date</th>';
        html += '</tr>';

        submissions.forEach(s => {
            const d = s.data;
            const date = new Date(s.created_at || d.submitted_at).toLocaleString();
            html += `<tr style="border-bottom: 1px solid #333;">`;
            html += `<td style="padding: 10px;">${d.mc_username}</td>`;
            html += `<td style="padding: 10px;">${d.selected_player}</td>`;
            html += `<td style="padding: 10px;">${d.platform === 'other' ? d.other_platform : d.platform}</td>`;
            html += `<td style="padding: 10px;"><a href="${d.social_link}" target="_blank" style="color: #4facfe;">Link</a></td>`;
            html += `<td style="padding: 10px; font-size: 0.8rem; color: #aaa;">${date}</td>`;
            html += `</tr>`;
        });
        html += '</table>';
        list.innerHTML = html;
    } catch (error) {
        list.innerHTML = `<p style="color: #ff6b6b;">Error: ${error.message}</p>`;
    }
}




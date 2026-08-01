const SUPABASE_URL = 'https://TON_PROJET.supabase.co';
const SUPABASE_KEY = 'TA_CLE_PUBLIQUE';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;
let currentSearch = null; // Pour sauvegarder le trajet si l'utilisateur le demande

document.addEventListener('DOMContentLoaded', async () => {
    verifierSession();

    // Gestion de la modale de connexion
    document.getElementById('btn-user-profile').addEventListener('click', () => {
        if (!currentUser) document.getElementById('auth-modal').classList.remove('hidden');
    });
    document.getElementById('btn-close-modal').addEventListener('click', () => document.getElementById('auth-modal').classList.add('hidden'));
    
    // Auth Supabase
    document.getElementById('btn-login').addEventListener('click', () => gererAuth('login'));
    document.getElementById('btn-register').addEventListener('click', () => gererAuth('register'));
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.reload();
    });

    // Autocomplétion
    setupAutocomplete('depart', 'autocomplete-depart');
    setupAutocomplete('arrivee', 'autocomplete-arrivee');

    // Inverser
    document.getElementById('btn-swap').addEventListener('click', () => {
        const dep = document.getElementById('depart'), arr = document.getElementById('arrivee');
        [dep.value, arr.value] = [arr.value, dep.value];
    });

    // Rechercher
    document.getElementById('btn-recherche').addEventListener('click', () => {
        const dep = document.getElementById('depart').value;
        const arr = document.getElementById('arrivee').value;
        if (!dep || !arr) return;
        
        currentSearch = { depart: dep, arrivee: arr };
        document.getElementById('results-section').classList.remove('hidden');
        
        // Afficher le bouton de sauvegarde si l'utilisateur est connecté
        const btnSave = document.getElementById('btn-save-favori');
        if (currentUser) btnSave.classList.remove('hidden');
        
        chercherTrains(dep, arr);
    });

    // Sauvegarder uniquement au clic
    document.getElementById('btn-save-favori').addEventListener('click', sauvegarderFavoriActuel);
});

// --- AUTHENTIFICATION ---
async function verifierSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        document.getElementById('user-name').innerText = currentUser.email.split('@')[0];
        document.getElementById('btn-logout').classList.remove('hidden');
        chargerFavoris();
    }
}

async function gererAuth(action) {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    let result;
    if (action === 'login') {
        result = await supabase.auth.signInWithPassword({ email, password });
    } else {
        result = await supabase.auth.signUp({ email, password });
    }

    if (result.error) alert("Erreur : " + result.error.message);
    else window.location.reload();
}

// --- AUTOCOMPLÉTION (Correction des fautes) ---
function setupAutocomplete(inputId, listId) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);

    input.addEventListener('input', async (e) => {
        const val = e.target.value;
        if (val.length < 3) { list.classList.add('hidden'); return; }

        // Appel API suisse pour deviner la gare
        const res = await fetch(`https://transport.opendata.ch/v1/locations?query=${val}&type=station`);
        const data = await res.json();
        
        list.innerHTML = '';
        if (data.stations.length > 0) {
            list.classList.remove('hidden');
            data.stations.slice(0, 4).forEach(station => {
                if(station.name) {
                    const div = document.createElement('div');
                    div.className = 'autocomplete-item';
                    div.innerText = station.name;
                    div.onclick = () => {
                        input.value = station.name;
                        list.classList.add('hidden');
                    };
                    list.appendChild(div);
                }
            });
        }
    });
}

// --- MOTEUR DE RECHERCHE & CORRESPONDANCES ---
async function chercherTrains(depart, arrivee) {
    const container = document.getElementById('results-container');
    container.innerHTML = '<p>Analyse du réseau ferroviaire...</p>';

    try {
        const res = await fetch(`https://transport.opendata.ch/v1/connections?from=${depart}&to=${arrivee}&limit=4`);
        const data = await res.json();
        container.innerHTML = '';

        if (!data.connections || data.connections.length === 0) {
            container.innerHTML = '<p>Aucun trajet trouvé.</p>'; return;
        }

        data.connections.forEach(conn => {
            const depTime = new Date(conn.from.departure).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            const arrTime = new Date(conn.to.arrival).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            const duree = conn.duration.replace('00d', '').substring(1, 6).replace(':', 'h');
            
            // Générer le détail des correspondances (Timeline)
            let timelineHTML = '<div class="timeline">';
            conn.sections.forEach(section => {
                if (section.journey) { // Si c'est un vrai train et pas de la marche
                    const secDep = new Date(section.departure.departure).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
                    const trainType = section.journey.category || 'Train';
                    
                    timelineHTML += `
                        <div class="timeline-item">
                            <div class="station-name">${secDep} - ${section.departure.station.name}</div>
                            <div class="train-info">🚆 ${trainType} ${section.journey.number || ''}</div>
                        </div>
                    `;
                }
            });
            // Ajouter la gare d'arrivée finale dans la timeline
            timelineHTML += `
                <div class="timeline-item">
                    <div class="station-name">${arrTime} - ${conn.to.station.name}</div>
                </div>
            </div>`;

            container.innerHTML += `
                <div class="train-card">
                    <div class="card-main-info">
                        <div>
                            <div class="time">${depTime} ➔ ${arrTime}</div>
                            <div class="duration">${duree} • ${conn.transfers} correspondance(s)</div>
                        </div>
                    </div>
                    ${conn.transfers > 0 ? timelineHTML : '<p class="text-muted" style="margin-top:1rem;">Trajet direct</p>'}
                </div>
            `;
        });
    } catch (error) {
        container.innerHTML = '<p style="color: red;">Erreur de connexion au réseau.</p>';
    }
}

// --- BASE DE DONNÉES (Favoris) ---
async function sauvegarderFavoriActuel() {
    if (!currentUser || !currentSearch) return;

    const { error } = await supabase.from('trajets_favoris').insert([{ 
        gare_depart: currentSearch.depart, 
        gare_arrivee: currentSearch.arrivee, 
        user_id: currentUser.id 
    }]);

    if (!error) {
        document.getElementById('btn-save-favori').innerText = "✅ Sauvegardé";
        chargerFavoris();
    }
}

async function chargerFavoris() {
    if (!currentUser) return;

    const { data: trajets } = await supabase.from('trajets_favoris').select('*').eq('user_id', currentUser.id);
    const container = document.getElementById('favorites-container');
    
    if (!trajets || trajets.length === 0) {
        container.innerHTML = '<p class="text-muted">Aucun favori enregistré.</p>'; return;
    }

    container.innerHTML = '';
    trajets.forEach(trajet => {
        container.innerHTML += `
            <div class="train-card" style="cursor:pointer;" onclick="document.getElementById('depart').value='${trajet.gare_depart}'; document.getElementById('arrivee').value='${trajet.gare_arrivee}'; document.getElementById('btn-recherche').click();">
                <div class="station-name">${trajet.gare_depart} ➔ ${trajet.gare_arrivee}</div>
            </div>
        `;
    });
}

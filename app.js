const SUPABASE_URL = 'https://TON_PROJET.supabase.co';
const SUPABASE_KEY = 'TA_CLE_PUBLIQUE';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUser = null;
let currentSearch = null;

// Les grandes villes prioritaires
const GRANDES_VILLES = [
    { nom: "Paris (Toutes gares)", api: "Paris" },
    { nom: "Lyon (Toutes gares)", api: "Lyon" },
    { nom: "Montluçon", api: "Montluçon" },
    { nom: "Clermont-Ferrand", api: "Clermont-Ferrand" },
    { nom: "Marseille", api: "Marseille" },
    { nom: "Bordeaux", api: "Bordeaux" }
];

document.addEventListener('DOMContentLoaded', async () => {
    verifierSession();

    // Modale Auth
    document.getElementById('btn-user-profile').addEventListener('click', () => {
        if (!currentUser) document.getElementById('auth-modal').classList.remove('hidden');
    });
    document.getElementById('btn-close-modal').addEventListener('click', () => document.getElementById('auth-modal').classList.add('hidden'));
    
    // Auth & Gestion des erreurs
    document.getElementById('btn-login').addEventListener('click', () => gererAuth('login'));
    document.getElementById('btn-register').addEventListener('click', () => gererAuth('register'));
    document.getElementById('btn-logout').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.reload();
    });

    // Autocomplétion intelligente
    setupAutocomplete('depart', 'autocomplete-depart');
    setupAutocomplete('arrivee', 'autocomplete-arrivee');

    // Inverser Gares
    document.getElementById('btn-swap').addEventListener('click', () => {
        const dep = document.getElementById('depart'), arr = document.getElementById('arrivee');
        [dep.value, arr.value] = [arr.value, dep.value];
    });

    // Lancer la Recherche
    document.getElementById('btn-recherche').addEventListener('click', () => {
        const dep = document.getElementById('depart').value;
        const arr = document.getElementById('arrivee').value;
        if (!dep || !arr) return;
        
        currentSearch = { depart: dep, arrivee: arr };
        document.getElementById('results-section').classList.remove('hidden');
        if (currentUser) document.getElementById('btn-save-favori').classList.remove('hidden');
        
        chercherTrains(dep, arr);
    });

    document.getElementById('btn-save-favori').addEventListener('click', sauvegarderFavoriActuel);
});

// --- AUTHENTIFICATION ROBUSTE ---
async function verifierSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        currentUser = session.user;
        document.getElementById('user-name').innerText = currentUser.email.split('@')[0];
        document.getElementById('btn-logout').classList.remove('hidden');
        document.getElementById('auth-modal').classList.add('hidden');
        chargerFavoris();
    }
}

async function gererAuth(action) {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const errorDiv = document.getElementById('auth-error');
    
    errorDiv.classList.add('hidden');

    if(!email || !password) {
        errorDiv.innerText = "Veuillez remplir tous les champs.";
        errorDiv.classList.remove('hidden');
        return;
    }
    if(password.length < 6) {
        errorDiv.innerText = "Le mot de passe doit contenir au moins 6 caractères.";
        errorDiv.classList.remove('hidden');
        return;
    }

    let result;
    if (action === 'login') {
        result = await supabase.auth.signInWithPassword({ email, password });
    } else {
        result = await supabase.auth.signUp({ email, password });
    }

    if (result.error) {
        errorDiv.innerText = "Erreur Supabase : " + result.error.message;
        errorDiv.classList.remove('hidden');
    } else {
        window.location.reload();
    }
}

// --- AUTOCOMPLÉTION & GRANDES VILLES ---
function setupAutocomplete(inputId, listId) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    let timeoutId;

    input.addEventListener('input', (e) => {
        clearTimeout(timeoutId);
        const val = e.target.value.toLowerCase();
        
        if (val.length < 1) { list.classList.add('hidden'); return; }

        list.innerHTML = '';
        list.classList.remove('hidden');

        // 1. D'abord, on cherche dans nos grandes villes (Paris, Lyon...)
        const suggestionsLocales = GRANDES_VILLES.filter(v => v.nom.toLowerCase().includes(val));
        suggestionsLocales.forEach(ville => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item city-main';
            div.innerHTML = `<i class="ph-fill ph-star"></i> ${ville.nom}`;
            div.onclick = () => { input.value = ville.nom; list.classList.add('hidden'); };
            list.appendChild(div);
        });

        // 2. Ensuite, on appelle l'API pour les autres gares
        if (val.length >= 2) {
            timeoutId = setTimeout(async () => {
                try {
                    const res = await fetch(`https://transport.opendata.ch/v1/locations?query=${val}&type=station`);
                    const data = await res.json();
                    
                    data.stations.slice(0, 5).forEach(station => {
                        // On évite les doublons avec les grandes villes
                        if(station.name && !suggestionsLocales.find(v => v.api === station.name)) {
                            const div = document.createElement('div');
                            div.className = 'autocomplete-item';
                            div.innerHTML = `<i class="ph ph-train" style="color:var(--text-muted);"></i> ${station.name}`;
                            div.onclick = () => { input.value = station.name; list.classList.add('hidden'); };
                            list.appendChild(div);
                        }
                    });
                } catch(e) {}
            }, 300);
        }
    });
    
    document.addEventListener('click', (e) => { if(e.target !== input) list.classList.add('hidden'); });
}

function nettoyerNomGarePourAPI(nom) {
    // Transforme "Paris (Toutes gares)" en "Paris" pour que l'API le comprenne
    const ville = GRANDES_VILLES.find(v => v.nom === nom);
    return ville ? ville.api : nom;
}

// --- MOTEUR DE RECHERCHE & TARIFS (CARTE SCOLAIRE) ---
async function chercherTrains(departFull, arriveeFull) {
    const container = document.getElementById('results-container');
    container.innerHTML = '<p style="padding:1rem;">Recherche en cours...</p>';

    const departAPI = nettoyerNomGarePourAPI(departFull);
    const arriveeAPI = nettoyerNomGarePourAPI(arriveeFull);
    const carteScolaireActive = document.getElementById('carte-scolaire').checked;

    try {
        const res = await fetch(`https://transport.opendata.ch/v1/connections?from=${departAPI}&to=${arriveeAPI}&limit=4`);
        const data = await res.json();
        container.innerHTML = '';

        if (!data.connections || data.connections.length === 0) {
            container.innerHTML = '<p>Aucun trajet trouvé.</p>'; return;
        }

        data.connections.forEach(conn => {
            const depTime = new Date(conn.from.departure).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            const arrTime = new Date(conn.to.arrival).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
            const duree = conn.duration.replace('00d', '').substring(1, 6).replace(':', 'h');
            
            // Logique de tarification & Type de train
            let isTER = false;
            let timelineHTML = '<div class="timeline">';
            
            conn.sections.forEach(section => {
                if (section.journey) { 
                    const secDep = new Date(section.departure.departure).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'});
                    const trainType = section.journey.category || 'Train';
                    
                    // On repère si le trajet contient des TER
                    if(trainType.includes('TER') || trainType.includes('RE') || trainType.includes('Car')) {
                        isTER = true;
                    }

                    timelineHTML += `
                        <div class="timeline-item">
                            <div class="station-name">${secDep} • ${section.departure.station.name}</div>
                            <div class="train-info"><i class="ph-fill ph-train"></i> ${trainType} ${section.journey.number || ''}</div>
                        </div>
                    `;
                }
            });
            timelineHTML += `
                <div class="timeline-item">
                    <div class="station-name">${arrTime} • ${conn.to.station.name}</div>
                </div>
            </div>`;

            // Calcul du prix estimé
            let durationParts = conn.duration.replace('00d', '').split(':');
            let durationMinutes = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
            let prixEstime = Math.floor(durationMinutes * 0.18) + 5; // Estimation du tarif SNCF
            
            let htmlPrix = `<div class="price-tag price-normal">${prixEstime},00 €</div>`;
            
            // Si l'utilisateur a activé la carte et que le train est un TER (Auvergne-Rhône-Alpes)
            if (carteScolaireActive && isTER) {
                htmlPrix = `<div class="price-tag price-free">0,00 € (Carte Région)</div>`;
            } else if (carteScolaireActive && !isTER) {
                // S'il a la carte mais que c'est un TGV / Intercités (non couvert)
                htmlPrix = `<div class="price-tag price-normal">${prixEstime},00 € <span style="font-size:0.8rem; font-weight:500; color:var(--text-muted);">(Non couvert)</span></div>`;
            }

            container.innerHTML += `
                <div class="train-card fade-in">
                    <div class="card-header">
                        <span>${conn.transfers === 0 ? 'Direct' : conn.transfers + ' Correspondance(s)'}</span>
                        ${htmlPrix}
                    </div>
                    <div class="time-block">
                        <div class="time">${depTime} <i class="ph ph-arrow-right" style="color:var(--text-muted); font-size:1.5rem;"></i> ${arrTime}</div>
                    </div>
                    <div style="margin-bottom: 1rem; font-weight: 600; color: var(--text-muted);">
                        <i class="ph ph-clock"></i> Durée : ${duree}
                    </div>
                    ${timelineHTML}
                </div>
            `;
        });
    } catch (error) {
        container.innerHTML = '<p style="color: red;">Erreur réseau.</p>';
    }
}

// --- BASE DE DONNÉES ---
async function sauvegarderFavoriActuel() {
    if (!currentUser || !currentSearch) return;

    const { error } = await supabase.from('trajets_favoris').insert([{ 
        gare_depart: currentSearch.depart, 
        gare_arrivee: currentSearch.arrivee, 
        user_id: currentUser.id 
    }]);

    if (!error) {
        document.getElementById('btn-save-favori').innerHTML = '<i class="ph-fill ph-check-circle"></i> Ajouté';
        chargerFavoris();
    }
}

async function chargerFavoris() {
    if (!currentUser) return;
    const { data: trajets } = await supabase.from('trajets_favoris').select('*').eq('user_id', currentUser.id);
    const container = document.getElementById('favorites-container');
    
    if (!trajets || trajets.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);">Aucun favori enregistré.</p>'; return;
    }

    container.innerHTML = '';
    trajets.forEach(trajet => {
        container.innerHTML += `
            <div class="train-card" style="cursor:pointer;" onclick="document.getElementById('depart').value='${trajet.gare_depart}'; document.getElementById('arrivee').value='${trajet.gare_arrivee}'; document.getElementById('btn-recherche').click(); window.scrollTo({top: 0, behavior: 'smooth'});">
                <div class="card-header" style="color: var(--primary);">⭐ Favori</div>
                <div class="time" style="font-size: 1.3rem;">${trajet.gare_depart} <i class="ph ph-arrow-right"></i> ${trajet.gare_arrivee}</div>
            </div>
        `;
    });
}

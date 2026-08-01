// --- 1. CONFIGURATION ---
const SUPABASE_URL = 'https://TON_PROJET.supabase.co'; // Remplace par ton URL
const SUPABASE_KEY = 'TA_CLE_ANON_PUBLIC'; // Remplace par ta clé Supabase
const NAVITIA_TOKEN = 'TON_TOKEN_NAVITIA'; // Obtiens-le gratuitement sur navitia.io

// const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    console.log('⚡ Hypertrain initialisé');
    
    // Bouton inversion
    document.getElementById('btn-swap').addEventListener('click', () => {
        const dep = document.getElementById('depart');
        const arr = document.getElementById('arrivee');
        [dep.value, arr.value] = [arr.value, dep.value];
    });

    // Lancement de la recherche principale
    document.getElementById('btn-recherche').addEventListener('click', () => {
        const depart = document.getElementById('depart').value;
        const arrivee = document.getElementById('arrivee').value;
        
        if(!depart || !arrivee) return alert("Remplis les deux gares !");
        
        // Afficher la section de résultats et le chargement
        document.getElementById('results-section').classList.remove('hidden');
        document.getElementById('loading-spinner').classList.remove('hidden');
        document.getElementById('results-container').innerHTML = '';

        // sauvegarderTrajet(depart, arrivee); // Décommente quand Supabase est lié
        rechercherItineraireNavitia(depart, arrivee);
    });

    // chargerFavorisDepuisSupabase(); // Décommente quand Supabase est lié
});

// --- 2. MOTEUR DE RECHERCHE NAVITIA (VRAIES DONNÉES) ---

// Étape 1 : Convertir le nom d'une ville/gare en ID officiel Navitia
async function getPlaceId(query) {
    const res = await fetch(`https://api.navitia.io/v1/coverage/fr-nw/places?q=${query}`, {
        headers: { 'Authorization': NAVITIA_TOKEN }
    });
    const data = await res.json();
    if (data.places && data.places.length > 0) {
        return data.places[0].id; // Retourne l'ID de la gare trouvée
    }
    throw new Error(`Gare introuvable : ${query}`);
}

// Étape 2 : Chercher les trajets entre les deux ID
async function rechercherItineraireNavitia(villeDepart, villeArrivee) {
    try {
        if (NAVITIA_TOKEN === 'TON_TOKEN_NAVITIA') {
            throw new Error("Clé d'API Navitia manquante. Remplace 'TON_TOKEN_NAVITIA' dans app.js");
        }

        const idDepart = await getPlaceId(villeDepart);
        const idArrivee = await getPlaceId(villeArrivee);

        const res = await fetch(`https://api.navitia.io/v1/coverage/fr-nw/journeys?from=${idDepart}&to=${idArrivee}`, {
            headers: { 'Authorization': NAVITIA_TOKEN }
        });
        
        const data = await res.json();
        document.getElementById('loading-spinner').classList.add('hidden');

        if (data.journeys && data.journeys.length > 0) {
            afficherResultats(data.journeys, villeDepart, villeArrivee);
        } else {
            document.getElementById('results-container').innerHTML = '<p>Aucun train trouvé pour cet itinéraire aujourd\'hui.</p>';
        }

    } catch (error) {
        document.getElementById('loading-spinner').classList.add('hidden');
        document.getElementById('results-container').innerHTML = `<p style="color: red;">Erreur : ${error.message}</p>`;
        console.error(error);
    }
}

// Étape 3 : Afficher les résultats sur le site
function afficherResultats(journeys, depName, arrName) {
    const container = document.getElementById('results-container');
    container.innerHTML = '';

    // On prend les 3 premiers résultats
    journeys.slice(0, 3).forEach(journey => {
        // Navitia donne les dates au format YYYYMMDDTHHMMSS
        const formatTime = (navitiaDate) => {
            const timeStr = navitiaDate.split('T')[1];
            return `${timeStr.substring(0, 2)}h${timeStr.substring(2, 4)}`;
        };

        const departHeure = formatTime(journey.departure_date_time);
        const arriveeHeure = formatTime(journey.arrival_date_time);
        const dureeMinutes = Math.round(journey.duration / 60);
        
        // On cherche le nom du réseau (TER, TGV, etc.) dans la première section de transport
        const ptSection = journey.sections.find(s => s.type === 'public_transport');
        const trainType = ptSection && ptSection.display_informations ? ptSection.display_informations.network : 'Train';

        container.innerHTML += `
            <div class="train-card">
                <div class="card-header">
                    <span>${trainType}</span>
                    <span>${journey.nb_transfers === 0 ? 'Direct' : journey.nb_transfers + ' correspondance(s)'}</span>
                </div>
                <div class="time">${departHeure} ➔ ${arriveeHeure}</div>
                <div class="duration">Durée du trajet : ${dureeMinutes} min</div>
                <div class="route">${depName} ➔ ${arrName}</div>
                <div class="status-badge">
                    <span style="font-size: 1.2rem">•</span> Circule normalement
                </div>
            </div>
        `;
    });
}

// --- 3. BASE DE DONNÉES SUPABASE ---
async function sauvegarderTrajet(depart, arrivee) {
    const { error } = await supabase.from('trajets_favoris').insert([{ 
        gare_depart: depart, 
        gare_arrivee: arrivee, 
        user_id: 'ID_UTILISATEUR_TEST' // À dynamiser avec l'auth Supabase plus tard
    }]);
    if (!error) chargerFavorisDepuisSupabase();
}

async function chargerFavorisDepuisSupabase() {
    const { data: trajets, error } = await supabase
        .from('trajets_favoris')
        .select('*')
        .limit(3)
        .order('created_at', { ascending: false });

    if (error || !trajets) return;

    const container = document.getElementById('favorites-container');
    container.innerHTML = '';
    trajets.forEach(trajet => {
        container.innerHTML += `
            <div class="train-card" style="cursor: pointer;" onclick="document.getElementById('depart').value='${trajet.gare_depart}'; document.getElementById('arrivee').value='${trajet.gare_arrivee}'; document.getElementById('btn-recherche').click();">
                <div class="card-header"><span>Favori enregistré</span></div>
                <div class="route">${trajet.gare_depart} ➔ ${trajet.gare_arrivee}</div>
                <p style="color: var(--primary); font-size: 0.9rem;">Relancer la recherche ➔</p>
            </div>
        `;
    });
}

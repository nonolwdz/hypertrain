// Remplace par tes vraies clés Supabase quand ton projet 'hypertrain' sera créé
const SUPABASE_URL = 'https://TON_PROJET.supabase.co';
const SUPABASE_KEY = 'TA_CLE_ANON_PUBLIC';

// On initialise Supabase (décommenter quand tu as tes clés)
// const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener('DOMContentLoaded', () => {
    console.log('⚡ Hypertrain est prêt');
    
    // Fonctionnalité pour inverser Départ/Arrivée
    document.getElementById('btn-swap').addEventListener('click', () => {
        const inputDepart = document.getElementById('depart');
        const inputArrivee = document.getElementById('arrivee');
        
        const temp = inputDepart.value;
        inputDepart.value = inputArrivee.value;
        inputArrivee.value = temp;
    });

    // Lancement de la recherche
    document.getElementById('btn-recherche').addEventListener('click', () => {
        const depart = document.getElementById('depart').value;
        const arrivee = document.getElementById('arrivee').value;
        
        if(!depart || !arrivee) {
            alert("Veuillez remplir la gare de départ et d'arrivée.");
            return;
        }
        
        console.log(`Recherche demandée : ${depart} vers ${arrivee}`);
        // Ici viendra l'appel à l'API Navitia/SNCF
    });

    // On charge les trajets favoris factices pour le moment
    afficherFavorisFactices();
});

function afficherFavorisFactices() {
    const container = document.getElementById('favorites-container');
    
    // Voici à quoi ressembleront tes cartes une fois liées à Supabase
    // On peut imaginer que ce sont les trajets que tu as enregistré
    container.innerHTML = `
        <div class="train-card">
            <div class="card-header">
                <span>Départ à 17h42</span>
                <span>TER 86043</span>
            </div>
            <div class="route">
                Montluçon <span class="route-arrow">➔</span> Paris
            </div>
            <div class="status-badge status-ok">
                <span style="font-size: 1.2rem">•</span> À l'heure
            </div>
        </div>

        <div class="train-card">
            <div class="card-header">
                <span>Départ à 18h15</span>
                <span>TER 12450</span>
            </div>
            <div class="route">
                Montluçon <span class="route-arrow">➔</span> Bourges
            </div>
            <div class="status-badge status-warning">
                <span style="font-size: 1.2rem">•</span> Retard 10 min
            </div>
        </div>

         <div class="train-card">
            <div class="card-header">
                <span>Départ à 08h30</span>
                <span>TER 54210</span>
            </div>
            <div class="route">
                Montluçon <span class="route-arrow">➔</span> Vichy
            </div>
            <div class="status-badge status-ok">
                <span style="font-size: 1.2rem">•</span> À l'heure
            </div>
        </div>
    `;
}

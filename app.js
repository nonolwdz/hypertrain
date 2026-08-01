document.addEventListener('DOMContentLoaded', () => {
    console.log('⚡ Hypertrain ultra-rapide est prêt');
    
    // On charge les favoris enregistrés dans le navigateur
    afficherFavoris();

    // Inverser les gares
    document.getElementById('btn-swap').addEventListener('click', () => {
        const dep = document.getElementById('depart');
        const arr = document.getElementById('arrivee');
        [dep.value, arr.value] = [arr.value, dep.value];
    });

    // Lancer la recherche
    document.getElementById('btn-recherche').addEventListener('click', async () => {
        const depart = document.getElementById('depart').value;
        const arrivee = document.getElementById('arrivee').value;
        
        if(!depart || !arrivee) return alert("Remplis les deux gares !");
        
        document.getElementById('results-section').classList.remove('hidden');
        document.getElementById('results-container').innerHTML = '<p style="color: var(--primary);">Recherche des trains en cours...</p>';

        sauvegarderFavori(depart, arrivee);
        chercherTrainsSansCle(depart, arrivee);
    });
});

// --- LE MOTEUR DE RECHERCHE MAGIQUE (SANS CLÉ API) ---
async function chercherTrainsSansCle(depart, arrivee) {
    try {
        // On interroge l'Open Data Suisse qui connaît le réseau SNCF et qui est 100% ouvert
        const url = `https://transport.opendata.ch/v1/connections?from=${depart}&to=${arrivee}&limit=3`;
        const res = await fetch(url);
        const data = await res.json();

        const container = document.getElementById('results-container');
        container.innerHTML = '';

        if (!data.connections || data.connections.length === 0) {
            container.innerHTML = '<p>Aucun train trouvé pour ce trajet.</p>';
            return;
        }

        // On affiche les 3 prochains trains
        data.connections.forEach(conn => {
            // Formatage de l'heure
            const depTime = new Date(conn.from.departure).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
            const arrTime = new Date(conn.to.arrival).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'});
            
            // Formatage de la durée (L'API donne "00d02:30:00", on transforme en "2h30")
            const duree = conn.duration.replace('00d', '').substring(1, 6).replace(':', 'h');
            
            const correspondances = conn.transfers;

            container.innerHTML += `
                <div class="train-card">
                    <div class="card-header">
                        <span>Train</span>
                        <span>${correspondances === 0 ? 'Direct' : correspondances + ' correspondance(s)'}</span>
                    </div>
                    <div class="time">${depTime} ➔ ${arrTime}</div>
                    <div class="duration">Durée du trajet : ${duree}</div>
                    <div class="route">${conn.from.station.name} ➔ ${conn.to.station.name}</div>
                    <div class="status-badge">
                        <span style="font-size: 1.2rem">•</span> Trajet Confirmé
                    </div>
                </div>
            `;
        });

    } catch (error) {
        document.getElementById('results-container').innerHTML = '<p style="color: red;">Erreur lors de la recherche des horaires.</p>';
        console.error(error);
    }
}

// --- LA MÉMOIRE LOCALE (SANS BASE DE DONNÉES) ---
function sauvegarderFavori(depart, arrivee) {
    // On lit la mémoire du navigateur
    let favoris = JSON.parse(localStorage.getItem('hypertrain_favoris')) || [];
    
    // On vérifie si le trajet existe déjà pour ne pas l'avoir en double
    const existe = favoris.find(f => f.depart.toLowerCase() === depart.toLowerCase() && f.arrivee.toLowerCase() === arrivee.toLowerCase());
    
    if (!existe) {
        favoris.push({ depart, arrivee });
        if (favoris.length > 3) favoris.shift(); // On garde seulement les 3 plus récents
        localStorage.setItem('hypertrain_favoris', JSON.stringify(favoris));
        afficherFavoris();
    }
}

function afficherFavoris() {
    let favoris = JSON.parse(localStorage.getItem('hypertrain_favoris')) || [];
    const container = document.getElementById('favorites-container');
    
    if (favoris.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted);">Vos recherches apparaîtront ici.</p>';
        return;
    }

    container.innerHTML = '';
    favoris.reverse().forEach(fav => {
        container.innerHTML += `
            <div class="train-card" style="cursor: pointer;" onclick="document.getElementById('depart').value='${fav.depart}'; document.getElementById('arrivee').value='${fav.arrivee}'; document.getElementById('btn-recherche').click();">
                <div class="card-header"><span>Favori local</span></div>
                <div class="route">${fav.depart} ➔ ${fav.arrivee}</div>
                <p style="color: var(--primary); font-size: 0.9rem; margin-top: 1rem;">Lancer la recherche ➔</p>
            </div>
        `;
    });
}

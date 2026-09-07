# TravIA

Comparateur d'itinéraires **voiture / train / avion**. On saisit un départ, une
arrivée et autant de points de passage que nécessaire ; l'outil calcule pour
chaque segment les trois modes, liste les départs et les tarifs des compagnies
qui exploitent la relation, et additionne l'itinéraire composé que l'on retient.

Application entièrement statique : HTML, CSS et JavaScript sans dépendance ni
étape de construction.

## Deux vues

**Comparateur** — l'itinéraire est celui que vous décrivez ; les trois modes sont
mis en regard, segment par segment.

- Durée porte à porte, prix le plus bas par voyageur, émissions de CO₂.
- Points de passage : ajout, suppression, inversion du sens, durée d'arrêt à
  chaque étape. Les horaires s'enchaînent d'un segment au suivant.
- Choix du mode et du départ segment par segment, avec recalcul immédiat du
  total (durée de bout en bout, attente en correspondance, prix, CO₂).
- Offres par compagnie : opérateur, gare ou aéroport, heures de départ et
  d'arrivée, correspondances, prix par voyageur, lien vers le site de vente.

**Meilleur itinéraire** — aucun mode n'est présupposé. La vue teste chaque
combinaison de modes, puis l'insertion d'un point de correspondance
intermédiaire (train jusqu'à Paris puis avion, avion jusqu'à Francfort puis
train...), et classe les résultats par durée, par prix ou par émissions. Un
itinéraire retenu se reprend en un clic dans le comparateur : la correspondance
devient une étape et les modes sont présélectionnés.

## Le reste

- **Aller-retour** : date et heure de retour optionnelles, avec un total cumulé.
- **Choix du point d'embarquement** : taper une ville propose son centre, sa gare
  et ses aéroports ; les temps d'accès s'ajustent selon ce que l'on retient. Les
  résultats de rue ne sont interrogés que si la saisie ressemble à une adresse.
- **Carte** : tracé schématique de l'itinéraire retenu sous le formulaire, un
  trait par segment à la couleur de son mode, les villes du référentiel en
  repères géographiques.
- **Hypothèses ajustables** : motorisation et consommation, prix du carburant ou
  de la recharge, péages, usure, nombre d'occupants du véhicule, classe et carte
  de réduction ferroviaire, temps d'enregistrement et bagage en soute.

## Origine des données

| Donnée | Source |
| --- | --- |
| Distance et durée routières | **OSRM** sur le graphe OpenStreetMap, points de passage respectés |
| Localisation d'un lieu absent du référentiel | **Nominatim** (OpenStreetMap) |
| Référentiel des villes, gares et aéroports | embarqué dans `assets/data.js` |
| Horaires et prix ferroviaires et aériens | **estimés** par le modèle de `assets/engine.js` |

Aucun distributeur ne publie librement ses tarifs et ses horaires. Les prix et
les départs affichés sont donc reconstitués à partir de la distance, de la
vitesse commerciale du corridor, de la grille tarifaire de l'opérateur, du délai
avant le départ, du jour, de l'heure et de la saison. Ce sont des ordres de
grandeur destinés à la comparaison, **pas des offres réservables**. Chaque
résultat indique s'il est mesuré ou estimé.

Les deux services en ligne sont interrogés depuis le navigateur, sans clé d'API.
S'ils sont indisponibles, le calcul bascule sur le modèle interne et l'interface
le signale ; l'outil reste utilisable hors ligne.

## Calage du modèle

- **Route** : facteur de sinuosité et vitesse moyenne effective calés sur les
  temps observés hors incident (Paris - Lyon 465 km en 4 h 40, Paris - Marseille
  775 km en 7 h 20), pauses réglementaires ajoutées au-delà de 2 h 30 de
  conduite, péages au kilomètre selon le pays.
- **Fer** : vitesse par corridor transfrontalier et par réseau intérieur. Les
  réseaux français et espagnol étant en étoile, une pénalité s'applique aux
  transversales qui n'empruntent pas d'axe radial. Confronté à dix-neuf
  relations européennes de référence, le modèle s'écarte en moyenne de **16 %**
  des horaires publiés ; l'écart est plus marqué sur les relations courtes
  parcourues sur lignes classiques.
- **Air** : temps de bloc selon la distance, plus l'accès à l'aéroport,
  l'enregistrement, le débarquement et la rejointe du centre-ville. Une
  compagnie n'est proposée que si elle dispose d'une base ou d'un marché sur la
  relation ; les low-cost sont orientées vers leurs aéroports secondaires.
- Le calcul est **déterministe** : mêmes points, même date et mêmes hypothèses
  donnent toujours les mêmes horaires et les mêmes prix.

## Utilisation en local

Aucune installation. Ouvrir `index.html`, ou servir le dossier pour que les
appels aux services en ligne aboutissent :

```
python3 -m http.server 8000
```

puis <http://127.0.0.1:8000>.

## Mise en ligne

Le workflow `.github/workflows/pages.yml` assemble le site et le déploie sur
GitHub Pages à chaque poussée sur la branche de développement.

Il échoue tant que Pages n'est pas ouvert sur le dépôt : GitHub renvoie
`Create Pages site failed — Resource not accessible by integration`, car le
dépôt est privé et Pages n'est pas disponible sur dépôt privé en formule
gratuite. Une seule action, à faire une fois, débloque la publication :

- rendre le dépôt public dans **Settings → General → Danger Zone → Change
  visibility**, puis relancer le workflow depuis l'onglet **Actions** ;
- ou, avec une formule GitHub Pro ou supérieure, ouvrir **Settings → Pages** et
  choisir `GitHub Actions` comme source.

L'adresse publiée sera `https://polog8.github.io/TravIA/`.

En attendant, `dist/travia.html` est une version autonome : un seul fichier,
style et scripts inclus, qui s'ouvre directement dans un navigateur et se
partage tel quel. Elle se reconstruit à partir des sources :

```
node tools/build-standalone.js
```

Cette version n'appelle aucun service en ligne ; les distances routières y sont
estimées par le modèle interne.

## Structure

```
index.html          page et sections explicatives
assets/styles.css   feuille de style, thème clair et sombre
assets/data.js      villes, gares, aéroports, opérateurs, compagnies, hypothèses
assets/engine.js    distances, cheminement réseau, durées, tarifs, horaires
assets/router.js    recherche du meilleur itinéraire, combinaisons et correspondances
assets/map.js       tracé SVG de l'itinéraire, sans fond de carte externe
assets/providers.js accès à Nominatim et OSRM, avec repli silencieux
assets/app.js       interface, deux onglets, saisie des points, rendu
tools/              assemblage de la version autonome
dist/travia.html    version autonome en un seul fichier
```

## Limites connues

- Les prix ne sont pas ceux des distributeurs et ne permettent pas de réserver.
- Les relations courtes sur lignes classiques sont sous-estimées en durée.
- Le référentiel couvre 110 villes ; ailleurs, l'outil rattache le point à la
  gare et à l'aéroport les plus proches et ajoute le temps d'accès routier.
- La carte est un schéma, pas un fond de carte : le tracé routier ne suit pas le
  détail de la route.
- Un segment en voiture au milieu d'un trajet mixte suppose un véhicule
  disponible sur place ; ce coût n'est pas compté.
- Les émissions aériennes ne comprennent pas les effets non-CO₂ de l'aviation.

## Attribution

Données géographiques : OpenStreetMap et ses contributeurs (ODbL).
Calcul d'itinéraire routier : projet OSRM.

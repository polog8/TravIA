/* TravIA — Referentiel de lieux, operateurs ferroviaires et compagnies aeriennes.
   Les parametres tarifaires sont des ordres de grandeur calibres sur les grilles
   publiques des operateurs (prix au kilometre, part fixe, politique bagages).
   Ils alimentent le moteur d'estimation de assets/engine.js. */
(function (global) {
  'use strict';

  var T = global.TravIA || (global.TravIA = {});

  /* --- fabriques compactes -------------------------------------------------- */
  function A(iata, name, transferMin, kind) {
    return { iata: iata, name: name, transferMin: transferMin, kind: kind || 'main' };
  }
  function R(station, hsr) {
    return { station: station, hsr: !!hsr };
  }
  function P(id, name, country, cc, lat, lon, weight, land, rail, air) {
    return {
      id: id, name: name, country: country, cc: cc, lat: lat, lon: lon,
      weight: weight, land: land, rail: rail || null, air: air || []
    };
  }

  /* --- lieux ---------------------------------------------------------------
     weight : intensite de trafic (1 a 5) -> frequence des departs simules
     land   : masse terrestre, sert a savoir si la route/le rail est possible  */
  T.PLACES = [
    /* France */
    P('paris', 'Paris', 'France', 'FR', 48.8566, 2.3522, 5, 'eu', R('Paris (gares parisiennes)', true), [A('CDG', 'Paris-Charles-de-Gaulle', 55), A('ORY', 'Paris-Orly', 45), A('BVA', 'Beauvais-Tille', 95, 'lowcost')]),
    P('lyon', 'Lyon', 'France', 'FR', 45.7640, 4.8357, 5, 'eu', R('Lyon Part-Dieu', true), [A('LYS', 'Lyon-Saint-Exupery', 45)]),
    P('marseille', 'Marseille', 'France', 'FR', 43.2965, 5.3698, 4, 'eu', R('Marseille Saint-Charles', true), [A('MRS', 'Marseille-Provence', 40)]),
    P('toulouse', 'Toulouse', 'France', 'FR', 43.6047, 1.4442, 4, 'eu', R('Toulouse Matabiau', false), [A('TLS', 'Toulouse-Blagnac', 30)]),
    P('nice', 'Nice', 'France', 'FR', 43.7102, 7.2620, 4, 'eu', R('Nice-Ville', false), [A('NCE', 'Nice-Cote d Azur', 25)]),
    P('nantes', 'Nantes', 'France', 'FR', 47.2184, -1.5536, 4, 'eu', R('Nantes', true), [A('NTE', 'Nantes-Atlantique', 30)]),
    P('strasbourg', 'Strasbourg', 'France', 'FR', 48.5734, 7.7521, 4, 'eu', R('Strasbourg', true), [A('SXB', 'Strasbourg-Entzheim', 25)]),
    P('montpellier', 'Montpellier', 'France', 'FR', 43.6108, 3.8767, 3, 'eu', R('Montpellier Saint-Roch', true), [A('MPL', 'Montpellier-Mediterranee', 25)]),
    P('bordeaux', 'Bordeaux', 'France', 'FR', 44.8378, -0.5792, 4, 'eu', R('Bordeaux Saint-Jean', true), [A('BOD', 'Bordeaux-Merignac', 35)]),
    P('lille', 'Lille', 'France', 'FR', 50.6292, 3.0573, 4, 'eu', R('Lille Europe / Flandres', true), [A('LIL', 'Lille-Lesquin', 30)]),
    P('rennes', 'Rennes', 'France', 'FR', 48.1173, -1.6778, 3, 'eu', R('Rennes', true), [A('RNS', 'Rennes-Saint-Jacques', 20)]),
    P('reims', 'Reims', 'France', 'FR', 49.2583, 4.0317, 2, 'eu', R('Reims', true), []),
    P('lehavre', 'Le Havre', 'France', 'FR', 49.4944, 0.1079, 2, 'eu', R('Le Havre', false), []),
    P('saintetienne', 'Saint-Etienne', 'France', 'FR', 45.4397, 4.3872, 2, 'eu', R('Saint-Etienne Chateaucreux', false), []),
    P('toulon', 'Toulon', 'France', 'FR', 43.1242, 5.9280, 2, 'eu', R('Toulon', true), [A('TLN', 'Toulon-Hyeres', 30)]),
    P('grenoble', 'Grenoble', 'France', 'FR', 45.1885, 5.7245, 3, 'eu', R('Grenoble', false), [A('GNB', 'Grenoble-Alpes-Isere', 50)]),
    P('dijon', 'Dijon', 'France', 'FR', 47.3220, 5.0415, 2, 'eu', R('Dijon-Ville', true), []),
    P('angers', 'Angers', 'France', 'FR', 47.4784, -0.5632, 2, 'eu', R('Angers Saint-Laud', true), []),
    P('nimes', 'Nimes', 'France', 'FR', 43.8367, 4.3601, 2, 'eu', R('Nimes', true), []),
    P('clermont', 'Clermont-Ferrand', 'France', 'FR', 45.7772, 3.0870, 2, 'eu', R('Clermont-Ferrand', false), [A('CFE', 'Clermont-Ferrand-Auvergne', 25)]),
    P('tours', 'Tours', 'France', 'FR', 47.3941, 0.6848, 2, 'eu', R('Tours / Saint-Pierre-des-Corps', true), []),
    P('limoges', 'Limoges', 'France', 'FR', 45.8336, 1.2611, 2, 'eu', R('Limoges-Benedictins', false), []),
    P('brest', 'Brest', 'France', 'FR', 48.3904, -4.4861, 2, 'eu', R('Brest', true), [A('BES', 'Brest-Bretagne', 25)]),
    P('perpignan', 'Perpignan', 'France', 'FR', 42.6887, 2.8948, 2, 'eu', R('Perpignan', true), [A('PGF', 'Perpignan-Rivesaltes', 20)]),
    P('metz', 'Metz', 'France', 'FR', 49.1193, 6.1757, 2, 'eu', R('Metz-Ville', true), []),
    P('besancon', 'Besancon', 'France', 'FR', 47.2378, 6.0241, 2, 'eu', R('Besancon Viotte', true), []),
    P('orleans', 'Orleans', 'France', 'FR', 47.9029, 1.9093, 2, 'eu', R('Orleans', false), []),
    P('rouen', 'Rouen', 'France', 'FR', 49.4432, 1.0993, 2, 'eu', R('Rouen Rive-Droite', false), []),
    P('mulhouse', 'Mulhouse', 'France', 'FR', 47.7508, 7.3359, 2, 'eu', R('Mulhouse-Ville', true), [A('BSL', 'EuroAirport Bale-Mulhouse', 40)]),
    P('caen', 'Caen', 'France', 'FR', 49.1829, -0.3707, 2, 'eu', R('Caen', false), []),
    P('nancy', 'Nancy', 'France', 'FR', 48.6921, 6.1844, 2, 'eu', R('Nancy', true), []),
    P('avignon', 'Avignon', 'France', 'FR', 43.9493, 4.8055, 2, 'eu', R('Avignon TGV', true), []),
    P('biarritz', 'Biarritz', 'France', 'FR', 43.4832, -1.5586, 2, 'eu', R('Biarritz', false), [A('BIQ', 'Biarritz-Pays basque', 15)]),
    P('pau', 'Pau', 'France', 'FR', 43.2951, -0.3708, 2, 'eu', R('Pau', false), [A('PUF', 'Pau-Pyrenees', 20)]),
    P('larochelle', 'La Rochelle', 'France', 'FR', 46.1603, -1.1511, 2, 'eu', R('La Rochelle-Ville', false), [A('LRH', 'La Rochelle-Ile de Re', 15)]),
    P('chambery', 'Chambery', 'France', 'FR', 45.5646, 5.9178, 2, 'eu', R('Chambery-Challes-les-Eaux', false), []),
    P('annecy', 'Annecy', 'France', 'FR', 45.8992, 6.1294, 2, 'eu', R('Annecy', false), []),
    P('ajaccio', 'Ajaccio', 'France', 'FR', 41.9192, 8.7386, 2, 'corse', R('Ajaccio', false), [A('AJA', 'Ajaccio-Napoleon-Bonaparte', 20)]),
    /* Royaume-Uni et Irlande */
    P('londres', 'Londres', 'Royaume-Uni', 'GB', 51.5074, -0.1278, 5, 'gb', R('London St Pancras', true), [A('LHR', 'Heathrow', 55), A('LGW', 'Gatwick', 60), A('STN', 'Stansted', 75, 'lowcost')]),
    P('manchester', 'Manchester', 'Royaume-Uni', 'GB', 53.4808, -2.2426, 3, 'gb', R('Manchester Piccadilly', true), [A('MAN', 'Manchester', 30)]),
    P('edimbourg', 'Edimbourg', 'Royaume-Uni', 'GB', 55.9533, -3.1883, 3, 'gb', R('Edinburgh Waverley', true), [A('EDI', 'Edinburgh', 30)]),
    P('dublin', 'Dublin', 'Irlande', 'IE', 53.3498, -6.2603, 3, 'ie', R('Dublin Connolly', false), [A('DUB', 'Dublin', 35)]),
    /* Benelux, Allemagne, Suisse, Autriche */
    P('bruxelles', 'Bruxelles', 'Belgique', 'BE', 50.8503, 4.3517, 4, 'eu', R('Bruxelles-Midi', true), [A('BRU', 'Bruxelles-National', 35), A('CRL', 'Bruxelles-Charleroi', 70, 'lowcost')]),
    P('anvers', 'Anvers', 'Belgique', 'BE', 51.2194, 4.4025, 2, 'eu', R('Antwerpen-Centraal', true), []),
    P('amsterdam', 'Amsterdam', 'Pays-Bas', 'NL', 52.3676, 4.9041, 4, 'eu', R('Amsterdam Centraal', true), [A('AMS', 'Schiphol', 30)]),
    P('rotterdam', 'Rotterdam', 'Pays-Bas', 'NL', 51.9244, 4.4777, 3, 'eu', R('Rotterdam Centraal', true), []),
    P('luxembourg', 'Luxembourg', 'Luxembourg', 'LU', 49.6116, 6.1319, 2, 'eu', R('Luxembourg', false), [A('LUX', 'Luxembourg-Findel', 20)]),
    P('cologne', 'Cologne', 'Allemagne', 'DE', 50.9375, 6.9603, 3, 'eu', R('Koln Hauptbahnhof', true), [A('CGN', 'Cologne-Bonn', 30)]),
    P('francfort', 'Francfort', 'Allemagne', 'DE', 50.1109, 8.6821, 4, 'eu', R('Frankfurt Hauptbahnhof', true), [A('FRA', 'Francfort', 25)]),
    P('berlin', 'Berlin', 'Allemagne', 'DE', 52.5200, 13.4050, 4, 'eu', R('Berlin Hauptbahnhof', true), [A('BER', 'Berlin-Brandebourg', 45)]),
    P('munich', 'Munich', 'Allemagne', 'DE', 48.1351, 11.5820, 4, 'eu', R('Munchen Hauptbahnhof', true), [A('MUC', 'Munich', 45)]),
    P('hambourg', 'Hambourg', 'Allemagne', 'DE', 53.5511, 9.9937, 3, 'eu', R('Hamburg Hauptbahnhof', true), [A('HAM', 'Hambourg', 30)]),
    P('stuttgart', 'Stuttgart', 'Allemagne', 'DE', 48.7758, 9.1829, 3, 'eu', R('Stuttgart Hauptbahnhof', true), [A('STR', 'Stuttgart', 30)]),
    P('dusseldorf', 'Dusseldorf', 'Allemagne', 'DE', 51.2277, 6.7735, 3, 'eu', R('Dusseldorf Hauptbahnhof', true), [A('DUS', 'Dusseldorf', 25)]),
    P('zurich', 'Zurich', 'Suisse', 'CH', 47.3769, 8.5417, 4, 'eu', R('Zurich Hauptbahnhof', true), [A('ZRH', 'Zurich', 20)]),
    P('geneve', 'Geneve', 'Suisse', 'CH', 46.2044, 6.1432, 3, 'eu', R('Geneve-Cornavin', true), [A('GVA', 'Geneve-Cointrin', 20)]),
    P('berne', 'Berne', 'Suisse', 'CH', 46.9480, 7.4474, 2, 'eu', R('Bern', true), []),
    P('bale', 'Bale', 'Suisse', 'CH', 47.5596, 7.5886, 3, 'eu', R('Basel SBB', true), [A('BSL', 'EuroAirport Bale-Mulhouse', 25)]),
    P('vienne', 'Vienne', 'Autriche', 'AT', 48.2082, 16.3738, 4, 'eu', R('Wien Hauptbahnhof', true), [A('VIE', 'Vienne-Schwechat', 35)]),
    /* Europe du Sud */
    P('milan', 'Milan', 'Italie', 'IT', 45.4642, 9.1900, 4, 'eu', R('Milano Centrale', true), [A('MXP', 'Malpensa', 55), A('LIN', 'Linate', 25), A('BGY', 'Bergame-Orio al Serio', 65, 'lowcost')]),
    P('turin', 'Turin', 'Italie', 'IT', 45.0703, 7.6869, 3, 'eu', R('Torino Porta Nuova', true), [A('TRN', 'Turin-Caselle', 35)]),
    P('rome', 'Rome', 'Italie', 'IT', 41.9028, 12.4964, 5, 'eu', R('Roma Termini', true), [A('FCO', 'Fiumicino', 45), A('CIA', 'Ciampino', 40, 'lowcost')]),
    P('florence', 'Florence', 'Italie', 'IT', 43.7696, 11.2558, 3, 'eu', R('Firenze Santa Maria Novella', true), [A('FLR', 'Florence-Peretola', 25)]),
    P('venise', 'Venise', 'Italie', 'IT', 45.4408, 12.3155, 3, 'eu', R('Venezia Santa Lucia', true), [A('VCE', 'Venise-Marco Polo', 40)]),
    P('naples', 'Naples', 'Italie', 'IT', 40.8518, 14.2681, 3, 'eu', R('Napoli Centrale', true), [A('NAP', 'Naples-Capodichino', 25)]),
    P('bologne', 'Bologne', 'Italie', 'IT', 44.4949, 11.3426, 3, 'eu', R('Bologna Centrale', true), [A('BLQ', 'Bologne-Marconi', 20)]),
    P('barcelone', 'Barcelone', 'Espagne', 'ES', 41.3874, 2.1686, 4, 'eu', R('Barcelona Sants', true), [A('BCN', 'Barcelone-El Prat', 35)]),
    P('madrid', 'Madrid', 'Espagne', 'ES', 40.4168, -3.7038, 5, 'eu', R('Madrid Atocha', true), [A('MAD', 'Madrid-Barajas', 40)]),
    P('valence', 'Valence (Espagne)', 'Espagne', 'ES', 39.4699, -0.3763, 3, 'eu', R('Valencia Joaquin Sorolla', true), [A('VLC', 'Valence', 25)]),
    P('seville', 'Seville', 'Espagne', 'ES', 37.3891, -5.9845, 3, 'eu', R('Sevilla Santa Justa', true), [A('SVQ', 'Seville', 25)]),
    P('bilbao', 'Bilbao', 'Espagne', 'ES', 43.2630, -2.9350, 2, 'eu', R('Bilbao-Abando', false), [A('BIO', 'Bilbao', 25)]),
    P('malaga', 'Malaga', 'Espagne', 'ES', 36.7213, -4.4214, 3, 'eu', R('Malaga Maria Zambrano', true), [A('AGP', 'Malaga-Costa del Sol', 25)]),
    P('palma', 'Palma de Majorque', 'Espagne', 'ES', 39.5696, 2.6502, 3, 'baleares', null, [A('PMI', 'Palma de Majorque', 25)]),
    P('lisbonne', 'Lisbonne', 'Portugal', 'PT', 38.7223, -9.1393, 4, 'eu', R('Lisboa Oriente', false), [A('LIS', 'Lisbonne-Humberto Delgado', 30)]),
    P('porto', 'Porto', 'Portugal', 'PT', 41.1579, -8.6291, 3, 'eu', R('Porto Campanha', false), [A('OPO', 'Porto-Francisco Sa Carneiro', 30)]),
    P('athenes', 'Athenes', 'Grece', 'GR', 37.9838, 23.7275, 3, 'eu', R('Athinai', false), [A('ATH', 'Athenes-Elefthenios-Venizelos', 45)]),
    /* Europe centrale et du Nord */
    P('prague', 'Prague', 'Republique tcheque', 'CZ', 50.0755, 14.4378, 3, 'eu', R('Praha hlavni nadrazi', false), [A('PRG', 'Prague-Vaclav Havel', 35)]),
    P('budapest', 'Budapest', 'Hongrie', 'HU', 47.4979, 19.0402, 3, 'eu', R('Budapest Keleti', false), [A('BUD', 'Budapest-Ferenc Liszt', 40)]),
    P('varsovie', 'Varsovie', 'Pologne', 'PL', 52.2297, 21.0122, 3, 'eu', R('Warszawa Centralna', true), [A('WAW', 'Varsovie-Chopin', 30)]),
    P('cracovie', 'Cracovie', 'Pologne', 'PL', 50.0647, 19.9450, 2, 'eu', R('Krakow Glowny', false), [A('KRK', 'Cracovie-Balice', 30)]),
    P('copenhague', 'Copenhague', 'Danemark', 'DK', 55.6761, 12.5683, 3, 'eu', R('Kobenhavn H', false), [A('CPH', 'Copenhague-Kastrup', 25)]),
    P('stockholm', 'Stockholm', 'Suede', 'SE', 59.3293, 18.0686, 3, 'eu', R('Stockholm Centralstation', true), [A('ARN', 'Stockholm-Arlanda', 45)]),
    P('oslo', 'Oslo', 'Norvege', 'NO', 59.9139, 10.7522, 3, 'eu', R('Oslo Sentralstasjon', false), [A('OSL', 'Oslo-Gardermoen', 40)]),
    P('helsinki', 'Helsinki', 'Finlande', 'FI', 60.1699, 24.9384, 3, 'fi', R('Helsinki', false), [A('HEL', 'Helsinki-Vantaa', 35)]),
    P('bucarest', 'Bucarest', 'Roumanie', 'RO', 44.4268, 26.1025, 2, 'eu', R('Bucuresti Nord', false), [A('OTP', 'Bucarest-Otopeni', 40)]),
    P('istanbul', 'Istanbul', 'Turquie', 'TR', 41.0082, 28.9784, 4, 'eu', R('Istanbul Halkali', false), [A('IST', 'Istanbul', 60)]),
    /* Afrique du Nord et Moyen-Orient */
    P('marrakech', 'Marrakech', 'Maroc', 'MA', 31.6295, -7.9811, 3, 'af', R('Marrakech', false), [A('RAK', 'Marrakech-Menara', 20)]),
    P('casablanca', 'Casablanca', 'Maroc', 'MA', 33.5731, -7.5898, 3, 'af', R('Casa-Voyageurs', false), [A('CMN', 'Mohammed-V', 40)]),
    P('tunis', 'Tunis', 'Tunisie', 'TN', 36.8065, 10.1815, 2, 'af', R('Tunis', false), [A('TUN', 'Tunis-Carthage', 25)]),
    P('alger', 'Alger', 'Algerie', 'DZ', 36.7538, 3.0588, 2, 'af', R('Alger', false), [A('ALG', 'Houari-Boumediene', 35)]),
    P('lecaire', 'Le Caire', 'Egypte', 'EG', 30.0444, 31.2357, 3, 'af', R('Ramses', false), [A('CAI', 'Le Caire', 45)]),
    P('dubai', 'Dubai', 'Emirats arabes unis', 'AE', 25.2048, 55.2708, 4, 'asie', null, [A('DXB', 'Dubai International', 35)]),
    /* Ameriques, Asie, Oceanie */
    P('newyork', 'New York', 'Etats-Unis', 'US', 40.7128, -74.0060, 5, 'am-n', R('New York Penn Station', false), [A('JFK', 'John F. Kennedy', 65), A('EWR', 'Newark', 55)]),
    P('montreal', 'Montreal', 'Canada', 'CA', 45.5017, -73.5673, 3, 'am-n', R('Gare Centrale', false), [A('YUL', 'Montreal-Trudeau', 35)]),
    P('toronto', 'Toronto', 'Canada', 'CA', 43.6532, -79.3832, 3, 'am-n', R('Union Station', false), [A('YYZ', 'Toronto-Pearson', 40)]),
    P('losangeles', 'Los Angeles', 'Etats-Unis', 'US', 34.0522, -118.2437, 4, 'am-n', null, [A('LAX', 'Los Angeles', 50)]),
    P('sanfrancisco', 'San Francisco', 'Etats-Unis', 'US', 37.7749, -122.4194, 4, 'am-n', null, [A('SFO', 'San Francisco', 40)]),
    P('miami', 'Miami', 'Etats-Unis', 'US', 25.7617, -80.1918, 3, 'am-n', null, [A('MIA', 'Miami', 35)]),
    P('mexico', 'Mexico', 'Mexique', 'MX', 19.4326, -99.1332, 3, 'am-n', null, [A('MEX', 'Mexico-Benito Juarez', 45)]),
    P('saopaulo', 'Sao Paulo', 'Bresil', 'BR', -23.5505, -46.6333, 4, 'am-s', null, [A('GRU', 'Sao Paulo-Guarulhos', 60)]),
    P('buenosaires', 'Buenos Aires', 'Argentine', 'AR', -34.6037, -58.3816, 3, 'am-s', null, [A('EZE', 'Ezeiza', 60)]),
    P('dakar', 'Dakar', 'Senegal', 'SN', 14.7167, -17.4677, 2, 'af', null, [A('DSS', 'Blaise-Diagne', 60)]),
    P('johannesburg', 'Johannesburg', 'Afrique du Sud', 'ZA', -26.2041, 28.0473, 3, 'af', null, [A('JNB', 'O. R. Tambo', 40)]),
    P('delhi', 'Delhi', 'Inde', 'IN', 28.6139, 77.2090, 4, 'asie', null, [A('DEL', 'Indira-Gandhi', 50)]),
    P('bangkok', 'Bangkok', 'Thailande', 'TH', 13.7563, 100.5018, 4, 'asie', null, [A('BKK', 'Suvarnabhumi', 50)]),
    P('singapour', 'Singapour', 'Singapour', 'SG', 1.3521, 103.8198, 4, 'asie', null, [A('SIN', 'Changi', 35)]),
    P('shanghai', 'Shanghai', 'Chine', 'CN', 31.2304, 121.4737, 4, 'asie', R('Shanghai Hongqiao', true), [A('PVG', 'Shanghai-Pudong', 55)]),
    P('tokyo', 'Tokyo', 'Japon', 'JP', 35.6762, 139.6503, 5, 'jp', R('Tokyo', true), [A('HND', 'Haneda', 35), A('NRT', 'Narita', 75)]),
    P('seoul', 'Seoul', 'Coree du Sud', 'KR', 37.5665, 126.9780, 4, 'asie', R('Seoul', true), [A('ICN', 'Incheon', 60)]),
    P('sydney', 'Sydney', 'Australie', 'AU', -33.8688, 151.2093, 4, 'oceanie', null, [A('SYD', 'Sydney-Kingsford Smith', 30)])
  ];

  /* --- axes ferroviaires --------------------------------------------------
     Les reseaux francais et espagnol sont en etoile : une relation est rapide
     si elle part du noeud central ou si elle suit un meme axe radial. Les
     transversales (Lyon - Bordeaux, Nantes - Marseille) empruntent des lignes
     classiques et sont nettement plus lentes. */
  T.RAIL_HUBS = { FR: 'paris', ES: 'madrid' };
  T.RAIL_AXES = {
    /* France */
    lyon: 'se', saintetienne: 'se', grenoble: 'se', chambery: 'se', annecy: 'se',
    valence: 'se', avignon: 'se', nimes: 'se', montpellier: 'se', perpignan: 'se',
    marseille: 'se', toulon: 'se', nice: 'se', dijon: 'se', besancon: 'se',
    bordeaux: 'at', tours: 'at', limoges: 'at', biarritz: 'at', bayonne: 'at',
    pau: 'at', larochelle: 'at', toulouse: 'at', clermont: 'at',
    nantes: 'ouest', angers: 'ouest', rennes: 'ouest', brest: 'ouest',
    caen: 'ouest', rouen: 'ouest', lehavre: 'ouest', orleans: 'ouest',
    lille: 'nord', reims: 'est', metz: 'est', nancy: 'est', strasbourg: 'est',
    mulhouse: 'est',
    /* Espagne */
    barcelone: 'es-ne', valencia: 'es-e', seville: 'es-sud', malaga: 'es-sud',
    bilbao: 'es-nord'
  };

  /* --- liaisons terrestres entre masses -------------------------------------
     Ex. tunnel sous la Manche : la voiture passe par la navette (supplement),
     le train par Eurostar. */
  T.LAND_LINKS = [
    { a: 'eu', b: 'gb', car: { extraMin: 75, extraCost: 110, label: 'Navette Eurotunnel (Calais - Folkestone)' }, rail: true },
    { a: 'gb', b: 'ie', car: { extraMin: 220, extraCost: 130, label: 'Ferry Holyhead - Dublin' }, rail: false },
    { a: 'eu', b: 'corse', car: { extraMin: 660, extraCost: 190, label: 'Ferry vers la Corse' }, rail: false },
    { a: 'eu', b: 'baleares', car: { extraMin: 480, extraCost: 175, label: 'Ferry vers les Baleares' }, rail: false },
    { a: 'eu', b: 'fi', car: { extraMin: 150, extraCost: 90, label: 'Ferry Stockholm - Helsinki' }, rail: false }
  ];

  /* --- operateurs ferroviaires ---------------------------------------------
     base    : part fixe du billet (EUR)
     perKm   : part kilometrique (EUR/km) en seconde classe
     hsr     : materiel a grande vitesse
     markets : pays desservis
     freq    : departs par jour sur un axe de trafic moyen           */
  T.RAIL_OPERATORS = [
    { id: 'inoui', name: 'TGV INOUI', company: 'SNCF Voyageurs', markets: ['FR'], intl: ['BE', 'CH', 'DE', 'ES', 'IT', 'LU'], hsr: true, base: 12, perKm: 0.135, freq: 11, classes: ['2de', '1re'], url: 'https://www.sncf-connect.com', flex: true },
    { id: 'ouigo', name: 'OUIGO', company: 'SNCF Voyageurs', markets: ['FR'], intl: ['ES'], hsr: true, base: 5, perKm: 0.058, freq: 5, classes: ['unique'], url: 'https://www.ouigo.com', lowcost: true },
    { id: 'intercites', name: 'Intercites / TER', company: 'SNCF Voyageurs', markets: ['FR'], intl: [], hsr: false, base: 4, perKm: 0.105, freq: 8, classes: ['2de', '1re'], url: 'https://www.sncf-connect.com' },
    { id: 'eurostar', name: 'Eurostar', company: 'Eurostar Group', markets: ['FR', 'GB', 'BE', 'NL', 'DE'], intl: ['FR', 'GB', 'BE', 'NL', 'DE'], hsr: true, base: 32, perKm: 0.145, freq: 7, classes: ['Standard', 'Plus'], url: 'https://www.eurostar.com', border: true, intlOnly: true },
    { id: 'trenitalia', name: 'Frecciarossa', company: 'Trenitalia', markets: ['IT'], intl: ['FR'], hsr: true, base: 10, perKm: 0.118, freq: 10, classes: ['Standard', 'Business'], url: 'https://www.trenitalia.com' },
    { id: 'italo', name: 'Italo', company: 'NTV Italo', markets: ['IT'], intl: [], hsr: true, base: 8, perKm: 0.098, freq: 8, classes: ['Smart', 'Prima'], url: 'https://www.italotreno.com' },
    { id: 'renfe', name: 'AVE', company: 'Renfe', markets: ['ES'], intl: ['FR', 'PT'], hsr: true, base: 12, perKm: 0.112, freq: 9, classes: ['Basico', 'Confort'], url: 'https://www.renfe.com' },
    { id: 'iryo', name: 'iryo', company: 'Iryo', markets: ['ES'], intl: [], hsr: true, base: 7, perKm: 0.072, freq: 5, classes: ['Inicial', 'Singular'], url: 'https://iryo.eu', lowcost: true },
    { id: 'ice', name: 'ICE', company: 'Deutsche Bahn', markets: ['DE'], intl: ['FR', 'BE', 'NL', 'CH', 'AT', 'DK'], hsr: true, base: 12, perKm: 0.148, freq: 10, classes: ['2. Klasse', '1. Klasse'], url: 'https://www.bahn.de', flex: true },
    { id: 'flixtrain', name: 'FlixTrain', company: 'Flix SE', markets: ['DE'], intl: [], hsr: false, base: 6, perKm: 0.048, freq: 3, classes: ['unique'], url: 'https://www.flixtrain.com', lowcost: true },
    { id: 'railjet', name: 'Railjet', company: 'OBB', markets: ['AT'], intl: ['DE', 'CH', 'HU', 'CZ', 'IT'], hsr: true, base: 10, perKm: 0.102, freq: 7, classes: ['Economy', 'First'], url: 'https://www.oebb.at' },
    { id: 'nightjet', name: 'Nightjet', company: 'OBB', markets: ['AT', 'DE', 'CH', 'IT', 'FR', 'NL', 'BE', 'HU', 'CZ'], intl: ['AT', 'DE', 'CH', 'IT', 'FR', 'NL', 'BE', 'HU', 'CZ'], hsr: false, base: 40, perKm: 0.062, freq: 1, classes: ['Couchette', 'Cabine'], url: 'https://www.nightjet.com', night: true, intlOnly: true },
    { id: 'icnuit', name: 'Intercites de Nuit', company: 'SNCF Voyageurs', markets: ['FR'], intl: [], hsr: false, base: 29, perKm: 0.042, freq: 1, classes: ['Couchette', 'Cabine'], url: 'https://www.sncf-connect.com', night: true },
    { id: 'sbb', name: 'InterCity', company: 'CFF / SBB', markets: ['CH'], intl: ['DE', 'IT', 'FR', 'AT'], hsr: false, base: 14, perKm: 0.215, freq: 12, classes: ['2e', '1re'], url: 'https://www.sbb.ch' },
    { id: 'ns', name: 'Intercity', company: 'NS', markets: ['NL'], intl: ['BE', 'DE'], hsr: false, base: 7, perKm: 0.155, freq: 12, classes: ['2e', '1re'], url: 'https://www.ns.nl' },
    { id: 'sncb', name: 'InterCity', company: 'SNCB', markets: ['BE'], intl: ['NL', 'LU', 'FR'], hsr: false, base: 6, perKm: 0.135, freq: 12, classes: ['2e', '1re'], url: 'https://www.belgiantrain.be' },
    { id: 'lner', name: 'LNER / Avanti', company: 'National Rail', markets: ['GB'], intl: [], hsr: true, base: 15, perKm: 0.165, freq: 9, classes: ['Standard', 'First'], url: 'https://www.nationalrail.co.uk' },
    { id: 'cp', name: 'Alfa Pendular', company: 'Comboios de Portugal', markets: ['PT'], intl: ['ES'], hsr: false, base: 8, perKm: 0.085, freq: 5, classes: ['Turistica', 'Conforto'], url: 'https://www.cp.pt' },
    { id: 'pkp', name: 'PKP Intercity', company: 'PKP', markets: ['PL'], intl: ['DE', 'CZ', 'AT'], hsr: false, base: 6, perKm: 0.055, freq: 6, classes: ['2 klasa', '1 klasa'], url: 'https://www.intercity.pl' },
    { id: 'cd', name: 'RegioJet / CD', company: 'Ceske drahy', markets: ['CZ', 'SK'], intl: ['AT', 'DE', 'PL', 'HU'], hsr: false, base: 5, perKm: 0.052, freq: 6, classes: ['Standard', 'Business'], url: 'https://www.cd.cz' },
    { id: 'mav', name: 'MAV InterCity', company: 'MAV-Start', markets: ['HU'], intl: ['AT', 'RO'], hsr: false, base: 5, perKm: 0.05, freq: 5, classes: ['2e', '1re'], url: 'https://www.mavcsoport.hu' },
    { id: 'sj', name: 'SJ Snabbtag', company: 'SJ', markets: ['SE'], intl: ['DK', 'NO'], hsr: true, base: 14, perKm: 0.115, freq: 6, classes: ['2 klass', '1 klass'], url: 'https://www.sj.se' },
    { id: 'dsb', name: 'DSB InterCity', company: 'DSB', markets: ['DK'], intl: ['SE', 'DE'], hsr: false, base: 10, perKm: 0.12, freq: 8, classes: ['Standard', 'Plus'], url: 'https://www.dsb.dk' },
    { id: 'vy', name: 'Vy', company: 'Vy', markets: ['NO'], intl: ['SE'], hsr: false, base: 12, perKm: 0.12, freq: 5, classes: ['Standard', 'Komfort'], url: 'https://www.vy.no' },
    { id: 'vr', name: 'VR Pendolino', company: 'VR', markets: ['FI'], intl: [], hsr: false, base: 9, perKm: 0.09, freq: 6, classes: ['Eco', 'Extra'], url: 'https://www.vr.fi' },
    { id: 'shinkansen', name: 'Shinkansen', company: 'JR', markets: ['JP'], intl: [], hsr: true, base: 20, perKm: 0.14, freq: 14, classes: ['Ordinaire', 'Green'], url: 'https://www.jreast.co.jp' },
    { id: 'crh', name: 'CRH', company: 'China Railway', markets: ['CN'], intl: [], hsr: true, base: 6, perKm: 0.055, freq: 12, classes: ['2e', '1re'], url: 'https://www.12306.cn' },
    { id: 'amtrak', name: 'Amtrak', company: 'Amtrak', markets: ['US', 'CA'], intl: ['CA', 'US'], hsr: false, base: 18, perKm: 0.11, freq: 5, classes: ['Coach', 'Business'], url: 'https://www.amtrak.com' },
    { id: 'oncf', name: 'Al Boraq / ONCF', company: 'ONCF', markets: ['MA'], intl: [], hsr: true, base: 6, perKm: 0.055, freq: 8, classes: ['2e', '1re'], url: 'https://www.oncf.ma' }
  ];

  /* --- compagnies aeriennes -------------------------------------------------
     type   : 'low' (low-cost) ou 'full' (compagnie classique)
     base   : part fixe (EUR), perKm : part kilometrique (EUR/km)
     range  : rayon d'action commercial (km)
     hubs   : aeroports ou la compagnie a une base
     markets: pays desservis en point a point                       */
  T.AIRLINES = [
    { id: 'af', name: 'Air France', code: 'AF', type: 'full', base: 52, perKm: 0.098, range: 14000, hubs: ['CDG', 'ORY'], markets: ['FR'], bag: 0, url: 'https://www.airfrance.fr' },
    { id: 'klm', name: 'KLM', code: 'KL', type: 'full', base: 50, perKm: 0.096, range: 14000, hubs: ['AMS'], markets: ['NL'], bag: 0, url: 'https://www.klm.fr' },
    { id: 'lh', name: 'Lufthansa', code: 'LH', type: 'full', base: 55, perKm: 0.102, range: 14000, hubs: ['FRA', 'MUC'], markets: ['DE'], bag: 0, url: 'https://www.lufthansa.com' },
    { id: 'ba', name: 'British Airways', code: 'BA', type: 'full', base: 48, perKm: 0.099, range: 14000, hubs: ['LHR', 'LGW'], markets: ['GB'], bag: 0, url: 'https://www.britishairways.com' },
    { id: 'ib', name: 'Iberia', code: 'IB', type: 'full', base: 45, perKm: 0.092, range: 12000, hubs: ['MAD'], markets: ['ES'], bag: 0, url: 'https://www.iberia.com' },
    { id: 'ita', name: 'ITA Airways', code: 'AZ', type: 'full', base: 46, perKm: 0.094, range: 12000, hubs: ['FCO', 'LIN'], markets: ['IT'], bag: 0, url: 'https://www.ita-airways.com' },
    { id: 'lx', name: 'SWISS', code: 'LX', type: 'full', base: 58, perKm: 0.108, range: 12000, hubs: ['ZRH', 'GVA'], markets: ['CH'], bag: 0, url: 'https://www.swiss.com' },
    { id: 'os', name: 'Austrian Airlines', code: 'OS', type: 'full', base: 50, perKm: 0.1, range: 10000, hubs: ['VIE'], markets: ['AT'], bag: 0, url: 'https://www.austrian.com' },
    { id: 'sn', name: 'Brussels Airlines', code: 'SN', type: 'full', base: 46, perKm: 0.098, range: 9000, hubs: ['BRU'], markets: ['BE'], bag: 0, url: 'https://www.brusselsairlines.com' },
    { id: 'tp', name: 'TAP Air Portugal', code: 'TP', type: 'full', base: 42, perKm: 0.088, range: 11000, hubs: ['LIS', 'OPO'], markets: ['PT'], bag: 0, url: 'https://www.flytap.com' },
    { id: 'sk', name: 'SAS', code: 'SK', type: 'full', base: 48, perKm: 0.098, range: 9500, hubs: ['CPH', 'ARN', 'OSL'], markets: ['DK', 'SE', 'NO'], bag: 0, url: 'https://www.flysas.com' },
    { id: 'ei', name: 'Aer Lingus', code: 'EI', type: 'full', base: 38, perKm: 0.082, range: 8000, hubs: ['DUB'], markets: ['IE'], bag: 25, url: 'https://www.aerlingus.com' },
    { id: 'lo', name: 'LOT', code: 'LO', type: 'full', base: 42, perKm: 0.09, range: 10000, hubs: ['WAW'], markets: ['PL'], bag: 0, url: 'https://www.lot.com' },
    { id: 'tk', name: 'Turkish Airlines', code: 'TK', type: 'full', base: 44, perKm: 0.086, range: 13000, hubs: ['IST'], markets: ['TR'], bag: 0, url: 'https://www.turkishairlines.com' },
    { id: 'ay', name: 'Finnair', code: 'AY', type: 'full', base: 50, perKm: 0.1, range: 11000, hubs: ['HEL'], markets: ['FI'], bag: 0, url: 'https://www.finnair.com' },
    { id: 'at', name: 'Royal Air Maroc', code: 'AT', type: 'full', base: 40, perKm: 0.086, range: 10000, hubs: ['CMN', 'RAK'], markets: ['MA'], bag: 0, url: 'https://www.royalairmaroc.com' },
    { id: 'ek', name: 'Emirates', code: 'EK', type: 'full', base: 60, perKm: 0.082, range: 15000, hubs: ['DXB'], markets: ['AE'], bag: 0, url: 'https://www.emirates.com' },
    { id: 'ua', name: 'United Airlines', code: 'UA', type: 'full', base: 55, perKm: 0.085, range: 14000, hubs: ['EWR', 'SFO', 'LAX'], markets: ['US'], bag: 35, url: 'https://www.united.com' },
    { id: 'dl', name: 'Delta Air Lines', code: 'DL', type: 'full', base: 55, perKm: 0.086, range: 14000, hubs: ['JFK', 'LAX', 'MIA'], markets: ['US'], bag: 35, url: 'https://www.delta.com' },
    { id: 'ac', name: 'Air Canada', code: 'AC', type: 'full', base: 52, perKm: 0.088, range: 13000, hubs: ['YUL', 'YYZ'], markets: ['CA'], bag: 30, url: 'https://www.aircanada.com' },
    { id: 'jl', name: 'Japan Airlines', code: 'JL', type: 'full', base: 58, perKm: 0.092, range: 13000, hubs: ['HND', 'NRT'], markets: ['JP'], bag: 0, url: 'https://www.jal.co.jp' },
    { id: 'sq', name: 'Singapore Airlines', code: 'SQ', type: 'full', base: 58, perKm: 0.09, range: 15000, hubs: ['SIN'], markets: ['SG'], bag: 0, url: 'https://www.singaporeair.com' },
    { id: 'qf', name: 'Qantas', code: 'QF', type: 'full', base: 60, perKm: 0.09, range: 16000, hubs: ['SYD'], markets: ['AU'], bag: 0, url: 'https://www.qantas.com' },
    { id: 'fr', name: 'Ryanair', code: 'FR', type: 'low', base: 11, perKm: 0.034, range: 3600, hubs: ['STN', 'BGY', 'CRL', 'BVA', 'DUB'], markets: ['FR', 'GB', 'IE', 'IT', 'ES', 'PT', 'BE', 'DE', 'PL', 'MA', 'AT', 'HU', 'CZ', 'GR', 'RO', 'NL', 'SE', 'DK'], bag: 28, url: 'https://www.ryanair.com', lowAirport: true },
    { id: 'u2', name: 'easyJet', code: 'U2', type: 'low', base: 19, perKm: 0.047, range: 3800, hubs: ['LGW', 'ORY', 'CDG', 'GVA', 'MXP', 'LIS'], markets: ['FR', 'GB', 'CH', 'IT', 'ES', 'PT', 'NL', 'DE', 'MA', 'GR', 'AT'], bag: 26, url: 'https://www.easyjet.com' },
    { id: 'vy', name: 'Vueling', code: 'VY', type: 'low', base: 17, perKm: 0.044, range: 3500, hubs: ['BCN', 'ORY', 'MAD'], markets: ['ES', 'FR', 'IT', 'GB', 'PT', 'GR', 'MA'], bag: 24, url: 'https://www.vueling.com' },
    { id: 'hv', name: 'Transavia', code: 'HV', type: 'low', base: 20, perKm: 0.046, range: 3500, hubs: ['ORY', 'AMS', 'NTE', 'LYS', 'MPL'], markets: ['FR', 'NL', 'ES', 'PT', 'IT', 'GR', 'MA', 'TN'], bag: 25, url: 'https://www.transavia.com' },
    { id: 'w6', name: 'Wizz Air', code: 'W6', type: 'low', base: 10, perKm: 0.031, range: 4000, hubs: ['BUD', 'OTP', 'KRK', 'WAW'], markets: ['HU', 'RO', 'PL', 'CZ', 'IT', 'ES', 'GB', 'FR', 'DE', 'AT', 'GR', 'AE'], bag: 30, url: 'https://wizzair.com' },
    { id: 'v7', name: 'Volotea', code: 'V7', type: 'low', base: 16, perKm: 0.043, range: 2800, hubs: ['NTE', 'BOD', 'LYS', 'VCE', 'MRS', 'TLS'], markets: ['FR', 'IT', 'ES', 'GR'], bag: 23, url: 'https://www.volotea.com' }
  ];

  /* --- hypotheses par defaut du modele -------------------------------------- */
  T.DEFAULTS = {
    fuel: 'essence',
    consumption: 6.2,          /* L/100 km */
    fuelPrice: 1.79,           /* EUR/L */
    kwhPer100: 17.5,           /* kWh/100 km en electrique */
    kwhPrice: 0.32,            /* EUR/kWh en charge rapide */
    tolls: true,
    tollRate: 0.092,           /* EUR/km sur reseau concede */
    motorwayShare: 0.72,       /* part du trajet sur autoroute (longue distance) */
    wearPerKm: 0.06,           /* usure et entretien, EUR/km */
    includeWear: false,
    occupants: 1,              /* personnes partageant les frais de voiture */
    passengers: 1,
    railClass: '2de',
    railCard: 'aucune',
    checkinMin: 90,            /* enregistrement + surete avant le vol */
    disembarkMin: 30,          /* debarquement + bagages */
    hold: false,               /* bagage en soute */
    railTransferMin: 20,       /* acces a la gare */
    useLive: true
  };

  /* facteurs d'emission, en grammes de CO2 equivalent */
  T.CO2 = {
    essence: 192, diesel: 171, hybride: 128, electrique: 62,   /* g/km par vehicule */
    railHsr: 6, railRegional: 32,                              /* g/km par voyageur */
    airShort: 156, airLong: 108                                /* g/km par voyageur */
  };

  T.RAIL_CARDS = {
    'aucune': { label: 'Aucune', factor: 1 },
    'avantage': { label: 'Carte Avantage (SNCF)', factor: 0.75 },
    'liberte': { label: 'Carte Liberte (SNCF)', factor: 0.62 },
    'jeune': { label: 'Carte Jeune / Senior', factor: 0.7 },
    'bahncard': { label: 'BahnCard 25 (DB)', factor: 0.75 },
    'demi': { label: 'Abonnement demi-tarif (CFF)', factor: 0.5 }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);

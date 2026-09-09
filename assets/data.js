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
  /* Gare : nom, coordonnees (nulles = celles de la ville), aptitude a la
     grande vitesse, temps d'acces depuis le centre en minutes. */
  function S(name, lat, lon, hsr, accessMin, serves) {
    return {
      name: name, lat: lat, lon: lon, hsr: !!hsr,
      accessMin: accessMin == null ? 15 : accessMin,
      serves: serves || null
    };
  }
  function R(station, hsr) {
    return [S(station, null, null, hsr, 15)];
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
    P('sydney', 'Sydney', 'Australie', 'AU', -33.8688, 151.2093, 4, 'oceanie', null, [A('SYD', 'Sydney-Kingsford Smith', 30)]),
/* --- France : villes et gares nouvelles --- */
    P('aix', 'Aix-en-Provence', 'France', 'FR', 43.5297, 5.4474, 3, 'eu', R('Aix-en-Provence Centre', false), []),
    P('valencefr', 'Valence', 'France', 'FR', 44.9333, 4.8917, 2, 'eu', R('Valence Ville', false), []),
    P('poitiers', 'Poitiers', 'France', 'FR', 46.5802, 0.3404, 2, 'eu', R('Poitiers', true), []),
    P('lemans', 'Le Mans', 'France', 'FR', 48.0061, 0.1996, 2, 'eu', R('Le Mans', true), []),
    P('lorient', 'Lorient', 'France', 'FR', 47.7483, -3.3702, 2, 'eu', R('Lorient', false), [A('LRT', 'Lorient-Bretagne Sud', 20)]),
    P('calais', 'Calais', 'France', 'FR', 50.9513, 1.8587, 2, 'eu', R('Calais-Frethun', true), []),
    P('amiens', 'Amiens', 'France', 'FR', 49.8941, 2.2958, 2, 'eu', R('Amiens', false), []),
    P('bastia', 'Bastia', 'France', 'FR', 42.7028, 9.4503, 2, 'corse', R('Bastia', false), [A('BIA', 'Bastia-Poretta', 25)]),
    /* --- Europe --- */
    P('lausanne', 'Lausanne', 'Suisse', 'CH', 46.5197, 6.6323, 2, 'eu', R('Lausanne', false), []),
    P('salzbourg', 'Salzbourg', 'Autriche', 'AT', 47.8095, 13.0550, 2, 'eu', R('Salzburg Hauptbahnhof', true), [A('SZG', 'Salzbourg-Mozart', 20)]),
    P('innsbruck', 'Innsbruck', 'Autriche', 'AT', 47.2692, 11.4041, 2, 'eu', R('Innsbruck Hauptbahnhof', true), [A('INN', 'Innsbruck', 15)]),
    P('graz', 'Graz', 'Autriche', 'AT', 47.0707, 15.4395, 2, 'eu', R('Graz Hauptbahnhof', false), [A('GRZ', 'Graz', 20)]),
    P('genes', 'Genes', 'Italie', 'IT', 44.4056, 8.9463, 3, 'eu', R('Genova Piazza Principe', false), [A('GOA', 'Genes-Cristoforo Colombo', 20)]),
    P('verone', 'Verone', 'Italie', 'IT', 45.4384, 10.9916, 2, 'eu', R('Verona Porta Nuova', true), [A('VRN', 'Verone-Villafranca', 25)]),
    P('pise', 'Pise', 'Italie', 'IT', 43.7228, 10.4017, 2, 'eu', R('Pisa Centrale', false), [A('PSA', 'Pise-Galilee', 15)]),
    P('palerme', 'Palerme', 'Italie', 'IT', 38.1157, 13.3615, 3, 'sicile', R('Palermo Centrale', false), [A('PMO', 'Palerme-Punta Raisi', 45)]),
    P('catane', 'Catane', 'Italie', 'IT', 37.5079, 15.0830, 3, 'sicile', R('Catania Centrale', false), [A('CTA', 'Catane-Fontanarossa', 20)]),
    P('bari', 'Bari', 'Italie', 'IT', 41.1171, 16.8719, 3, 'eu', R('Bari Centrale', true), [A('BRI', 'Bari-Palese', 25)]),
    P('cagliari', 'Cagliari', 'Italie', 'IT', 39.2238, 9.1217, 2, 'sardaigne', R('Cagliari', false), [A('CAG', 'Cagliari-Elmas', 20)]),
    P('alicante', 'Alicante', 'Espagne', 'ES', 38.3452, -0.4810, 3, 'eu', R('Alicante Terminal', true), [A('ALC', 'Alicante-Elche', 25)]),
    P('saragosse', 'Saragosse', 'Espagne', 'ES', 41.6488, -0.8891, 3, 'eu', R('Zaragoza Delicias', true), [A('ZAZ', 'Saragosse', 25)]),
    P('grenade', 'Grenade', 'Espagne', 'ES', 37.1773, -3.5986, 2, 'eu', R('Granada', true), [A('GRX', 'Grenade-Jaen', 25)]),
    P('faro', 'Faro', 'Portugal', 'PT', 37.0194, -7.9304, 2, 'eu', R('Faro', false), [A('FAO', 'Faro', 15)]),
    P('funchal', 'Funchal', 'Portugal', 'PT', 32.6669, -16.9241, 2, 'madere', null, [A('FNC', 'Madere-Cristiano Ronaldo', 30)]),
    P('laspalmas', 'Las Palmas', 'Espagne', 'ES', 28.1235, -15.4363, 3, 'canaries', null, [A('LPA', 'Gran Canaria', 30)]),
    P('tenerife', 'Tenerife', 'Espagne', 'ES', 28.4636, -16.2518, 3, 'canaries-o', null, [A('TFS', 'Tenerife-Sud', 45)]),
    P('ibiza', 'Ibiza', 'Espagne', 'ES', 38.9067, 1.4206, 2, 'ibiza', null, [A('IBZ', 'Ibiza', 20)]),
    P('malte', 'La Valette', 'Malte', 'MT', 35.8989, 14.5146, 2, 'malte', null, [A('MLA', 'Malte-Luqa', 25)]),
    P('larnaca', 'Larnaca', 'Chypre', 'CY', 34.9182, 33.6201, 2, 'chypre', null, [A('LCA', 'Larnaca', 20)]),
    P('heraklion', 'Heraklion', 'Grece', 'GR', 35.3387, 25.1442, 2, 'crete', null, [A('HER', 'Heraklion-Kazantzakis', 20)]),
    P('thessalonique', 'Thessalonique', 'Grece', 'GR', 40.6401, 22.9444, 3, 'eu', R('Thessaloniki', false), [A('SKG', 'Thessalonique-Macedoine', 30)]),
    P('cluj', 'Cluj-Napoca', 'Roumanie', 'RO', 46.7712, 23.6236, 2, 'eu', R('Cluj-Napoca', false), [A('CLJ', 'Cluj-Avram Iancu', 20)]),
    P('timisoara', 'Timisoara', 'Roumanie', 'RO', 45.7489, 21.2087, 2, 'eu', R('Timisoara Nord', false), [A('TSR', 'Timisoara-Traian Vuia', 20)]),
    P('sarajevo', 'Sarajevo', 'Bosnie-Herzegovine', 'BA', 43.8563, 18.4131, 2, 'eu', R('Sarajevo', false), [A('SJJ', 'Sarajevo', 20)]),
    P('split', 'Split', 'Croatie', 'HR', 43.5081, 16.4402, 2, 'eu', R('Split', false), [A('SPU', 'Split', 30)]),
    P('dubrovnik', 'Dubrovnik', 'Croatie', 'HR', 42.6507, 18.0944, 2, 'eu', null, [A('DBV', 'Dubrovnik', 30)]),
    P('bratislava', 'Bratislava', 'Slovaquie', 'SK', 48.1486, 17.1077, 2, 'eu', R('Bratislava hlavna stanica', false), [A('BTS', 'Bratislava', 20)]),
    P('brno', 'Brno', 'Republique tcheque', 'CZ', 49.1951, 16.6068, 2, 'eu', R('Brno hlavni nadrazi', false), [A('BRQ', 'Brno-Turany', 20)]),
    P('gdansk', 'Gdansk', 'Pologne', 'PL', 54.3520, 18.6466, 2, 'eu', R('Gdansk Glowny', true), [A('GDN', 'Gdansk-Lech Walesa', 25)]),
    P('wroclaw', 'Wroclaw', 'Pologne', 'PL', 51.1079, 17.0385, 2, 'eu', R('Wroclaw Glowny', false), [A('WRO', 'Wroclaw-Copernic', 20)]),
    P('poznan', 'Poznan', 'Pologne', 'PL', 52.4064, 16.9252, 2, 'eu', R('Poznan Glowny', false), [A('POZ', 'Poznan-Lawica', 20)]),
    P('riga', 'Riga', 'Lettonie', 'LV', 56.9496, 24.1052, 3, 'eu', R('Riga', false), [A('RIX', 'Riga', 25)]),
    P('vilnius', 'Vilnius', 'Lituanie', 'LT', 54.6872, 25.2797, 2, 'eu', R('Vilnius', false), [A('VNO', 'Vilnius', 20)]),
    P('tallinn', 'Tallinn', 'Estonie', 'EE', 59.4370, 24.7536, 2, 'eu', R('Tallinn Balti jaam', false), [A('TLL', 'Tallinn-Lennart Meri', 15)]),
    P('goteborg', 'Goteborg', 'Suede', 'SE', 57.7089, 11.9746, 3, 'eu', R('Goteborg Centralstation', true), [A('GOT', 'Goteborg-Landvetter', 30)]),
    P('malmo', 'Malmo', 'Suede', 'SE', 55.6050, 13.0038, 2, 'eu', R('Malmo Centralstation', true), []),
    P('bergen', 'Bergen', 'Norvege', 'NO', 60.3913, 5.3221, 2, 'eu', R('Bergen stasjon', false), [A('BGO', 'Bergen-Flesland', 25)]),
    P('aarhus', 'Aarhus', 'Danemark', 'DK', 56.1629, 10.2039, 2, 'eu', R('Aarhus Hovedbanegard', false), [A('AAR', 'Aarhus', 35)]),
    P('reykjavik', 'Reykjavik', 'Islande', 'IS', 64.1466, -21.9426, 3, 'islande', null, [A('KEF', 'Keflavik', 50)]),
    P('birmingham', 'Birmingham', 'Royaume-Uni', 'GB', 52.4862, -1.8904, 3, 'gb', R('Birmingham New Street', true), [A('BHX', 'Birmingham', 25)]),
    P('glasgow', 'Glasgow', 'Royaume-Uni', 'GB', 55.8642, -4.2518, 3, 'gb', R('Glasgow Central', true), [A('GLA', 'Glasgow', 25)]),
    P('bristol', 'Bristol', 'Royaume-Uni', 'GB', 51.4545, -2.5879, 2, 'gb', R('Bristol Temple Meads', false), [A('BRS', 'Bristol', 25)]),
    P('belfast', 'Belfast', 'Royaume-Uni', 'GB', 54.5973, -5.9301, 2, 'ie', R('Belfast Lanyon Place', false), [A('BFS', 'Belfast International', 35)]),
    P('cork', 'Cork', 'Irlande', 'IE', 51.8985, -8.4756, 2, 'ie', R('Cork Kent', false), [A('ORK', 'Cork', 20)]),
    P('moscou', 'Moscou', 'Russie', 'RU', 55.7558, 37.6173, 4, 'eu', R('Moskva Leningradski', true), [A('SVO', 'Cheremetievo', 50)]),
    P('kyiv', 'Kyiv', 'Ukraine', 'UA', 50.4501, 30.5234, 3, 'eu', R('Kyiv-Pasazhyrskyi', false), [A('KBP', 'Boryspil', 45)]),
    /* --- Afrique et Moyen-Orient --- */
    P('tanger', 'Tanger', 'Maroc', 'MA', 35.7595, -5.8340, 2, 'af', R('Tanger Ville', true), [A('TNG', 'Tanger-Ibn Battouta', 25)]),
    P('fes', 'Fes', 'Maroc', 'MA', 34.0181, -5.0078, 2, 'af', R('Fes', false), [A('FEZ', 'Fes-Saiss', 20)]),
    P('agadir', 'Agadir', 'Maroc', 'MA', 30.4278, -9.5981, 2, 'af', null, [A('AGA', 'Agadir-Al Massira', 30)]),
    P('oran', 'Oran', 'Algerie', 'DZ', 35.6969, -0.6331, 2, 'af', R('Oran', false), [A('ORN', 'Oran-Ahmed Ben Bella', 25)]),
    P('charm', 'Charm el-Cheikh', 'Egypte', 'EG', 27.9158, 34.3299, 2, 'af', null, [A('SSH', 'Charm el-Cheikh', 20)]),
    P('doha', 'Doha', 'Qatar', 'QA', 25.2854, 51.5310, 3, 'asie', null, [A('DOH', 'Hamad', 25)]),
    P('abudhabi', 'Abu Dhabi', 'Emirats arabes unis', 'AE', 24.4539, 54.3773, 3, 'asie', null, [A('AUH', 'Zayed', 35)]),
    P('riyad', 'Riyad', 'Arabie saoudite', 'SA', 24.7136, 46.6753, 3, 'asie', R('Riyadh', true), [A('RUH', 'Roi-Khaled', 40)]),
    P('djeddah', 'Djeddah', 'Arabie saoudite', 'SA', 21.4858, 39.1925, 3, 'asie', R('Jeddah Haramain', true), [A('JED', 'Roi-Abdulaziz', 30)]),
    P('telaviv', 'Tel Aviv', 'Israel', 'IL', 32.0853, 34.7818, 3, 'asie', R('Tel Aviv Savidor', false), [A('TLV', 'Ben Gourion', 30)]),
    P('amman', 'Amman', 'Jordanie', 'JO', 31.9454, 35.9284, 2, 'asie', null, [A('AMM', 'Reine-Alia', 40)]),
    P('beyrouth', 'Beyrouth', 'Liban', 'LB', 33.8938, 35.5018, 2, 'asie', null, [A('BEY', 'Rafic-Hariri', 25)]),
    P('ankara', 'Ankara', 'Turquie', 'TR', 39.9334, 32.8597, 3, 'eu', R('Ankara Gar', true), [A('ESB', 'Esenboga', 45)]),
    P('izmir', 'Izmir', 'Turquie', 'TR', 38.4237, 27.1428, 3, 'eu', R('Izmir Basmane', false), [A('ADB', 'Adnan-Menderes', 25)]),
    P('antalya', 'Antalya', 'Turquie', 'TR', 36.8969, 30.7133, 3, 'eu', null, [A('AYT', 'Antalya', 20)]),
    P('nairobi', 'Nairobi', 'Kenya', 'KE', -1.2921, 36.8219, 3, 'af', R('Nairobi Terminus', false), [A('NBO', 'Jomo-Kenyatta', 40)]),
    P('lagos', 'Lagos', 'Nigeria', 'NG', 6.5244, 3.3792, 3, 'af', null, [A('LOS', 'Murtala-Muhammed', 45)]),
    P('abidjan', 'Abidjan', 'Cote d Ivoire', 'CI', 5.3600, -4.0083, 3, 'af', null, [A('ABJ', 'Felix-Houphouet-Boigny', 25)]),
    P('accra', 'Accra', 'Ghana', 'GH', 5.6037, -0.1870, 2, 'af', null, [A('ACC', 'Kotoka', 25)]),
    P('addis', 'Addis-Abeba', 'Ethiopie', 'ET', 9.0320, 38.7469, 3, 'af', null, [A('ADD', 'Bole', 30)]),
    P('lecap', 'Le Cap', 'Afrique du Sud', 'ZA', -33.9249, 18.4241, 3, 'af', R('Cape Town', false), [A('CPT', 'Le Cap', 30)]),
    P('maurice', 'Port-Louis', 'Maurice', 'MU', -20.1609, 57.5012, 2, 'maurice', null, [A('MRU', 'Sir-Seewoosagur-Ramgoolam', 50)]),
    P('reunion', 'Saint-Denis', 'La Reunion', 'RE', -20.8789, 55.4481, 2, 'reunion', null, [A('RUN', 'Roland-Garros', 20)]),
    P('antananarivo', 'Antananarivo', 'Madagascar', 'MG', -18.8792, 47.5079, 2, 'madagascar', null, [A('TNR', 'Ivato', 30)]),
    /* --- Asie --- */
    P('bombay', 'Mumbai', 'Inde', 'IN', 19.0760, 72.8777, 4, 'asie', R('Mumbai Central', false), [A('BOM', 'Chhatrapati-Shivaji', 45)]),
    P('bangalore', 'Bengaluru', 'Inde', 'IN', 12.9716, 77.5946, 4, 'asie', R('Bengaluru', false), [A('BLR', 'Kempegowda', 60)]),
    P('colombo', 'Colombo', 'Sri Lanka', 'LK', 6.9271, 79.8612, 2, 'srilanka', R('Colombo Fort', false), [A('CMB', 'Bandaranaike', 45)]),
    P('katmandou', 'Katmandou', 'Nepal', 'NP', 27.7172, 85.3240, 2, 'asie', null, [A('KTM', 'Tribhuvan', 25)]),
    P('hanoi', 'Hanoi', 'Vietnam', 'VN', 21.0285, 105.8542, 3, 'asie', R('Ha Noi', false), [A('HAN', 'Noi Bai', 40)]),
    P('hochiminh', 'Ho Chi Minh-Ville', 'Vietnam', 'VN', 10.8231, 106.6297, 3, 'asie', R('Sai Gon', false), [A('SGN', 'Tan Son Nhat', 30)]),
    P('phnompenh', 'Phnom Penh', 'Cambodge', 'KH', 11.5564, 104.9282, 2, 'asie', null, [A('PNH', 'Phnom Penh', 25)]),
    P('kualalumpur', 'Kuala Lumpur', 'Malaisie', 'MY', 3.1390, 101.6869, 4, 'asie', R('KL Sentral', true), [A('KUL', 'Kuala Lumpur', 50)]),
    P('jakarta', 'Jakarta', 'Indonesie', 'ID', -6.2088, 106.8456, 4, 'java', R('Gambir', true), [A('CGK', 'Soekarno-Hatta', 50)]),
    P('bali', 'Denpasar', 'Indonesie', 'ID', -8.6705, 115.2126, 3, 'bali', null, [A('DPS', 'Ngurah Rai', 25)]),
    P('manille', 'Manille', 'Philippines', 'PH', 14.5995, 120.9842, 3, 'luzon', null, [A('MNL', 'Ninoy-Aquino', 40)]),
    P('taipei', 'Taipei', 'Taiwan', 'TW', 25.0330, 121.5654, 4, 'taiwan', R('Taipei', true), [A('TPE', 'Taoyuan', 45)]),
    P('hongkong', 'Hong Kong', 'Chine', 'HK', 22.3193, 114.1694, 4, 'asie', R('Hong Kong West Kowloon', true), [A('HKG', 'Hong Kong', 40)]),
    P('pekin', 'Pekin', 'Chine', 'CN', 39.9042, 116.4074, 5, 'asie', R('Beijing Nan', true), [A('PEK', 'Pekin-Capitale', 50)]),
    P('canton', 'Canton', 'Chine', 'CN', 23.1291, 113.2644, 4, 'asie', R('Guangzhou Nan', true), [A('CAN', 'Baiyun', 45)]),
    P('chengdu', 'Chengdu', 'Chine', 'CN', 30.5728, 104.0668, 4, 'asie', R('Chengdu Dong', true), [A('CTU', 'Tianfu', 50)]),
    P('osaka', 'Osaka', 'Japon', 'JP', 34.6937, 135.5023, 4, 'jp', R('Shin-Osaka', true), [A('KIX', 'Kansai', 60)]),
    P('fukuoka', 'Fukuoka', 'Japon', 'JP', 33.5904, 130.4017, 3, 'jp', R('Hakata', true), [A('FUK', 'Fukuoka', 20)]),
    P('sapporo', 'Sapporo', 'Japon', 'JP', 43.0618, 141.3545, 3, 'jp', R('Sapporo', true), [A('CTS', 'New Chitose', 45)]),
    P('busan', 'Busan', 'Coree du Sud', 'KR', 35.1796, 129.0756, 3, 'asie', R('Busan', true), [A('PUS', 'Gimhae', 30)]),
    /* --- Oceanie --- */
    P('melbourne', 'Melbourne', 'Australie', 'AU', -37.8136, 144.9631, 4, 'oceanie', R('Southern Cross', false), [A('MEL', 'Melbourne-Tullamarine', 35)]),
    P('brisbane', 'Brisbane', 'Australie', 'AU', -27.4698, 153.0251, 3, 'oceanie', R('Brisbane Roma Street', false), [A('BNE', 'Brisbane', 30)]),
    P('perth', 'Perth', 'Australie', 'AU', -31.9505, 115.8605, 3, 'oceanie', R('Perth', false), [A('PER', 'Perth', 30)]),
    P('auckland', 'Auckland', 'Nouvelle-Zelande', 'NZ', -36.8485, 174.7633, 3, 'nz', R('Auckland Britomart', false), [A('AKL', 'Auckland', 35)]),
    /* --- Ameriques --- */
    P('vancouver', 'Vancouver', 'Canada', 'CA', 49.2827, -123.1207, 4, 'am-n', R('Pacific Central', false), [A('YVR', 'Vancouver', 35)]),
    P('calgary', 'Calgary', 'Canada', 'CA', 51.0447, -114.0719, 3, 'am-n', null, [A('YYC', 'Calgary', 25)]),
    P('ottawa', 'Ottawa', 'Canada', 'CA', 45.4215, -75.6972, 3, 'am-n', R('Ottawa', false), [A('YOW', 'Ottawa-Macdonald-Cartier', 25)]),
    P('quebec', 'Quebec', 'Canada', 'CA', 46.8139, -71.2080, 3, 'am-n', R('Gare du Palais', false), [A('YQB', 'Quebec-Jean-Lesage', 25)]),
    P('chicago', 'Chicago', 'Etats-Unis', 'US', 41.8781, -87.6298, 4, 'am-n', R('Chicago Union Station', false), [A('ORD', 'O Hare', 45)]),
    P('boston', 'Boston', 'Etats-Unis', 'US', 42.3601, -71.0589, 4, 'am-n', R('Boston South Station', false), [A('BOS', 'Logan', 25)]),
    P('washington', 'Washington', 'Etats-Unis', 'US', 38.9072, -77.0369, 4, 'am-n', R('Washington Union Station', false), [A('IAD', 'Dulles', 50), A('DCA', 'Reagan National', 25)]),
    P('atlanta', 'Atlanta', 'Etats-Unis', 'US', 33.7490, -84.3880, 4, 'am-n', null, [A('ATL', 'Hartsfield-Jackson', 30)]),
    P('dallas', 'Dallas', 'Etats-Unis', 'US', 32.7767, -96.7970, 4, 'am-n', null, [A('DFW', 'Dallas-Fort Worth', 35)]),
    P('houston', 'Houston', 'Etats-Unis', 'US', 29.7604, -95.3698, 4, 'am-n', null, [A('IAH', 'George-Bush', 40)]),
    P('denver', 'Denver', 'Etats-Unis', 'US', 39.7392, -104.9903, 3, 'am-n', null, [A('DEN', 'Denver', 45)]),
    P('seattle', 'Seattle', 'Etats-Unis', 'US', 47.6062, -122.3321, 4, 'am-n', R('King Street Station', false), [A('SEA', 'Seattle-Tacoma', 35)]),
    P('lasvegas', 'Las Vegas', 'Etats-Unis', 'US', 36.1699, -115.1398, 3, 'am-n', null, [A('LAS', 'Harry-Reid', 20)]),
    P('orlando', 'Orlando', 'Etats-Unis', 'US', 28.5383, -81.3792, 3, 'am-n', null, [A('MCO', 'Orlando', 30)]),
    P('cancun', 'Cancun', 'Mexique', 'MX', 21.1619, -86.8515, 3, 'am-n', null, [A('CUN', 'Cancun', 30)]),
    P('havane', 'La Havane', 'Cuba', 'CU', 23.1136, -82.3666, 2, 'cuba', null, [A('HAV', 'Jose-Marti', 35)]),
    P('puntacana', 'Punta Cana', 'Republique dominicaine', 'DO', 18.5601, -68.3725, 2, 'hispaniola', null, [A('PUJ', 'Punta Cana', 25)]),
    P('panama', 'Panama', 'Panama', 'PA', 8.9824, -79.5199, 3, 'am-c', null, [A('PTY', 'Tocumen', 35)]),
    P('bogota', 'Bogota', 'Colombie', 'CO', 4.7110, -74.0721, 4, 'am-s', null, [A('BOG', 'El Dorado', 45)]),
    P('lima', 'Lima', 'Perou', 'PE', -12.0464, -77.0428, 4, 'am-s', null, [A('LIM', 'Jorge-Chavez', 40)]),
    P('santiagochili', 'Santiago', 'Chili', 'CL', -33.4489, -70.6693, 4, 'am-s', R('Estacion Central', false), [A('SCL', 'Arturo-Merino-Benitez', 35)]),
    P('rio', 'Rio de Janeiro', 'Bresil', 'BR', -22.9068, -43.1729, 4, 'am-s', null, [A('GIG', 'Galeao', 45)]),
    P('montevideo', 'Montevideo', 'Uruguay', 'UY', -34.9011, -56.1645, 2, 'am-s', null, [A('MVD', 'Carrasco', 30)])
  ];

  /* --- gares supplementaires ------------------------------------------------
     Gares parisiennes, gares nouvelles a l'ecart des centres (Aix TGV, Lyon
     Saint-Exupery, Avignon TGV...) et secondes gares des grandes villes. Le
     moteur retient pour chaque relation la gare la mieux adaptee au service. */
  T.EXTRA_STATIONS = {
    paris: [
      S('Paris Gare de Lyon', 48.8443, 2.3744, true, 18, ['se', 'CH', 'IT', 'ES', 'MC']),
      S('Paris Gare du Nord', 48.8809, 2.3553, true, 16, ['nord', 'GB', 'BE', 'NL']),
      S('Paris Montparnasse', 48.8414, 2.3200, true, 18, ['ouest', 'at']),
      S('Paris Gare de l Est', 48.8768, 2.3592, true, 17, ['est', 'DE', 'LU', 'AT', 'CZ', 'PL', 'HU']),
      S('Paris Austerlitz', 48.8422, 2.3654, false, 18, ['at']),
      S('Paris Saint-Lazare', 48.8757, 2.3253, false, 15, ['ouest']),
      S('Paris Bercy', 48.8395, 2.3822, false, 20, ['se']),
      S('Marne-la-Vallee Chessy TGV', 48.8697, 2.7828, true, 45),
      S('Aeroport CDG 2 TGV', 49.0044, 2.5711, true, 50),
      S('Massy TGV', 48.7256, 2.2611, true, 35)
    ],
    lyon: [
      S('Lyon Part-Dieu', 45.7605, 4.8595, true, 12),
      S('Lyon Perrache', 45.7492, 4.8261, false, 15),
      S('Lyon Saint-Exupery TGV', 45.7207, 5.0757, true, 40)
    ],
    marseille: [S('Marseille Saint-Charles', 43.3025, 5.3806, true, 12)],
    avignon: [
      S('Avignon TGV', 43.9214, 4.7861, true, 20),
      S('Avignon Centre', 43.9425, 4.8033, false, 10)
    ],
    nimes: [
      S('Nimes Pont-du-Gard', 43.7897, 4.3931, true, 22),
      S('Nimes Centre', 43.8322, 4.3653, false, 10)
    ],
    montpellier: [
      S('Montpellier Saint-Roch', 43.6047, 3.8803, true, 10),
      S('Montpellier Sud de France', 43.5800, 3.9264, true, 25)
    ],
    valencefr: [
      S('Valence TGV', 44.9917, 4.9783, true, 20),
      S('Valence Ville', 44.9264, 4.8944, false, 10)
    ],
    aix: [
      S('Aix-en-Provence TGV', 43.4553, 5.3172, true, 20),
      S('Aix-en-Provence Centre', 43.5253, 5.4453, false, 10)
    ],
    tours: [
      S('Saint-Pierre-des-Corps', 47.3872, 0.7169, true, 15),
      S('Tours Centre', 47.3897, 0.6939, false, 8)
    ],
    lille: [
      S('Lille Europe', 50.6394, 3.0758, true, 12),
      S('Lille Flandres', 50.6367, 3.0703, false, 10)
    ],
    reims: [
      S('Reims Centre', 49.2586, 4.0247, false, 10),
      S('Champagne-Ardenne TGV', 49.2153, 4.0139, true, 18)
    ],
    metz: [
      S('Metz-Ville', 49.1097, 6.1775, false, 10),
      S('Lorraine TGV', 48.9472, 6.1694, true, 30)
    ],
    besancon: [
      S('Besancon Viotte', 47.2472, 6.0219, false, 10),
      S('Besancon Franche-Comte TGV', 47.3078, 5.9556, true, 20)
    ],
    poitiers: [S('Poitiers', 46.5817, 0.3331, true, 10)],
    lemans: [S('Le Mans', 48.0069, 0.1925, true, 10)],
    londres: [
      S('London St Pancras International', 51.5320, -0.1264, true, 20, ['FR', 'BE', 'NL', 'DE']),
      S('London Euston', 51.5282, -0.1337, true, 20, ['gb-ouest']),
      S('London King s Cross', 51.5308, -0.1238, true, 20, ['gb-est']),
      S('London Paddington', 51.5154, -0.1755, true, 22, ['gb-sudouest'])
    ],
    bruxelles: [
      S('Bruxelles-Midi', 50.8358, 4.3358, true, 15),
      S('Bruxelles-Central', 50.8456, 4.3572, false, 12)
    ],
    berlin: [
      S('Berlin Hauptbahnhof', 52.5250, 13.3694, true, 15),
      S('Berlin Sudkreuz', 52.4756, 13.3653, true, 20)
    ],
    munich: [S('Munchen Hauptbahnhof', 48.1403, 11.5583, true, 12)],
    francfort: [
      S('Frankfurt Hauptbahnhof', 50.1069, 8.6636, true, 12),
      S('Frankfurt Flughafen Fernbahnhof', 50.0530, 8.5706, true, 25)
    ],
    milan: [
      S('Milano Centrale', 45.4869, 9.2039, true, 12),
      S('Milano Porta Garibaldi', 45.4847, 9.1878, true, 12)
    ],
    rome: [
      S('Roma Termini', 41.9011, 12.5019, true, 12),
      S('Roma Tiburtina', 41.9106, 12.5303, true, 18)
    ],
    madrid: [
      S('Madrid Puerta de Atocha', 40.4067, -3.6906, true, 15),
      S('Madrid Chamartin', 40.4722, -3.6822, true, 20)
    ],
    barcelone: [
      S('Barcelona Sants', 41.3792, 2.1400, true, 12),
      S('Barcelona La Sagrera', 41.4200, 2.1900, true, 18)
    ],
    zurich: [S('Zurich Hauptbahnhof', 47.3779, 8.5403, true, 10)],
    amsterdam: [
      S('Amsterdam Centraal', 52.3789, 4.9003, true, 12),
      S('Amsterdam Zuid', 52.3389, 4.8731, true, 18)
    ],
    naples: [S('Napoli Centrale', 40.8522, 14.2725, true, 12)],
    turin: [
      S('Torino Porta Nuova', 45.0619, 7.6783, true, 10),
      S('Torino Porta Susa', 45.0725, 7.6656, true, 12)
    ],
    tokyo: [
      S('Tokyo', 35.6812, 139.7671, true, 20),
      S('Shinagawa', 35.6285, 139.7387, true, 20)
    ],
    shanghai: [
      S('Shanghai Hongqiao', 31.1944, 121.3200, true, 40),
      S('Shanghai', 31.2497, 121.4550, true, 15)
    ],
    newyork: [S('New York Penn Station', 40.7506, -73.9936, false, 20)],
    casablanca: [S('Casa-Voyageurs', 33.5892, -7.5806, true, 15)],
    tanger: [S('Tanger Ville', 35.7686, -5.7997, true, 15)]
  };

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
    mulhouse: 'est', calais: 'nord', amiens: 'nord',
    aix: 'se', valencefr: 'se', poitiers: 'at', lemans: 'ouest', lorient: 'ouest',
    /* Royaume-Uni : les grandes radiales au depart de Londres */
    manchester: 'gb-ouest', glasgow: 'gb-ouest', birmingham: 'gb-ouest',
    edimbourg: 'gb-est', bristol: 'gb-sudouest',
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
    { a: 'eu', b: 'fi', car: { extraMin: 150, extraCost: 90, label: 'Ferry Stockholm - Helsinki' }, rail: false },
    { a: 'eu', b: 'sicile', car: { extraMin: 60, extraCost: 55, label: 'Ferry de Messine' }, rail: true },
    { a: 'eu', b: 'sardaigne', car: { extraMin: 420, extraCost: 160, label: 'Ferry vers la Sardaigne' }, rail: false },
    { a: 'eu', b: 'malte', car: { extraMin: 300, extraCost: 130, label: 'Ferry vers Malte' }, rail: false },
    { a: 'eu', b: 'crete', car: { extraMin: 540, extraCost: 120, label: 'Ferry vers la Crete' }, rail: false },
    { a: 'eu', b: 'ibiza', car: { extraMin: 360, extraCost: 150, label: 'Ferry vers Ibiza' }, rail: false },
    { a: 'canaries', b: 'canaries-o', car: { extraMin: 150, extraCost: 60, label: 'Ferry inter-iles' }, rail: false },
    { a: 'am-n', b: 'am-c', car: { extraMin: 0, extraCost: 0, label: 'Route continue' }, rail: false },
    { a: 'java', b: 'bali', car: { extraMin: 90, extraCost: 25, label: 'Ferry Java - Bali' }, rail: false }
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

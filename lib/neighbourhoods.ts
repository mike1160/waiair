/**
 * The neighbourhoods offered per arrival airport ("Restaurants & wijken" on the flight detail page).
 * A curated list, not a lookup: these are the areas a traveller actually eats in, in the order we'd suggest them.
 * Hardcoded on purpose — no API, no network, no key. A city we have no list for falls back to one
 * "Explore {city}" chip that opens Google Maps.
 *
 * One entry per city, and AIRPORT_CITY points every arrival airport at it, so a city with two airports
 * (Tokyo, London, Seoul, Milan, New York, Washington) cannot drift apart.
 */

type City = {
  /** The city name Google gets next to the neighbourhood; the airport's own city is only a fallback. */
  name: string;
  areas: string[];
};

const CITIES: Record<string, City> = {
  bangkok: { name: 'Bangkok', areas: ['Sukhumvit', 'Silom', 'Chinatown', 'Khao San Road', 'Ari', 'Thonglor'] },
  dubai: { name: 'Dubai', areas: ['Downtown', 'Marina', 'Deira', 'JBR', 'Business Bay', 'Old Dubai'] },
  amsterdam: { name: 'Amsterdam', areas: ['Jordaan', 'De Pijp', 'Centrum', 'Oud-Zuid', 'NDSM', 'Westerpark'] },
  singapore: { name: 'Singapore', areas: ['Clarke Quay', 'Chinatown', 'Little India', 'Orchard', 'Tiong Bahru'] },
  tokyo: { name: 'Tokyo', areas: ['Shinjuku', 'Shibuya', 'Ginza', 'Asakusa', 'Shimokitazawa', 'Nakameguro'] },
  london: { name: 'London', areas: ['Soho', 'Shoreditch', 'Notting Hill', 'Borough Market', 'Mayfair', 'Camden'] },
  paris: { name: 'Paris', areas: ['Le Marais', 'Montmartre', 'Saint-Germain', 'Oberkampf', 'Bastille', 'Canal Saint-Martin'] },
  phuket: { name: 'Phuket', areas: ['Patong', 'Old Town', 'Kata', 'Karon', 'Rawai', 'Kamala'] },
  // "Nimmanhaemin" is the full name of Nimman, so it is one chip, not two.
  chiangmai: { name: 'Chiang Mai', areas: ['Nimman', 'Old City', 'Santitham', 'Night Bazaar'] },
  kualalumpur: { name: 'Kuala Lumpur', areas: ['KLCC', 'Bukit Bintang', 'Bangsar', 'Chow Kit', 'Petaling Street', 'Mont Kiara'] },
  hongkong: { name: 'Hong Kong', areas: ['Mong Kok', 'Tsim Sha Tsui', 'Central', 'Wan Chai', 'Causeway Bay', 'Lan Kwai Fong'] },
  bali: { name: 'Bali', areas: ['Seminyak', 'Kuta', 'Ubud', 'Canggu', 'Nusa Dua', 'Sanur'] },
  seoul: { name: 'Seoul', areas: ['Gangnam', 'Hongdae', 'Itaewon', 'Myeongdong', 'Insadong', 'Bukchon'] },
  taipei: { name: 'Taipei', areas: ['Xinyi', 'Da\'an', 'Zhongshan', 'Gongguan', 'Shilin', 'Yongkang Street'] },
  hochiminh: { name: 'Ho Chi Minh City', areas: ['District 1', 'District 3', 'Bui Vien', 'Phu My Hung', 'Binh Thanh', 'Thu Duc'] },
  hanoi: { name: 'Hanoi', areas: ['Old Quarter', 'Hoan Kiem', 'Tay Ho', 'Ba Dinh', 'Dong Da', 'Long Bien'] },
  phnompenh: { name: 'Phnom Penh', areas: ['BKK1', 'Riverside', 'Toul Tom Poung', 'Daun Penh', 'Chamkarmon', 'Toul Kork'] },
  siemreap: { name: 'Siem Reap', areas: ['Pub Street', 'Old Market', 'Wat Bo', 'Svay Dangkum', 'Sala Kamreuk', 'Airport Road'] },
  yangon: { name: 'Yangon', areas: ['Downtown', 'Bahan', 'Yankin', 'Dagon', 'Sanchaung', 'Hlaing'] },
  jakarta: { name: 'Jakarta', areas: ['Kemang', 'SCBD', 'Menteng', 'Kelapa Gading', 'PIK', 'Senopati'] },
  surabaya: { name: 'Surabaya', areas: ['Darmo', 'Gubeng', 'Rungkut', 'Tunjungan', 'Pakuwon', 'Kenjeran'] },
  medan: { name: 'Medan', areas: ['Sunggal', 'Helvetia', 'Medan Baru', 'Polonia', 'Petisah', 'Simpang Raya'] },
  manila: { name: 'Manila', areas: ['BGC', 'Makati', 'Intramuros', 'Poblacion', 'Ermita', 'Quezon City'] },
  cebu: { name: 'Cebu', areas: ['IT Park', 'Ayala', 'Colon', 'Lahug', 'Mactan', 'Talamban'] },
  colombo: { name: 'Colombo', areas: ['Colombo 3', 'Kollupitiya', 'Pettah', 'Bambalapitiya', 'Nugegoda', 'Mount Lavinia'] },
  male: { name: 'Male', areas: ['Hulhumale', 'Maafushi', 'Rasdhoo', 'Mahibadhoo', 'Ukulhas', 'Fuvahmulah'] },
  kathmandu: { name: 'Kathmandu', areas: ['Thamel', 'Patan', 'Bhaktapur', 'Boudha', 'Lazimpat', 'New Road'] },
  dhaka: { name: 'Dhaka', areas: ['Gulshan', 'Banani', 'Dhanmondi', 'Uttara', 'Bashundhara', 'Old Dhaka'] },
  mumbai: { name: 'Mumbai', areas: ['Bandra', 'Colaba', 'Juhu', 'Lower Parel', 'Andheri', 'Fort'] },
  delhi: { name: 'Delhi', areas: ['Connaught Place', 'Hauz Khas', 'Lodi Colony', 'Karol Bagh', 'Saket', 'Chandni Chowk'] },
  bangalore: { name: 'Bangalore', areas: ['Indiranagar', 'Koramangala', 'Whitefield', 'HSR Layout', 'Jayanagar', 'MG Road'] },
  chennai: { name: 'Chennai', areas: ['T Nagar', 'Adyar', 'Anna Nagar', 'Nungambakkam', 'Mylapore', 'Velachery'] },
  hyderabad: { name: 'Hyderabad', areas: ['Banjara Hills', 'Jubilee Hills', 'Hitech City', 'Madhapur', 'Secunderabad', 'Gachibowli'] },
  kolkata: { name: 'Kolkata', areas: ['Park Street', 'Salt Lake', 'New Town', 'Ballygunge', 'Howrah', 'Gariahat'] },
  goa: { name: 'Goa', areas: ['Panaji', 'Calangute', 'Baga', 'Anjuna', 'Colva', 'Margao'] },
  osaka: { name: 'Osaka', areas: ['Dotonbori', 'Namba', 'Umeda', 'Shinsekai', 'Tennoji', 'Shinsaibashi'] },
  kyoto: { name: 'Kyoto', areas: ['Gion', 'Arashiyama', 'Higashiyama', 'Fushimi', 'Nishiki', 'Kawaramachi'] },
  fukuoka: { name: 'Fukuoka', areas: ['Tenjin', 'Hakata', 'Nakasu', 'Ohori', 'Daimyo', 'Momochi'] },
  sapporo: { name: 'Sapporo', areas: ['Susukino', 'Odori', 'Sapporo Station', 'Maruyama', 'Nishi', 'Kotoni'] },
  beijing: { name: 'Beijing', areas: ['Sanlitun', 'Wangfujing', 'Hutongs', 'Chaoyang', 'Zhongguancun', '798 Art District'] },
  shanghai: { name: 'Shanghai', areas: ['The Bund', 'French Concession', 'Xintiandi', 'Jing\'an', 'Pudong', 'Tianzifang'] },
  guangzhou: { name: 'Guangzhou', areas: ['Tianhe', 'Haizhu', 'Yuexiu', 'Liwan', 'Zhujiang New Town', 'Baiyun'] },
  shenzhen: { name: 'Shenzhen', areas: ['Nanshan', 'Futian', 'Luohu', 'Longhua', 'Bao\'an', 'Longgang'] },
  chengdu: { name: 'Chengdu', areas: ['Kuanzhai Alley', 'Chunxi Road', 'Tianfu', 'Wuhou', 'Jinjiang', 'Pidu'] },
  xian: { name: 'Xi\'an', areas: ['Muslim Quarter', 'Bell Tower', 'High Tech Zone', 'Yanta', 'Beilin', 'Lianhu'] },
  macau: { name: 'Macau', areas: ['Cotai', 'Taipa', 'Historic Centre', 'Coloane', 'Outer Harbour', 'Zhuhai Border'] },
  abudhabi: { name: 'Abu Dhabi', areas: ['Corniche', 'Yas Island', 'Saadiyat', 'Al Reem', 'Downtown', 'Al Maryah'] },
  doha: { name: 'Doha', areas: ['The Pearl', 'West Bay', 'Souq Waqif', 'Lusail', 'Al Wakrah', 'Al Sadd'] },
  riyadh: { name: 'Riyadh', areas: ['Al Olaya', 'Diplomatic Quarter', 'Al Malaz', 'Al Sulimaniyah', 'Exit 7', 'Al Nakheel'] },
  jeddah: { name: 'Jeddah', areas: ['Al Balad', 'Al Hamra', 'Obhur', 'Al Zahra', 'Al Rawdah', 'Al Andalus'] },
  kuwaitcity: { name: 'Kuwait City', areas: ['Salmiya', 'Hawalli', 'Fahaheel', 'Nugra', 'Rumaithiya', 'Bayan'] },
  muscat: { name: 'Muscat', areas: ['Muttrah', 'Qurum', 'Al Khuwair', 'Madinat Sultan Qaboos', 'Ruwi', 'Shatti Al Qurum'] },
  beirut: { name: 'Beirut', areas: ['Gemmayzeh', 'Mar Mikhael', 'Hamra', 'Achrafieh', 'Verdun', 'Downtown'] },
  amman: { name: 'Amman', areas: ['Rainbow Street', 'Abdoun', 'Sweifieh', 'Jabal Amman', 'Shmeisani', 'Wadi Seer'] },
  telaviv: { name: 'Tel Aviv', areas: ['Florentin', 'Neve Tzedek', 'Rothschild', 'Dizengoff', 'Jaffa', 'Carmel Market'] },
  barcelona: { name: 'Barcelona', areas: ['Gothic Quarter', 'Eixample', 'Gracia', 'Barceloneta', 'El Born', 'Poblenou'] },
  madrid: { name: 'Madrid', areas: ['Malasana', 'Chueca', 'La Latina', 'Salamanca', 'Lavapies', 'Sol'] },
  rome: { name: 'Rome', areas: ['Trastevere', 'Monti', 'Prati', 'Pigneto', 'Testaccio', 'Centro Storico'] },
  milan: { name: 'Milan', areas: ['Navigli', 'Brera', 'Isola', 'Porta Venezia', 'Moscova', 'Prati'] },
  venice: { name: 'Venice', areas: ['San Marco', 'Cannaregio', 'Dorsoduro', 'Castello', 'Santa Croce', 'Giudecca'] },
  florence: { name: 'Florence', areas: ['Oltrarno', 'Santa Croce', 'San Lorenzo', 'Pitti', 'Duomo', 'Le Cure'] },
  naples: { name: 'Naples', areas: ['Spaccanapoli', 'Chiaia', 'Vomero', 'Posillipo', 'Pozzuoli', 'Bagnoli'] },
  lisbon: { name: 'Lisbon', areas: ['Alfama', 'Bairro Alto', 'Chiado', 'LX Factory', 'Belem', 'Mouraria'] },
  porto: { name: 'Porto', areas: ['Ribeira', 'Baixa', 'Foz', 'Bonfim', 'Cedofeita', 'Massarelos'] },
  berlin: { name: 'Berlin', areas: ['Mitte', 'Kreuzberg', 'Prenzlauer Berg', 'Friedrichshain', 'Neukölln', 'Charlottenburg'] },
  munich: { name: 'Munich', areas: ['Marienplatz', 'Schwabing', 'Maxvorstadt', 'Glockenbachviertel', 'Haidhausen', 'Bogenhausen'] },
  hamburg: { name: 'Hamburg', areas: ['Altona', 'Schanzenviertel', 'HafenCity', 'Eppendorf', 'St Pauli', 'Winterhude'] },
  frankfurt: { name: 'Frankfurt', areas: ['Sachsenhausen', 'Bornheim', 'Westend', 'Nordend', 'Bockenheim', 'Innenstadt'] },
  vienna: { name: 'Vienna', areas: ['Innere Stadt', 'Naschmarkt', 'Prater', 'Neubau', 'Mariahilf', 'Leopoldstadt'] },
  zurich: { name: 'Zurich', areas: ['Altstadt', 'Langstrasse', 'Zurich West', 'Seefeld', 'Wiedikon', 'Oerlikon'] },
  geneva: { name: 'Geneva', areas: ['Old Town', 'Eaux-Vives', 'Plainpalais', 'Champel', 'Carouge', 'Paquis'] },
  brussels: { name: 'Brussels', areas: ['Ixelles', 'Saint-Gilles', 'Schaerbeek', 'Etterbeek', 'Molenbeek', 'Uccle'] },
  copenhagen: { name: 'Copenhagen', areas: ['Nørrebro', 'Vesterbro', 'Frederiksberg', 'Christianshavn', 'Østerbro', 'Indre By'] },
  stockholm: { name: 'Stockholm', areas: ['Gamla Stan', 'Södermalm', 'Östermalm', 'Vasastan', 'Kungsholmen', 'Djurgården'] },
  oslo: { name: 'Oslo', areas: ['Aker Brygge', 'Grünerløkka', 'Frogner', 'Majorstuen', 'Bygdøy', 'Tøyen'] },
  helsinki: { name: 'Helsinki', areas: ['Kallio', 'Punavuori', 'Ullanlinna', 'Töölö', 'Kamppi', 'Kruununhaka'] },
  dublin: { name: 'Dublin', areas: ['Temple Bar', 'Portobello', 'Ranelagh', 'Docklands', 'Phibsborough', 'Rathmines'] },
  edinburgh: { name: 'Edinburgh', areas: ['Old Town', 'New Town', 'Leith', 'Stockbridge', 'Bruntsfield', 'Morningside'] },
  prague: { name: 'Prague', areas: ['Old Town', 'Vinohrady', 'Zizkov', 'Mala Strana', 'Holesovice', 'Dejvice'] },
  warsaw: { name: 'Warsaw', areas: ['Old Town', 'Praga', 'Mokotów', 'Śródmieście', 'Żoliborz', 'Ursynów'] },
  budapest: { name: 'Budapest', areas: ['Pest Downtown', 'Buda Castle', 'Jewish Quarter', 'Andrassy', 'Obuda', 'Margit Island'] },
  athens: { name: 'Athens', areas: ['Monastiraki', 'Plaka', 'Psiri', 'Kolonaki', 'Exarchia', 'Kifisia'] },
  santorini: { name: 'Santorini', areas: ['Oia', 'Fira', 'Imerovigli', 'Perissa', 'Kamari', 'Megalochori'] },
  mykonos: { name: 'Mykonos', areas: ['Mykonos Town', 'Paradise Beach', 'Super Paradise', 'Ornos', 'Platis Gialos', 'Ano Mera'] },
  dubrovnik: { name: 'Dubrovnik', areas: ['Old City', 'Lapad', 'Pile', 'Gruž', 'Babin Kuk', 'Ploče'] },
  split: { name: 'Split', areas: ['Old Town', 'Meje', 'Spinut', 'Bacvice', 'Solin', 'Trogir'] },
  reykjavik: { name: 'Reykjavik', areas: ['Downtown', 'Laugavegur', 'Grandi', 'Hlemmur', 'Vesturbær', 'Breiðholt'] },
  tallinn: { name: 'Tallinn', areas: ['Old Town', 'Kalamaja', 'Telliskivi', 'Kadriorg', 'Pirita', 'Lasnamäe'] },
  riga: { name: 'Riga', areas: ['Old Town', 'Art Nouveau District', 'Quiet Centre', 'Mežaparks', 'Āgenskalns', 'Teika'] },
  krakow: { name: 'Krakow', areas: ['Old Town', 'Kazimierz', 'Nowa Huta', 'Podgórze', 'Krowodrza', 'Bronowice'] },
  cairo: { name: 'Cairo', areas: ['Zamalek', 'Maadi', 'Downtown', 'Khan el-Khalili', 'Heliopolis', 'New Cairo'] },
  marrakech: { name: 'Marrakech', areas: ['Medina', 'Gueliz', 'Hivernage', 'Palmeraie', 'Mellah', 'Agdal'] },
  casablanca: { name: 'Casablanca', areas: ['Ain Diab', 'Maarif', 'Racine', 'Anfa', 'Bourgogne', 'Derb Omar'] },
  nairobi: { name: 'Nairobi', areas: ['Westlands', 'Karen', 'Kilimani', 'CBD', 'Lavington', 'Gigiri'] },
  capetown: { name: 'Cape Town', areas: ['V&A Waterfront', 'Bo-Kaap', 'De Waterkant', 'Camps Bay', 'Woodstock', 'Gardens'] },
  johannesburg: { name: 'Johannesburg', areas: ['Sandton', 'Maboneng', 'Rosebank', 'Melville', 'Soweto', 'Fourways'] },
  lagos: { name: 'Lagos', areas: ['Victoria Island', 'Lekki', 'Ikoyi', 'Ikeja', 'Surulere', 'Yaba'] },
  accra: { name: 'Accra', areas: ['Osu', 'Labone', 'Airport Residential', 'East Legon', 'Adabraka', 'Jamestown'] },
  daressalaam: { name: 'Dar es Salaam', areas: ['Masaki', 'Oyster Bay', 'Msasani', 'CBD', 'Kariakoo', 'Kinondoni'] },
  addisababa: { name: 'Addis Ababa', areas: ['Bole', 'Kazanchis', 'Piassa', 'Mercato', 'Lideta', 'CMC'] },
  newyork: { name: 'New York', areas: ['Brooklyn', 'Lower East Side', 'West Village', 'Williamsburg', 'Harlem', 'Astoria'] },
  losangeles: { name: 'Los Angeles', areas: ['Silver Lake', 'Venice', 'Los Feliz', 'Echo Park', 'West Hollywood', 'Arts District'] },
  miami: { name: 'Miami', areas: ['Wynwood', 'South Beach', 'Little Havana', 'Design District', 'Brickell', 'Coconut Grove'] },
  chicago: { name: 'Chicago', areas: ['Wicker Park', 'Lincoln Park', 'River North', 'Logan Square', 'Pilsen', 'Hyde Park'] },
  sanfrancisco: { name: 'San Francisco', areas: ['Mission District', 'Castro', 'Hayes Valley', 'North Beach', 'Haight', 'Noe Valley'] },
  lasvegas: { name: 'Las Vegas', areas: ['The Strip', 'Downtown', 'Arts District', 'Summerlin', 'Henderson', 'Paradise'] },
  neworleans: { name: 'New Orleans', areas: ['French Quarter', 'Garden District', 'Marigny', 'Bywater', 'Uptown', 'Mid-City'] },
  nashville: { name: 'Nashville', areas: ['Broadway', 'East Nashville', 'Gulch', 'Germantown', '12 South', 'Hillsboro Village'] },
  austin: { name: 'Austin', areas: ['South Congress', 'East Austin', 'Downtown', 'Hyde Park', 'Rainey Street', 'Mueller'] },
  seattle: { name: 'Seattle', areas: ['Capitol Hill', 'Fremont', 'Ballard', 'Pioneer Square', 'South Lake Union', 'Queen Anne'] },
  boston: { name: 'Boston', areas: ['Back Bay', 'South End', 'Cambridge', 'Beacon Hill', 'Fenway', 'Jamaica Plain'] },
  washington: { name: 'Washington DC', areas: ['Georgetown', 'Dupont Circle', 'Adams Morgan', 'Capitol Hill', 'Shaw', 'Navy Yard'] },
  toronto: { name: 'Toronto', areas: ['Kensington Market', 'Distillery District', 'Queen West', 'Yorkville', 'Little Italy', 'Leslieville'] },
  vancouver: { name: 'Vancouver', areas: ['Gastown', 'Kitsilano', 'Commercial Drive', 'Yaletown', 'Mount Pleasant', 'West End'] },
  montreal: { name: 'Montreal', areas: ['Plateau', 'Mile End', 'Old Montreal', 'Griffintown', 'NDG', 'Rosemont'] },
  mexicocity: { name: 'Mexico City', areas: ['Condesa', 'Roma Norte', 'Polanco', 'Coyoacan', 'Centro Historico', 'Juarez'] },
  cancun: { name: 'Cancun', areas: ['Hotel Zone', 'Downtown', 'Puerto Morelos', 'Playa del Carmen', 'Tulum', 'Isla Mujeres'] },
  saopaulo: { name: 'São Paulo', areas: ['Vila Madalena', 'Jardins', 'Pinheiros', 'Itaim Bibi', 'Liberdade', 'Consolação'] },
  riodejaneiro: { name: 'Rio de Janeiro', areas: ['Ipanema', 'Copacabana', 'Santa Teresa', 'Lapa', 'Botafogo', 'Leblon'] },
  buenosaires: { name: 'Buenos Aires', areas: ['Palermo', 'San Telmo', 'Recoleta', 'Belgrano', 'Villa Crespo', 'Microcentro'] },
  lima: { name: 'Lima', areas: ['Miraflores', 'Barranco', 'San Isidro', 'Magdalena', 'Surco', 'Centro Historico'] },
  bogota: { name: 'Bogota', areas: ['Zona Rosa', 'Usaquen', 'La Candelaria', 'Chapinero', 'Teusaquillo', 'Galerias'] },
  medellin: { name: 'Medellin', areas: ['El Poblado', 'Laureles', 'Envigado', 'Bello', 'Sabaneta', 'Estadio'] },
  santiago: { name: 'Santiago', areas: ['Providencia', 'Bellavista', 'Las Condes', 'Vitacura', 'Miraflores', 'Barrio Italia'] },
  havana: { name: 'Havana', areas: ['Old Havana', 'Vedado', 'Miramar', 'Centro Habana', 'Playa', 'Cerro'] },
  sydney: { name: 'Sydney', areas: ['Darling Harbour', 'The Rocks', 'Newtown', 'Surry Hills', 'Bondi', 'Glebe'] },
  melbourne: { name: 'Melbourne', areas: ['Fitzroy', 'Collingwood', 'St Kilda', 'South Yarra', 'Brunswick', 'Richmond'] },
  brisbane: { name: 'Brisbane', areas: ['South Bank', 'Fortitude Valley', 'New Farm', 'West End', 'Teneriffe', 'Paddington'] },
  goldcoast: { name: 'Gold Coast', areas: ['Surfers Paradise', 'Broadbeach', 'Burleigh Heads', 'Coolangatta', 'Hope Island', 'Robina'] },
  auckland: { name: 'Auckland', areas: ['Ponsonby', 'Parnell', 'Mount Eden', 'Grey Lynn', 'Takapuna', 'Newmarket'] },
  queenstown: { name: 'Queenstown', areas: ['Queenstown CBD', 'Frankton', 'Arrowtown', 'Glenorchy', 'Wanaka', 'Jack\'s Point'] },
  moscow: { name: 'Moscow', areas: ['Arbat', 'Zamoskvorechye', 'Patriarch Ponds', 'Chistye Prudy', 'Khamovniki', 'Sokolniki'] },
  stpetersburg: { name: 'St Petersburg', areas: ['Nevsky Prospekt', 'Vasilyevsky Island', 'Petrogradsky', 'Vyborg Side', 'Admiralteysky', 'Moskovsky'] },
  almaty: { name: 'Almaty', areas: ['Medeu', 'Alatau', 'Bostandyk', 'Almaly', 'Zhetysu', 'Nauryzbay'] },
};

/** Arrival airport → the city whose neighbourhoods it serves. */
const AIRPORT_CITY: Record<string, string> = {
  BKK: 'bangkok',
  DXB: 'dubai',
  AMS: 'amsterdam',
  SIN: 'singapore',
  NRT: 'tokyo', HND: 'tokyo',
  LHR: 'london', LGW: 'london',
  CDG: 'paris',
  HKT: 'phuket',
  CNX: 'chiangmai',
  KUL: 'kualalumpur',
  HKG: 'hongkong',
  DPS: 'bali',
  ICN: 'seoul', GMP: 'seoul',
  TPE: 'taipei',
  SGN: 'hochiminh',
  HAN: 'hanoi',
  PNH: 'phnompenh',
  REP: 'siemreap',
  RGN: 'yangon',
  CGK: 'jakarta',
  SUB: 'surabaya',
  KNO: 'medan',
  MNL: 'manila',
  CEB: 'cebu',
  CMB: 'colombo',
  MLE: 'male',
  KTM: 'kathmandu',
  DAC: 'dhaka',
  BOM: 'mumbai',
  DEL: 'delhi',
  BLR: 'bangalore',
  MAA: 'chennai',
  HYD: 'hyderabad',
  CCU: 'kolkata',
  GOI: 'goa',
  KIX: 'osaka',
  ITM: 'kyoto',
  FUK: 'fukuoka',
  CTS: 'sapporo',
  PEK: 'beijing',
  PVG: 'shanghai',
  CAN: 'guangzhou',
  SZX: 'shenzhen',
  CTU: 'chengdu',
  XIY: 'xian',
  MFM: 'macau',
  AUH: 'abudhabi',
  DOH: 'doha',
  RUH: 'riyadh',
  JED: 'jeddah',
  KWI: 'kuwaitcity',
  MCT: 'muscat',
  BEY: 'beirut',
  AMM: 'amman',
  TLV: 'telaviv',
  BCN: 'barcelona',
  MAD: 'madrid',
  FCO: 'rome',
  MXP: 'milan', LIN: 'milan',
  VCE: 'venice',
  FLR: 'florence',
  NAP: 'naples',
  LIS: 'lisbon',
  OPO: 'porto',
  BER: 'berlin',
  MUC: 'munich',
  HAM: 'hamburg',
  FRA: 'frankfurt',
  VIE: 'vienna',
  ZRH: 'zurich',
  GVA: 'geneva',
  BRU: 'brussels',
  CPH: 'copenhagen',
  ARN: 'stockholm',
  OSL: 'oslo',
  HEL: 'helsinki',
  DUB: 'dublin',
  EDI: 'edinburgh',
  PRG: 'prague',
  WAW: 'warsaw',
  BUD: 'budapest',
  ATH: 'athens',
  JTR: 'santorini',
  JMK: 'mykonos',
  DBV: 'dubrovnik',
  SPU: 'split',
  KEF: 'reykjavik',
  TLL: 'tallinn',
  RIX: 'riga',
  KRK: 'krakow',
  CAI: 'cairo',
  RAK: 'marrakech',
  CMN: 'casablanca',
  NBO: 'nairobi',
  CPT: 'capetown',
  JNB: 'johannesburg',
  LOS: 'lagos',
  ACC: 'accra',
  DAR: 'daressalaam',
  ADD: 'addisababa',
  JFK: 'newyork', EWR: 'newyork',
  LAX: 'losangeles',
  MIA: 'miami',
  ORD: 'chicago',
  SFO: 'sanfrancisco',
  LAS: 'lasvegas',
  MSY: 'neworleans',
  BNA: 'nashville',
  AUS: 'austin',
  SEA: 'seattle',
  BOS: 'boston',
  IAD: 'washington', DCA: 'washington',
  YYZ: 'toronto',
  YVR: 'vancouver',
  YUL: 'montreal',
  MEX: 'mexicocity',
  CUN: 'cancun',
  GRU: 'saopaulo',
  GIG: 'riodejaneiro',
  EZE: 'buenosaires',
  LIM: 'lima',
  BOG: 'bogota',
  MDE: 'medellin',
  SCL: 'santiago',
  HAV: 'havana',
  SYD: 'sydney',
  MEL: 'melbourne',
  BNE: 'brisbane',
  OOL: 'goldcoast',
  AKL: 'auckland',
  ZQN: 'queenstown',
  SVO: 'moscow',
  LED: 'stpetersburg',
  ALA: 'almaty',
};

function clean(raw?: string | null): string {
  return String(raw || '').trim().replace(/\s+/g, ' ');
}

function iataKey(raw?: string | null): string {
  const s = clean(raw).toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : '';
}

/** The curated city for an arrival airport, or null when we have none. */
function cityFor(iata?: string | null): City | null {
  const slug = AIRPORT_CITY[iataKey(iata)];
  return (slug && CITIES[slug]) || null;
}

/** The city label for the section, from the curated name or the airport's own city. */
export function neighbourhoodCity(iata?: string | null, fallbackCity?: string | null): string {
  return cityFor(iata)?.name || clean(fallbackCity);
}

export type NeighbourhoodChip =
  /** A curated area: tapping it loads restaurants in the app. */
  | { kind: 'area'; label: string; area: string; city: string }
  /** Unknown city: tapping it opens a Google Maps restaurant search. */
  | { kind: 'explore'; label: string; city: string; url: string };

/** Google Maps restaurant search for a city — the fallback when we have no neighbourhoods for it. */
export function exploreMapsUrl(city: string): string {
  const q = clean(city);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`restaurants in ${q}`)}`;
}

/**
 * The chips for an arrival airport: the curated neighbourhoods, or a single "Explore {city}" chip.
 * Empty when we know neither a list nor a city name — then the whole section stays hidden.
 */
export function neighbourhoodChips(
  iata?: string | null,
  fallbackCity?: string | null,
  exploreLabel: (city: string) => string = (city) => `Explore ${city}`,
): NeighbourhoodChip[] {
  const curated = cityFor(iata);
  if (curated) {
    return curated.areas.map(area => ({ kind: 'area' as const, label: area, area, city: curated.name }));
  }
  const city = clean(fallbackCity);
  if (!city) return [];
  return [{ kind: 'explore' as const, label: exploreLabel(city), city, url: exploreMapsUrl(city) }];
}

/** Whether this airport has a curated list (as opposed to the Explore fallback). */
export function hasNeighbourhoods(iata?: string | null): boolean {
  return !!cityFor(iata);
}

/** How many cities and airports are covered — used by the tests to catch an accidental deletion. */
export const NEIGHBOURHOOD_COVERAGE = {
  cities: Object.keys(CITIES).length,
  airports: Object.keys(AIRPORT_CITY).length,
};

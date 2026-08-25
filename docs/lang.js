/**
 * Homepage language switcher for waiair.app.
 * All 11 languages update visible copy — not just the hero.
 */
(function () {
  var LANG_KEY = 'waiair.site.lang';
  var HERO_LANG_KEY = 'waiair.site.heroLang';

  var I18N = {
    en: {
      title: 'WaiAir · Real-time flight tracker for airports worldwide',
      description: 'WaiAir — real-time flight tracker for 10,000+ airports worldwide. Live arrivals, gate info, delay alerts and radar.',
      headline: 'Track flights in real-time, anywhere in the world',
      subheadline: 'Live flight status, gate info, delay alerts and radar — born in Phuket, built for travelers everywhere.',
      appStore: 'Download on the App Store',
      playStoreSoon: 'Play Store — coming soon',
      playStoreLive: 'Get it on Google Play',
      countdownPrefix: 'Launch in',
      featuresLabel: 'Features',
      features: [
        '✈️ Live gate info & boarding alerts',
        '🚗 Pickup mode — we tell you when to leave',
        '🧳 Baggage belt notifications',
        '🎫 Flight memory card — share your journey',
        '👥 Fly Together — track group flights',
        '🌐 Share your flight live — no app needed'
      ],
      gateBadgeAlt: 'WaiAir gate badge — Gate C18, Terminal 1',
      gateBadgeCaption: 'Airport-style gate badge — gate number and terminal at a glance.',
      statAirports: 'Airports worldwide',
      statAircraft: 'aircraft tracked',
      statLive: 'Real-time',
      statUpdates: 'live updates',
      shotsEyebrow: 'See it in action',
      shotsTitle: 'Everything at the gate, in your pocket',
      shotsSub: 'Real data. Real airports. Built for the way travelers actually move.',
      radarTitle: 'Live radar. Every aircraft, right now.',
      radarBody: 'See all flights in the air in real-time. Tap any aircraft to see flight number, route, altitude, and speed. Type a flight number or scan your boarding pass to jump straight to your flight.',
      radarPills: ['Live positions', '150,000+ aircraft', 'Scan boarding pass'],
      trackTitle: 'Gate, status, landing time — one glance.',
      trackBody: 'Track any flight by number. See gate info, live status, and route on the map — updated every few seconds. Get notified the moment boarding starts or the gate changes.',
      trackPills: ['Gate alerts', 'Delay notifications', 'Route on map'],
      boardTitle: 'Full flight board. Any airport, any day.',
      boardBody: 'Browse arrivals and departures for 10,000+ airports worldwide. Filter by boarding, delayed, or all flights. Swipe between yesterday, today, and tomorrow — perfect for picking someone up.',
      boardPills: ['10,000+ airports', 'Arrivals & departures', 'Delay filter'],
      mapTip: 'Select an airport',
      airportsTitle: 'Every airport. Every continent.',
      airportsLead: 'From Bangkok to Tokyo. Singapore to Dubai.<br/>WaiAir tracks 10,000+ airports worldwide.',
      colSea: 'Southeast Asia',
      colEast: 'East Asia',
      colWest: 'Europe & Americas',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service'
    },
    de: {
      title: 'WaiAir · Echtzeit-Flugtracker für Flughäfen weltweit',
      description: 'WaiAir — Echtzeit-Flugtracker für über 10.000 Flughäfen weltweit. Live-Ankünfte, Gate-Info, Verspätungsalerts und Radar.',
      headline: 'Flüge in Echtzeit verfolgen – weltweit',
      subheadline: 'Live-Flugstatus, Gate-Info, Verspätungsalerts und Radar – entstanden in Phuket, gemacht für Reisende überall.',
      appStore: 'Laden im App Store',
      playStoreSoon: 'Play Store — demnächst',
      playStoreLive: 'Bei Google Play laden',
      countdownPrefix: 'Start in',
      featuresLabel: 'Funktionen',
      features: [
        '✈️ Live-Gate-Infos & Boarding-Alerts',
        '🚗 Abholmodus — wir sagen, wann Sie losfahren',
        '🧳 Gepäckband-Benachrichtigungen',
        '🎫 Flug-Memory-Card — teilen Sie Ihre Reise',
        '👥 Fly Together — Gruppenflüge verfolgen',
        '🌐 Flug live teilen — keine App nötig'
      ],
      gateBadgeAlt: 'WaiAir Gate-Badge — Gate C18, Terminal 1',
      gateBadgeCaption: 'Gate-Badge im Airport-Stil — Gate und Terminal auf einen Blick.',
      statAirports: 'Flughäfen weltweit',
      statAircraft: 'Flugzeuge erfasst',
      statLive: 'Echtzeit',
      statUpdates: 'Live-Updates',
      shotsEyebrow: 'So sieht es aus',
      shotsTitle: 'Alles am Gate, in Ihrer Tasche',
      shotsSub: 'Echte Daten. Echte Flughäfen. Gebaut für Reisende.',
      radarTitle: 'Live-Radar. Jedes Flugzeug, jetzt.',
      radarBody: 'Sehen Sie alle Flüge in der Luft in Echtzeit. Tippen Sie auf ein Flugzeug für Flugnummer, Route, Höhe und Geschwindigkeit. Flugnummer eingeben oder Boardingpass scannen.',
      radarPills: ['Live-Positionen', '150.000+ Flugzeuge', 'Boardingpass scannen'],
      trackTitle: 'Gate, Status, Landung — ein Blick.',
      trackBody: 'Verfolgen Sie jeden Flug per Nummer. Gate, Live-Status und Route auf der Karte — alle paar Sekunden aktualisiert. Sofort benachrichtigt bei Boarding oder Gate-Wechsel.',
      trackPills: ['Gate-Alerts', 'Verspätungsalerts', 'Route auf der Karte'],
      boardTitle: 'Vollständige Anzeigetafel. Jeder Flughafen, jeder Tag.',
      boardBody: 'Ankünfte und Abflüge für über 10.000 Flughäfen. Filter nach Boarding, verspätet oder alle Flüge. Wischen zwischen gestern, heute und morgen — ideal zum Abholen.',
      boardPills: ['10.000+ Flughäfen', 'Ankunft & Abflug', 'Verspätungsfilter'],
      mapTip: 'Flughafen wählen',
      airportsTitle: 'Jeder Flughafen. Jeder Kontinent.',
      airportsLead: 'Von Bangkok nach Tokio. Singapur nach Dubai.<br/>WaiAir erfasst über 10.000 Flughäfen weltweit.',
      colSea: 'Südostasien',
      colEast: 'Ostasien',
      colWest: 'Europa & Amerika',
      privacy: 'Datenschutz',
      terms: 'Nutzungsbedingungen'
    },
    es: {
      title: 'WaiAir · Rastreador de vuelos en tiempo real para aeropuertos del mundo',
      description: 'WaiAir — rastreador de vuelos en tiempo real para más de 10.000 aeropuertos. Llegadas en vivo, info de puerta, alertas de retraso y radar.',
      headline: 'Rastrea vuelos en tiempo real, en cualquier lugar',
      subheadline: 'Estado de vuelos en vivo, info de puerta, alertas de retraso y radar – nacido en Phuket, hecho para viajeros de todo el mundo.',
      appStore: 'Descargar en el App Store',
      playStoreSoon: 'Play Store — próximamente',
      playStoreLive: 'Consíguelo en Google Play',
      countdownPrefix: 'Lanzamiento en',
      featuresLabel: 'Funciones',
      features: [
        '✈️ Info de puerta en vivo y alertas de embarque',
        '🚗 Modo recogida — te decimos cuándo salir',
        '🧳 Avisos de cinta de equipaje',
        '🎫 Tarjeta de recuerdo — comparte tu viaje',
        '👥 Fly Together — sigue vuelos en grupo',
        '🌐 Comparte tu vuelo en vivo — sin app'
      ],
      gateBadgeAlt: 'Insignia de puerta WaiAir — Puerta C18, Terminal 1',
      gateBadgeCaption: 'Insignia estilo aeropuerto — puerta y terminal de un vistazo.',
      statAirports: 'Aeropuertos en el mundo',
      statAircraft: 'aviones rastreados',
      statLive: 'Tiempo real',
      statUpdates: 'actualizaciones en vivo',
      shotsEyebrow: 'Míralo en acción',
      shotsTitle: 'Todo en la puerta, en tu bolsillo',
      shotsSub: 'Datos reales. Aeropuertos reales. Hecho para viajeros.',
      radarTitle: 'Radar en vivo. Cada avión, ahora.',
      radarBody: 'Ve todos los vuelos en el aire en tiempo real. Toca cualquier avión para ver número, ruta, altitud y velocidad. Escribe un número o escanea tu tarjeta de embarque.',
      radarPills: ['Posiciones en vivo', '150.000+ aviones', 'Escanear boarding pass'],
      trackTitle: 'Puerta, estado, aterrizaje — de un vistazo.',
      trackBody: 'Sigue cualquier vuelo por número. Puerta, estado en vivo y ruta en el mapa — actualizado cada pocos segundos. Aviso al empezar el embarque o si cambia la puerta.',
      trackPills: ['Alertas de puerta', 'Alertas de retraso', 'Ruta en el mapa'],
      boardTitle: 'Panel completo. Cualquier aeropuerto, cualquier día.',
      boardBody: 'Llegadas y salidas de más de 10.000 aeropuertos. Filtra por embarque, retrasados o todos. Desliza entre ayer, hoy y mañana — perfecto para recoger a alguien.',
      boardPills: ['10.000+ aeropuertos', 'Llegadas y salidas', 'Filtro de retrasos'],
      mapTip: 'Elige un aeropuerto',
      airportsTitle: 'Cada aeropuerto. Cada continente.',
      airportsLead: 'De Bangkok a Tokio. Singapur a Dubái.<br/>WaiAir rastrea más de 10.000 aeropuertos en el mundo.',
      colSea: 'Sudeste asiático',
      colEast: 'Asia oriental',
      colWest: 'Europa y Américas',
      privacy: 'Privacidad',
      terms: 'Términos de servicio'
    },
    th: {
      title: 'WaiAir · ติดตามเที่ยวบินแบบเรียลไทม์ทั่วโลก',
      description: 'WaiAir — ติดตามเที่ยวบินแบบเรียลไทม์ กว่า 10,000 สนามบินทั่วโลก ข้อมูลเกต การแจ้งเตือน และเรดาร์',
      headline: 'ติดตามเที่ยวบินแบบเรียลไทม์ ทั่วโลก',
      subheadline: 'สถานะเที่ยวบินสด ข้อมูลเกต แจ้งเตือนดีเลย์ และเรดาร์ – เกิดที่ภูเก็ต สร้างสำหรับนักเดินทางทั่วโลก',
      appStore: 'ดาวน์โหลดบน App Store',
      playStoreSoon: 'Play Store — เร็วๆ นี้',
      playStoreLive: 'ดาวน์โหลดบน Google Play',
      countdownPrefix: 'เปิดตัวใน',
      featuresLabel: 'ฟีเจอร์',
      features: [
        '✈️ ข้อมูลเกตแบบเรียลไทม์และการแจ้งเตือนขึ้นเครื่อง',
        '🚗 โหมดรับผู้โดยสาร — เราบอกเวลาออกเดินทาง',
        '🧳 การแจ้งเตือนสายพานรับกระเป๋า',
        '🎫 การ์ดความทรงจำการบิน — แชร์การเดินทางของคุณ',
        '👥 Fly Together — ติดตามเที่ยวบินกลุ่ม',
        '🌐 แชร์เที่ยวบินสด — ไม่ต้องดาวน์โหลดแอป'
      ],
      gateBadgeAlt: 'ป้ายเกต WaiAir — เกต C18 อาคารผู้โดยสาร 1',
      gateBadgeCaption: 'ป้ายเกตสไตล์สนามบิน — เห็นหมายเลขเกตและอาคารผู้โดยสารได้ทันที',
      statAirports: 'สนามบินทั่วโลก',
      statAircraft: 'อากาศยานที่ติดตาม',
      statLive: 'เรียลไทม์',
      statUpdates: 'อัปเดตสด',
      shotsEyebrow: 'ดูการใช้งานจริง',
      shotsTitle: 'ทุกอย่างที่เกต อยู่ในมือคุณ',
      shotsSub: 'ข้อมูลจริง สนามบินจริง สร้างสำหรับนักเดินทาง',
      radarTitle: 'เรดาร์สด ทุกลำ ในตอนนี้',
      radarBody: 'ดูเที่ยวบินทั้งหมดบนฟ้าแบบเรียลไทม์ แตะเครื่องบินเพื่อดูหมายเลข เส้นทาง ความสูง และความเร็ว พิมพ์หมายเลขเที่ยวบินหรือสแกนบอร์ดดิ้งพาส',
      radarPills: ['ตำแหน่งสด', 'อากาศยาน 150,000+', 'สแกนบอร์ดดิ้งพาส'],
      trackTitle: 'เกต สถานะ เวลาลงจอด — ดูได้ทันที',
      trackBody: 'ติดตามเที่ยวบินด้วยหมายเลข ดูเกต สถานะสด และเส้นทางบนแผนที่ อัปเดตทุกไม่กี่วินาที แจ้งเตือนเมื่อเริ่มขึ้นเครื่องหรือเกตเปลี่ยน',
      trackPills: ['แจ้งเตือนเกต', 'แจ้งเตือนดีเลย์', 'เส้นทางบนแผนที่'],
      boardTitle: 'กระดานเที่ยวบินเต็ม ทุกสนามบิน ทุกวัน',
      boardBody: 'ดูขาเข้าและขาออกกว่า 10,000 สนามบิน กรองตามขึ้นเครื่อง ดีเลย์ หรือทั้งหมด ปัดดูเมื่อวาน วันนี้ พรุ่งนี้ — เหมาะตอนไปรับ',
      boardPills: ['10,000+ สนามบิน', 'ขาเข้าและขาออก', 'ตัวกรองดีเลย์'],
      mapTip: 'เลือกสนามบิน',
      airportsTitle: 'ทุกสนามบิน ทุกทวีป',
      airportsLead: 'จากกรุงเทพสู่โตเกียว สิงคโปร์สู่ดูไบ<br/>WaiAir ติดตามกว่า 10,000 สนามบินทั่วโลก',
      colSea: 'เอเชียตะวันออกเฉียงใต้',
      colEast: 'เอเชียตะวันออก',
      colWest: 'ยุโรปและอเมริกา',
      privacy: 'นโยบายความเป็นส่วนตัว',
      terms: 'ข้อกำหนดการใช้งาน'
    },
    ja: {
      title: 'WaiAir · 世界の空港向けリアルタイムフライト追跡',
      description: 'WaiAir — 世界10,000以上の空港のリアルタイムフライト追跡。到着、ゲート、遅延アラート、レーダー。',
      headline: 'リアルタイムでフライトを追跡 — 世界中どこでも',
      subheadline: 'フライトのライブ状況、ゲート情報、遅延アラート、レーダー — プーケット生まれ、世界中の旅行者のために。',
      appStore: 'App Store でダウンロード',
      playStoreSoon: 'Play Store — 近日公開',
      playStoreLive: 'Google Play で手に入れる',
      countdownPrefix: '公開まで',
      featuresLabel: '機能',
      features: [
        '✈️ リアルタイムのゲート情報と搭乗アラート',
        '🚗 お迎えモード — 出発タイミングをお知らせ',
        '🧳 手荷物ベルトの通知',
        '🎫 フライトメモリーカード — 旅をシェア',
        '👥 Fly Together — グループ便を追跡',
        '🌐 フライトをライブ共有 — アプリ不要'
      ],
      gateBadgeAlt: 'WaiAir ゲートバッジ — ゲート C18、第1ターミナル',
      gateBadgeCaption: '空港スタイルのゲートバッジ — ゲートとターミナルが一目でわかる。',
      statAirports: '世界の空港',
      statAircraft: '追跡中の航空機',
      statLive: 'リアルタイム',
      statUpdates: 'ライブ更新',
      shotsEyebrow: '実際の画面',
      shotsTitle: 'ゲートのすべてを、ポケットに',
      shotsSub: '本物のデータ。本物の空港。旅行者のために。',
      radarTitle: 'ライブレーダー。すべての航空機を今。',
      radarBody: '空のすべての便をリアルタイムで。機体をタップして便名、路線、高度、速度を表示。便名入力または搭乗券スキャンですぐに飛べます。',
      radarPills: ['ライブ位置', '150,000+ 機', '搭乗券スキャン'],
      trackTitle: 'ゲート、状況、着陸 — 一目で。',
      trackBody: '便名で追跡。ゲート、ライブ状況、地図上のルートを数秒ごとに更新。搭乗開始やゲート変更ですぐ通知。',
      trackPills: ['ゲート通知', '遅延通知', '地図上のルート'],
      boardTitle: '完全なフライトボード。どの空港でも、どの日でも。',
      boardBody: '世界10,000以上の空港の到着と出発。搭乗中、遅延、すべての便で絞り込み。昨日・今日・明日をスワイプ — お迎えに最適。',
      boardPills: ['10,000+ 空港', '到着と出発', '遅延フィルター'],
      mapTip: '空港を選択',
      airportsTitle: 'すべての空港。すべての大陸。',
      airportsLead: 'バンコクから東京へ。シンガポールからドバイへ。<br/>WaiAir は世界10,000以上の空港を追跡します。',
      colSea: '東南アジア',
      colEast: '東アジア',
      colWest: '欧州・米州',
      privacy: 'プライバシーポリシー',
      terms: '利用規約'
    },
    ko: {
      title: 'WaiAir · 전 세계 공항 실시간 항공편 추적',
      description: 'WaiAir — 전 세계 10,000개 이상 공항의 실시간 항공편 추적. 도착, 게이트, 지연 알림, 레이더.',
      headline: '실시간 항공편 추적 — 전 세계 어디서나',
      subheadline: '실시간 항공편 상태, 게이트 정보, 지연 알림 및 레이더 — 푸켓에서 탄생, 전 세계 여행자를 위해 만들었습니다.',
      appStore: 'App Store에서 다운로드',
      playStoreSoon: 'Play Store — 곧 출시',
      playStoreLive: 'Google Play에서 받기',
      countdownPrefix: '출시까지',
      featuresLabel: '기능',
      features: [
        '✈️ 실시간 게이트 정보와 탑승 알림',
        '🚗 픽업 모드 — 출발 시간을 알려 드립니다',
        '🧳 수하물 벨트 알림',
        '🎫 항공 메모리 카드 — 여행을 공유하세요',
        '👥 Fly Together — 단체 항공편 추적',
        '🌐 항공편 실시간 공유 — 앱 불필요'
      ],
      gateBadgeAlt: 'WaiAir 게이트 배지 — 게이트 C18, 제1터미널',
      gateBadgeCaption: '공항 스타일 게이트 배지 — 게이트와 터미널을 한눈에.',
      statAirports: '전 세계 공항',
      statAircraft: '추적 항공기',
      statLive: '실시간',
      statUpdates: '라이브 업데이트',
      shotsEyebrow: '실제 화면',
      shotsTitle: '게이트의 모든 것, 주머니 속에',
      shotsSub: '실제 데이터. 실제 공항. 여행자를 위해.',
      radarTitle: '라이브 레이더. 모든 항공기, 지금.',
      radarBody: '하늘 위 모든 항공편을 실시간으로. 항공기를 탭해 편명, 노선, 고도, 속도를 보세요. 편명을 입력하거나 탑승권을 스캔하세요.',
      radarPills: ['실시간 위치', '150,000+ 항공기', '탑승권 스캔'],
      trackTitle: '게이트, 상태, 착륙 — 한눈에.',
      trackBody: '편명으로 추적. 게이트, 실시간 상태, 지도 경로를 몇 초마다 업데이트. 탑승 시작이나 게이트 변경 시 바로 알림.',
      trackPills: ['게이트 알림', '지연 알림', '지도 경로'],
      boardTitle: '전체 항공편 보드. 어떤 공항, 어떤 날이든.',
      boardBody: '전 세계 10,000개 이상 공항의 도착과 출발. 탑승 중, 지연, 전체로 필터. 어제·오늘·내일 스와이프 — 마중 나가기에 최적.',
      boardPills: ['10,000+ 공항', '도착과 출발', '지연 필터'],
      mapTip: '공항 선택',
      airportsTitle: '모든 공항. 모든 대륙.',
      airportsLead: '방콕에서 도쿄로. 싱가포르에서 두바이로.<br/>WaiAir는 전 세계 10,000개 이상 공항을 추적합니다.',
      colSea: '동남아시아',
      colEast: '동아시아',
      colWest: '유럽 및 미주',
      privacy: '개인정보 처리방침',
      terms: '이용 약관'
    },
    nl: {
      title: 'WaiAir · Real-time vluchttracker voor luchthavens wereldwijd',
      description: 'WaiAir — real-time vluchttracker voor 10.000+ luchthavens wereldwijd. Live aankomsten, gate-info, vertragingsmeldingen en radar.',
      headline: 'Volg vluchten in real-time, overal ter wereld',
      subheadline: 'Live vluchtstatussen, gate-info, vertragingsmeldingen en radar – geboren in Phuket, gemaakt voor reizigers wereldwijd.',
      appStore: 'Download in de App Store',
      playStoreSoon: 'Play Store — binnenkort',
      playStoreLive: 'Downloaden via Google Play',
      countdownPrefix: 'Lancering over',
      featuresLabel: 'Functies',
      features: [
        '✈️ Live gate-info en boardingmeldingen',
        '🚗 Ophaalmodus — wij zeggen wanneer je vertrekt',
        '🧳 Meldingen voor de bagageband',
        '🎫 Vluchtgeheugenkaart — deel je reis',
        '👥 Fly Together — groepsvluchten volgen',
        '🌐 Deel je vlucht live — geen app nodig'
      ],
      gateBadgeAlt: 'WaiAir gate-badge — Gate C18, Terminal 1',
      gateBadgeCaption: 'Gate-badge in luchthavenstijl — gate en terminal in één oogopslag.',
      statAirports: 'Luchthavens wereldwijd',
      statAircraft: 'vliegtuigen gevolgd',
      statLive: 'Real-time',
      statUpdates: 'live updates',
      shotsEyebrow: 'Zo werkt het',
      shotsTitle: 'Alles bij de gate, in je broekzak',
      shotsSub: 'Echte data. Echte luchthavens. Gemaakt voor reizigers.',
      radarTitle: 'Live radar. Elk vliegtuig, nu.',
      radarBody: 'Zie alle vluchten in de lucht in real-time. Tik op een vliegtuig voor vluchtnummer, route, hoogte en snelheid. Typ een vluchtnummer of scan je boardingpass.',
      radarPills: ['Live posities', '150.000+ vliegtuigen', 'Boardingpass scannen'],
      trackTitle: 'Gate, status, landing — in één oogopslag.',
      trackBody: 'Volg elke vlucht op nummer. Gate, live status en route op de kaart — elke paar seconden bijgewerkt. Melding zodra boarding start of de gate wijzigt.',
      trackPills: ['Gatemeldingen', 'Vertragingsmeldingen', 'Route op de kaart'],
      boardTitle: 'Volledig vluchtbord. Elke luchthaven, elke dag.',
      boardBody: 'Aankomsten en vertrekken voor 10.000+ luchthavens. Filter op boarding, vertraagd of alle vluchten. Veeg tussen gisteren, vandaag en morgen — ideaal om iemand op te halen.',
      boardPills: ['10.000+ luchthavens', 'Aankomst & vertrek', 'vertragingsfilter'],
      mapTip: 'Kies een luchthaven',
      airportsTitle: 'Elke luchthaven. Elk continent.',
      airportsLead: 'Van Bangkok naar Tokio. Singapore naar Dubai.<br/>WaiAir volgt 10.000+ luchthavens wereldwijd.',
      colSea: 'Zuidoost-Azië',
      colEast: 'Oost-Azië',
      colWest: 'Europa & Amerika',
      privacy: 'Privacybeleid',
      terms: 'Gebruiksvoorwaarden'
    },
    vi: {
      title: 'WaiAir · Theo dõi chuyến bay thời gian thực cho sân bay toàn cầu',
      description: 'WaiAir — theo dõi hơn 10.000 sân bay trên thế giới. Đến nơi trực tiếp, thông tin cổng, cảnh báo trễ và radar.',
      headline: 'Theo dõi chuyến bay theo thời gian thực, khắp nơi trên thế giới',
      subheadline: 'Trạng thái chuyến bay trực tiếp, thông tin cổng, cảnh báo trễ và radar – ra đời tại Phuket, dành cho du khách toàn cầu.',
      appStore: 'Tải trên App Store',
      playStoreSoon: 'Play Store — sắp ra mắt',
      playStoreLive: 'Tải trên Google Play',
      countdownPrefix: 'Ra mắt sau',
      featuresLabel: 'Tính năng',
      features: [
        '✈️ Thông tin cổng trực tiếp và cảnh báo lên máy bay',
        '🚗 Chế độ đón — chúng tôi báo khi nào nên đi',
        '🧳 Thông báo băng chuyền hành lý',
        '🎫 Thẻ kỷ niệm chuyến bay — chia sẻ hành trình',
        '👥 Fly Together — theo dõi chuyến bay nhóm',
        '🌐 Chia sẻ chuyến bay trực tiếp — không cần app'
      ],
      gateBadgeAlt: 'Huy hiệu cổng WaiAir — Cổng C18, Nhà ga 1',
      gateBadgeCaption: 'Huy hiệu kiểu sân bay — cổng và nhà ga trong một nhìn.',
      statAirports: 'Sân bay toàn cầu',
      statAircraft: 'máy bay được theo dõi',
      statLive: 'Thời gian thực',
      statUpdates: 'cập nhật trực tiếp',
      shotsEyebrow: 'Xem thực tế',
      shotsTitle: 'Mọi thứ tại cổng, trong túi bạn',
      shotsSub: 'Dữ liệu thật. Sân bay thật. Dành cho du khách.',
      radarTitle: 'Radar trực tiếp. Mọi máy bay, ngay bây giờ.',
      radarBody: 'Xem mọi chuyến bay trên không theo thời gian thực. Chạm máy bay để xem số hiệu, tuyến, độ cao và tốc độ. Nhập số hiệu hoặc quét thẻ lên máy bay.',
      radarPills: ['Vị trí trực tiếp', '150.000+ máy bay', 'Quét boarding pass'],
      trackTitle: 'Cổng, trạng thái, hạ cánh — một nhìn.',
      trackBody: 'Theo dõi mọi chuyến bay theo số. Cổng, trạng thái trực tiếp và tuyến trên bản đồ — cập nhật vài giây. Thông báo khi bắt đầu lên máy bay hoặc cổng đổi.',
      trackPills: ['Cảnh báo cổng', 'Cảnh báo trễ', 'Tuyến trên bản đồ'],
      boardTitle: 'Bảng chuyến bay đầy đủ. Mọi sân bay, mọi ngày.',
      boardBody: 'Đến và đi của hơn 10.000 sân bay. Lọc theo lên máy bay, trễ hoặc tất cả. Vuốt giữa hôm qua, hôm nay, ngày mai — lý tưởng khi đón người.',
      boardPills: ['10.000+ sân bay', 'Đến và đi', 'Bộ lọc trễ'],
      mapTip: 'Chọn sân bay',
      airportsTitle: 'Mọi sân bay. Mọi châu lục.',
      airportsLead: 'Từ Bangkok đến Tokyo. Singapore đến Dubai.<br/>WaiAir theo dõi hơn 10.000 sân bay trên thế giới.',
      colSea: 'Đông Nam Á',
      colEast: 'Đông Á',
      colWest: 'Châu Âu & Châu Mỹ',
      privacy: 'Chính sách bảo mật',
      terms: 'Điều khoản dịch vụ'
    },
    id: {
      title: 'WaiAir · Pelacak penerbangan real-time untuk bandara di seluruh dunia',
      description: 'WaiAir — pelacak penerbangan real-time untuk 10.000+ bandara. Kedatangan live, info gate, peringatan delay, dan radar.',
      headline: 'Lacak penerbangan secara real-time, di mana saja di dunia',
      subheadline: 'Status penerbangan langsung, info gate, peringatan keterlambatan dan radar – lahir di Phuket, dibuat untuk pelancong di mana saja.',
      appStore: 'Unduh di App Store',
      playStoreSoon: 'Play Store — segera hadir',
      playStoreLive: 'Dapatkan di Google Play',
      countdownPrefix: 'Rilis dalam',
      featuresLabel: 'Fitur',
      features: [
        '✈️ Info gate live & peringatan boarding',
        '🚗 Mode jemput — kami beri tahu kapan berangkat',
        '🧳 Notifikasi belt bagasi',
        '🎫 Kartu kenangan penerbangan — bagikan perjalananmu',
        '👥 Fly Together — lacak penerbangan grup',
        '🌐 Bagikan penerbangan secara live — tanpa aplikasi'
      ],
      gateBadgeAlt: 'Lencana gate WaiAir — Gate C18, Terminal 1',
      gateBadgeCaption: 'Lencana gaya bandara — gate dan terminal dalam satu pandangan.',
      statAirports: 'Bandara di seluruh dunia',
      statAircraft: 'pesawat dilacak',
      statLive: 'Real-time',
      statUpdates: 'pembaruan live',
      shotsEyebrow: 'Lihat aksinya',
      shotsTitle: 'Semua di gate, di saku Anda',
      shotsSub: 'Data nyata. Bandara nyata. Untuk traveler.',
      radarTitle: 'Radar live. Setiap pesawat, sekarang.',
      radarBody: 'Lihat semua penerbangan di udara secara real-time. Ketuk pesawat untuk nomor, rute, ketinggian, dan kecepatan. Ketik nomor atau pindai boarding pass.',
      radarPills: ['Posisi live', '150.000+ pesawat', 'Pindai boarding pass'],
      trackTitle: 'Gate, status, mendarat — sekali pandang.',
      trackBody: 'Lacak penerbangan dengan nomor. Gate, status live, dan rute di peta — diperbarui setiap beberapa detik. Notifikasi saat boarding mulai atau gate berubah.',
      trackPills: ['Peringatan gate', 'Peringatan delay', 'Rute di peta'],
      boardTitle: 'Papan penerbangan lengkap. Bandara apa pun, hari apa pun.',
      boardBody: 'Kedatangan dan keberangkatan 10.000+ bandara. Filter boarding, delayed, atau semua. Geser kemarin, hari ini, besok — pas untuk menjemput.',
      boardPills: ['10.000+ bandara', 'Datang & berangkat', 'Filter delay'],
      mapTip: 'Pilih bandara',
      airportsTitle: 'Setiap bandara. Setiap benua.',
      airportsLead: 'Dari Bangkok ke Tokyo. Singapura ke Dubai.<br/>WaiAir melacak 10.000+ bandara di seluruh dunia.',
      colSea: 'Asia Tenggara',
      colEast: 'Asia Timur',
      colWest: 'Eropa & Amerika',
      privacy: 'Kebijakan Privasi',
      terms: 'Ketentuan Layanan'
    },
    ru: {
      title: 'WaiAir · Трекер рейсов в реальном времени для аэропортов мира',
      description: 'WaiAir — трекер рейсов в реальном времени для 10 000+ аэропортов. Прилёты, выходы, задержки и радар.',
      headline: 'Отслеживайте рейсы в реальном времени — по всему миру',
      subheadline: 'Статус рейсов в реальном времени, информация о выходах, оповещения о задержках и радар — рождён в Пхукете, создан для путешественников по всему миру.',
      appStore: 'Загрузить в App Store',
      playStoreSoon: 'Play Store — скоро',
      playStoreLive: 'Скачать в Google Play',
      countdownPrefix: 'Запуск через',
      featuresLabel: 'Возможности',
      features: [
        '✈️ Живые данные выхода и оповещения посадки',
        '🚗 Режим встречи — подскажем, когда выезжать',
        '🧳 Уведомления о ленте багажа',
        '🎫 Карточка полёта — поделитесь поездкой',
        '👥 Fly Together — следите за групповыми рейсами',
        '🌐 Делитесь рейсом вживую — без приложения'
      ],
      gateBadgeAlt: 'Значок выхода WaiAir — выход C18, терминал 1',
      gateBadgeCaption: 'Значок в стиле аэропорта — выход и терминал с одного взгляда.',
      statAirports: 'Аэропорты мира',
      statAircraft: 'воздушных судов',
      statLive: 'Реальное время',
      statUpdates: 'живые обновления',
      shotsEyebrow: 'Как это выглядит',
      shotsTitle: 'Всё у выхода — у вас в кармане',
      shotsSub: 'Реальные данные. Реальные аэропорты. Для путешественников.',
      radarTitle: 'Живой радар. Каждый борт — сейчас.',
      radarBody: 'Все рейсы в воздухе в реальном времени. Нажмите на самолёт, чтобы увидеть номер, маршрут, высоту и скорость. Введите номер или отсканируйте посадочный.',
      radarPills: ['Живые позиции', '150 000+ бортов', 'Скан посадочного'],
      trackTitle: 'Выход, статус, посадка — одним взглядом.',
      trackBody: 'Отслеживайте любой рейс по номеру. Выход, статус и маршрут на карте — обновление каждые несколько секунд. Уведомление о посадке или смене выхода.',
      trackPills: ['Оповещения выхода', 'Оповещения задержки', 'Маршрут на карте'],
      boardTitle: 'Полное табло. Любой аэропорт, любой день.',
      boardBody: 'Прилёты и вылеты 10 000+ аэропортов. Фильтр: посадка, задержка или все. Свайп вчера / сегодня / завтра — удобно встречать.',
      boardPills: ['10 000+ аэропортов', 'Прилёт и вылет', 'Фильтр задержек'],
      mapTip: 'Выберите аэропорт',
      airportsTitle: 'Каждый аэропорт. Каждый континент.',
      airportsLead: 'Из Бангкока в Токио. Из Сингапура в Дубай.<br/>WaiAir отслеживает 10 000+ аэропортов по всему миру.',
      colSea: 'Юго-Восточная Азия',
      colEast: 'Восточная Азия',
      colWest: 'Европа и Америка',
      privacy: 'Конфиденциальность',
      terms: 'Условия использования'
    },
    zh: {
      title: 'WaiAir · 全球机场实时航班追踪',
      description: 'WaiAir — 覆盖全球 10,000+ 机场的实时航班追踪。到达、登机口、延误提醒和雷达。',
      headline: '实时追踪航班，遍及全球',
      subheadline: '实时航班状态、登机口信息、延误提醒和雷达 — 诞生于普吉岛，为全球旅行者打造。',
      appStore: '在 App Store 下载',
      playStoreSoon: 'Play Store — 即将上线',
      playStoreLive: '在 Google Play 获取',
      countdownPrefix: '距上线',
      featuresLabel: '功能',
      features: [
        '✈️ 实时登机口信息和登机提醒',
        '🚗 接机模式 — 我们告诉您何时出发',
        '🧳 行李传送带通知',
        '🎫 航班记忆卡 — 分享您的旅程',
        '👥 一起飞 — 追踪团体航班',
        '🌐 实时分享航班 — 无需下载应用'
      ],
      gateBadgeAlt: 'WaiAir 登机口徽章 — C18 号登机口，T1 航站楼',
      gateBadgeCaption: '机场风格登机口徽章 — 一眼看清登机口和航站楼。',
      statAirports: '全球机场',
      statAircraft: '追踪中的飞机',
      statLive: '实时',
      statUpdates: '实时更新',
      shotsEyebrow: '看看实际效果',
      shotsTitle: '登机口的一切，装进口袋',
      shotsSub: '真实数据。真实机场。为旅行者而做。',
      radarTitle: '实时雷达。每一架飞机，就在此刻。',
      radarBody: '实时查看空中所有航班。点选飞机即可看到航班号、航线、高度和速度。输入航班号或扫描登机牌，直接跳到你的航班。',
      radarPills: ['实时位置', '150,000+ 架飞机', '扫描登机牌'],
      trackTitle: '登机口、状态、落地时间 — 一眼看清。',
      trackBody: '用航班号追踪任何航班。登机口、实时状态和地图航线每隔几秒更新。登机开始或登机口变更立即通知。',
      trackPills: ['登机口提醒', '延误提醒', '地图航线'],
      boardTitle: '完整航班看板。任意机场，任意一天。',
      boardBody: '浏览全球 10,000+ 机场的到达和出发。按登机中、延误或全部筛选。在昨天、今天、明天之间滑动 — 接机刚刚好。',
      boardPills: ['10,000+ 机场', '到达与出发', '延误筛选'],
      mapTip: '选择机场',
      airportsTitle: '每一座机场。每一块大陆。',
      airportsLead: '从曼谷到东京。新加坡到迪拜。<br/>WaiAir 追踪全球 10,000+ 座机场。',
      colSea: '东南亚',
      colEast: '东亚',
      colWest: '欧洲与美洲',
      privacy: '隐私政策',
      terms: '服务条款'
    }
  };

  function splitFeature(text) {
    var idx = text.indexOf(' ');
    if (idx <= 0) return { emoji: '', text: text };
    return { emoji: text.slice(0, idx), text: text.slice(idx + 1) };
  }

  function browserLangCode() {
    var raw = 'en';
    try {
      raw = String(
        (navigator.languages && navigator.languages[0]) ||
        navigator.language ||
        navigator.userLanguage ||
        'en'
      );
    } catch (e) {}
    return raw.slice(0, 2).toLowerCase();
  }

  function detectLang() {
    try {
      var chosen = localStorage.getItem(HERO_LANG_KEY) || localStorage.getItem(LANG_KEY);
      if (chosen && I18N[chosen]) return chosen;
    } catch (e) {}
    var code = browserLangCode();
    return I18N[code] ? code : 'en';
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el && value != null) el.textContent = value;
  }

  function setHtml(id, value) {
    var el = document.getElementById(id);
    if (el && value != null) el.innerHTML = value;
  }

  function setPills(id, items) {
    var el = document.getElementById(id);
    if (!el || !items) return;
    el.innerHTML = items.map(function (t) {
      return '<span class="sf-pill">' + t + '</span>';
    }).join('');
  }

  function applyLang(lang, persist) {
    var code = I18N[lang] ? lang : 'en';
    var copy = I18N[code];
    document.documentElement.setAttribute('lang', code);
    if (persist) {
      try {
        localStorage.setItem(LANG_KEY, code);
        localStorage.setItem(HERO_LANG_KEY, code);
      } catch (e) {}
    }

    document.title = copy.title;
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', copy.description);

    setText('heroHeadline', copy.headline);
    setText('heroSubheadline', copy.subheadline);
    setText('langTriggerCode', code.toUpperCase());
    setText('appStoreLabel', copy.appStore);
    setText('playStoreSoonLabel', copy.playStoreSoon);
    setText('playStoreLiveLabel', copy.playStoreLive);
    setText('featuresLabel', copy.featuresLabel);
    setText('gateBadgeCaption', copy.gateBadgeCaption);
    setText('statAirportsLabel', copy.statAirports);
    setText('statAircraftLabel', copy.statAircraft);
    setText('statLiveValue', copy.statLive);
    setText('statLiveLabel', copy.statUpdates);
    setText('shotsEyebrow', copy.shotsEyebrow);
    setText('shotsTitle', copy.shotsTitle);
    setText('shotsSub', copy.shotsSub);
    setText('radarTitle', copy.radarTitle);
    setText('radarBody', copy.radarBody);
    setPills('radarPills', copy.radarPills);
    setText('trackTitle', copy.trackTitle);
    setText('trackBody', copy.trackBody);
    setPills('trackPills', copy.trackPills);
    setText('boardTitle', copy.boardTitle);
    setText('boardBody', copy.boardBody);
    setPills('boardPills', copy.boardPills);
    setText('mapTip', copy.mapTip);
    setText('airports-title', copy.airportsTitle);
    setHtml('airportsLead', copy.airportsLead);
    setText('colSea', copy.colSea);
    setText('colEast', copy.colEast);
    setText('colWest', copy.colWest);
    setText('privacyLink', copy.privacy);
    setText('termsLink', copy.terms);

    var gateImg = document.getElementById('gateBadgeImg');
    if (gateImg) gateImg.setAttribute('alt', copy.gateBadgeAlt);

    var list = document.getElementById('featureList');
    if (list) {
      list.innerHTML = copy.features.map(function (item) {
        var parts = splitFeature(item);
        return '<li class="feature-item"><span class="feature-emoji" aria-hidden="true">' +
          parts.emoji + '</span><span>' + parts.text + '</span></li>';
      }).join('');
    }

    if (window.__updatePlayCountdown) window.__updatePlayCountdown(copy);

    document.querySelectorAll('.lang-btn[data-lang]').forEach(function (btn) {
      var active = btn.getAttribute('data-lang') === code;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  window.applyLang = applyLang;

  var root = document.getElementById('langSwitch');
  var trigger = document.getElementById('langTrigger');
  var menu = document.getElementById('langMenu');

  function setOpen(open) {
    if (!root || !trigger) return;
    root.classList.toggle('is-open', !!open);
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  window.closeLangMenu = function () { setOpen(false); };

  if (trigger) {
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(!root.classList.contains('is-open'));
    });
  }

  if (menu) {
    menu.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.lang-btn[data-lang]') : null;
      if (!btn || !menu.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      applyLang(btn.getAttribute('data-lang'), true);
      setOpen(false);
    });
  }

  document.addEventListener('click', function (e) {
    if (root && !root.contains(e.target)) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setOpen(false);
  });

  applyLang(detectLang(), false);
})();

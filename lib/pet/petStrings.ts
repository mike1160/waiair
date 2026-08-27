import { getLocales } from 'expo-localization';
import { getLocale } from '../i18n';

export type PetLocale = 'en' | 'nl' | 'es' | 'de' | 'ru';

const PET_LOCALES: readonly PetLocale[] = ['en', 'nl', 'es', 'de', 'ru'];

function isPetLocale(code: string | null | undefined): code is PetLocale {
  return !!code && (PET_LOCALES as readonly string[]).includes(code);
}

function deviceLanguageCode(): string | null {
  try {
    for (const loc of getLocales()) {
      const tag = String(loc.languageCode || loc.languageTag || '').toLowerCase();
      const code = tag.slice(0, 2);
      if (code) return code;
    }
  } catch {
    /* Expo Go / web without locales */
  }
  return null;
}

export function resolvePetLocale(): PetLocale {
  const app = getLocale();
  if (isPetLocale(app) && app !== 'en') return app;
  const device = deviceLanguageCode();
  if (isPetLocale(device)) return device;
  return 'en';
}

const EN = {
  sheetTitle1: '🐾 Which animal is travelling?',
  sheetTitle2: '⚖️ Weight and breed',
  sheetTitle3: 'Result',
  stepIndicator: (step: number) => `${step}/3`,
  resultCabin: 'Allowed in cabin',
  resultHold: 'Hold only',
  resultNotAllowed: 'Not allowed',
  resultUnknown: 'Unknown — check with airline',
  requirementsTitle: 'What you need',
  warningsTitle: 'Please note',
  disclaimerTitle: '⚠️ Important',
  disclaimerText:
    'This information is indicative and may be outdated. Rules change without prior notice. Always verify current requirements with your airline, your own government, and the authorities of your destination country. WaiAir accepts no liability.',
  sourceText: (date: string) => `Verified on ${date} · View official source ↗`,
  petButtonText: '🐾  Is your pet travelling on this flight?',
  horseTitle: 'Horses travel via charter flights',
  horseText:
    'Horses are not transported on commercial flights. Transport is arranged via specialised charter flights under IATA Live Animals Regulations.\n\nContact a specialist:\n• Peden Bloodstock\n• IRT (International Racetrack Transport)\n• Air Horse One',
  horseDisclaimer:
    '⚠️ WaiAir accepts no liability. Always verify with your own government and destination country.',
  unknownAirline: (iata: string) =>
    `No data for ${iata} — please check the airline website.`,
  animalDogSmall: 'Small dog (<8kg)',
  animalDogLarge: 'Large dog (>8kg)',
  animalCat: 'Cat',
  animalRabbit: 'Rabbit',
  animalBird: 'Bird',
  animalOther: 'Other',
  animalHorse: 'Horse',
  weightLabel: (kg: number) => `${kg} kg`,
  brachyLabel: 'Short-nosed breed (bulldog, pug)?',
  confirmCheck: 'Check',
  back: 'Back',
  nextStepsTitle: 'Next steps',
  nextStepsReady: '✅ All done! What would you like to do next?',
  checkHint: '☝️ Check off each item when ready',
  actionHotel: 'Book pet-friendly hotel',
  actionTransfer: 'Pet-friendly transfer',
  actionDocuments: 'My documents',
  actionScan: 'Scan document',
  actionContacts: 'Local pet contacts',
  documentsSoon: 'Coming soon — document storage',
  documentsSoonHint: 'You will be able to keep health certificates, rabies records and import permits here.',
  cameraNeedPermission: 'Camera access is needed to scan your document.',
  allowCamera: 'Allow camera',
  cameraInApps: 'Camera scanning is available in the iOS and Android apps.',
  capturePhoto: 'Take photo',
  photoSaved: 'Photo saved to your library',
  photoSaveFailed: 'Could not save the photo. Check Photos permission and try again.',
  close: 'Close',
  contactsHint: 'Tap a number to call. Always confirm locally — numbers can change.',
  contactsNoMatch: 'No dedicated listing for this airport yet — major hubs below.',
  crateTitle: 'Crate size calculator (IATA)',
  crateLength: 'Animal length (cm, nose to tail base)',
  crateHeight: 'Animal height (cm, standing)',
  crateHint: 'Internal crate size so the animal can stand, turn and lie down. Confirm with your airline.',
  crateResult: (l: number, w: number, h: number) =>
    `Recommended internal crate: ${l} × ${w} × ${h} cm (L × W × H)`,
  hotelsSection: 'Pet-friendly hotels',
  hotelsBringFido: 'BringFido lodging',
  hotelsPetsWelcome: 'PetsWelcome lodging',
  relocationSection: 'Pet relocation services',
  relocationIpata: 'Find an IPATA member',
  relocationPetAir: 'PetAir',
  relocationAnimalsAway: 'Animals Away',
  relocationHappyTails: 'Happy Tails Travel',
  insuranceSection: 'Travel insurance',
  insurancePetplan: 'Petplan pet insurance',
};

type PetStrings = typeof EN;

const NL: PetStrings = {
  sheetTitle1: '🐾 Welk dier reist mee?',
  sheetTitle2: '⚖️ Gewicht en ras',
  sheetTitle3: 'Resultaat',
  stepIndicator: (step: number) => `${step}/3`,
  resultCabin: 'Toegestaan in de cabine',
  resultHold: 'Alleen in het ruim',
  resultNotAllowed: 'Niet toegestaan',
  resultUnknown: 'Onbekend — check bij de luchtvaartmaatschappij',
  requirementsTitle: 'Wat je nodig hebt',
  warningsTitle: 'Let op',
  disclaimerTitle: '⚠️ Belangrijk',
  disclaimerText:
    'Deze informatie is indicatief en kan verouderd zijn. Regels wijzigen zonder voorafgaande kennisgeving. Controleer altijd de actuele eisen bij je luchtvaartmaatschappij, je eigen overheid en de autoriteiten van het land van bestemming. WaiAir aanvaardt geen aansprakelijkheid.',
  sourceText: (date: string) => `Geverifieerd op ${date} · Bekijk officiële bron ↗`,
  petButtonText: '🐾  Reist jouw huisdier mee op deze vlucht?',
  horseTitle: 'Paarden reizen via chartervluchten',
  horseText:
    'Paarden worden niet vervoerd op reguliere lijnvluchten. Transport gaat via gespecialiseerde chartervluchten volgens de IATA Live Animals Regulations.\n\nNeem contact op met een specialist:\n• Peden Bloodstock\n• IRT (International Racetrack Transport)\n• Air Horse One',
  horseDisclaimer:
    '⚠️ WaiAir aanvaardt geen aansprakelijkheid. Controleer altijd bij je eigen overheid en het land van bestemming.',
  unknownAirline: (iata: string) =>
    `Geen gegevens voor ${iata} — check de website van de luchtvaartmaatschappij.`,
  animalDogSmall: 'Kleine hond (<8kg)',
  animalDogLarge: 'Grote hond (>8kg)',
  animalCat: 'Kat',
  animalRabbit: 'Konijn',
  animalBird: 'Vogel',
  animalOther: 'Overig',
  animalHorse: 'Paard',
  weightLabel: (kg: number) => `${kg} kg`,
  brachyLabel: 'Kortsnuitras (bulldog, mopshond)?',
  confirmCheck: 'Check',
  back: 'Terug',
  nextStepsTitle: 'Volgende stappen',
  nextStepsReady: '✅ Klaar! Wat wil je nu doen?',
  checkHint: '☝️ Vink elk item af als het klaar is',
  actionHotel: 'Boek een huisdiervriendelijk hotel',
  actionTransfer: 'Huisdiervriendelijke transfer',
  actionDocuments: 'Mijn documenten',
  actionScan: 'Document scannen',
  actionContacts: 'Lokale dierencontacten',
  documentsSoon: 'Binnenkort — documentenopslag',
  documentsSoonHint: 'Hier kun je straks gezondheidsverklaringen, rabiësbewijzen en invoervergunningen bewaren.',
  cameraNeedPermission: 'Cameratoegang is nodig om je document te scannen.',
  allowCamera: 'Camera toestaan',
  cameraInApps: 'Scannen met de camera kan in de iOS- en Android-app.',
  capturePhoto: 'Foto maken',
  photoSaved: 'Foto opgeslagen in je bibliotheek',
  photoSaveFailed: 'Foto kon niet worden opgeslagen. Controleer de Fotos-toestemming en probeer opnieuw.',
  close: 'Sluiten',
  contactsHint: 'Tik op een nummer om te bellen. Bevestig altijd lokaal — nummers kunnen wijzigen.',
  contactsNoMatch: 'Nog geen specifiek nummer voor deze luchthaven — grote hubs hieronder.',
  crateTitle: EN.crateTitle,
  crateLength: EN.crateLength,
  crateHeight: EN.crateHeight,
  crateHint: EN.crateHint,
  crateResult: EN.crateResult,
  hotelsSection: EN.hotelsSection,
  hotelsBringFido: EN.hotelsBringFido,
  hotelsPetsWelcome: EN.hotelsPetsWelcome,
  relocationSection: EN.relocationSection,
  relocationIpata: EN.relocationIpata,
  relocationPetAir: EN.relocationPetAir,
  relocationAnimalsAway: EN.relocationAnimalsAway,
  relocationHappyTails: EN.relocationHappyTails,
  insuranceSection: EN.insuranceSection,
  insurancePetplan: EN.insurancePetplan,
};

const ES: PetStrings = {
  sheetTitle1: '🐾 ¿Qué animal viaja?',
  sheetTitle2: '⚖️ Peso y raza',
  sheetTitle3: 'Resultado',
  stepIndicator: (step: number) => `${step}/3`,
  resultCabin: 'Permitido en cabina',
  resultHold: 'Solo en bodega',
  resultNotAllowed: 'No permitido',
  resultUnknown: 'Desconocido — consulta con la aerolínea',
  requirementsTitle: 'Qué necesitas',
  warningsTitle: 'Ten en cuenta',
  disclaimerTitle: '⚠️ Importante',
  disclaimerText:
    'Esta información es orientativa y puede estar desactualizada. Las normas cambian sin previo aviso. Verifica siempre los requisitos vigentes con tu aerolínea, tu gobierno y las autoridades del país de destino. WaiAir no acepta ninguna responsabilidad.',
  sourceText: (date: string) => `Verificado el ${date} · Ver fuente oficial ↗`,
  petButtonText: '🐾  ¿Viaja tu mascota en este vuelo?',
  horseTitle: 'Los caballos viajan en vuelos chárter',
  horseText:
    'Los caballos no se transportan en vuelos comerciales. El transporte se organiza en chárteres especializados según las IATA Live Animals Regulations.\n\nContacta con un especialista:\n• Peden Bloodstock\n• IRT (International Racetrack Transport)\n• Air Horse One',
  horseDisclaimer:
    '⚠️ WaiAir no acepta ninguna responsabilidad. Verifica siempre con tu gobierno y el país de destino.',
  unknownAirline: (iata: string) =>
    `No hay datos para ${iata} — consulta la web de la aerolínea.`,
  animalDogSmall: 'Perro pequeño (<8kg)',
  animalDogLarge: 'Perro grande (>8kg)',
  animalCat: 'Gato',
  animalRabbit: 'Conejo',
  animalBird: 'Ave',
  animalOther: 'Otro',
  animalHorse: 'Caballo',
  weightLabel: (kg: number) => `${kg} kg`,
  brachyLabel: '¿Raza braquicéfala (bulldog, pug)?',
  confirmCheck: 'Comprobar',
  back: 'Atrás',
  nextStepsTitle: 'Siguientes pasos',
  nextStepsReady: '✅ ¡Listo! ¿Qué quieres hacer ahora?',
  checkHint: '☝️ Marca cada punto cuando esté listo',
  actionHotel: 'Reservar hotel pet-friendly',
  actionTransfer: 'Traslado pet-friendly',
  actionDocuments: 'Mis documentos',
  actionScan: 'Escanear documento',
  actionContacts: 'Contactos locales para mascotas',
  documentsSoon: 'Próximamente — almacenamiento de documentos',
  documentsSoonHint: 'Aquí podrás guardar certificados de salud, vacunas antirrábicas y permisos de importación.',
  cameraNeedPermission: 'Se necesita acceso a la cámara para escanear el documento.',
  allowCamera: 'Permitir cámara',
  cameraInApps: 'El escaneo con cámara está disponible en las apps de iOS y Android.',
  capturePhoto: 'Hacer foto',
  photoSaved: 'Foto guardada en tu biblioteca',
  photoSaveFailed: 'No se pudo guardar la foto. Revisa el permiso de Fotos e inténtalo de nuevo.',
  close: 'Cerrar',
  contactsHint: 'Toca un número para llamar. Confirma siempre en destino: los números pueden cambiar.',
  contactsNoMatch: 'Aún no hay ficha para este aeropuerto — principales hubs abajo.',
  crateTitle: EN.crateTitle,
  crateLength: EN.crateLength,
  crateHeight: EN.crateHeight,
  crateHint: EN.crateHint,
  crateResult: EN.crateResult,
  hotelsSection: EN.hotelsSection,
  hotelsBringFido: EN.hotelsBringFido,
  hotelsPetsWelcome: EN.hotelsPetsWelcome,
  relocationSection: EN.relocationSection,
  relocationIpata: EN.relocationIpata,
  relocationPetAir: EN.relocationPetAir,
  relocationAnimalsAway: EN.relocationAnimalsAway,
  relocationHappyTails: EN.relocationHappyTails,
  insuranceSection: EN.insuranceSection,
  insurancePetplan: EN.insurancePetplan,
};

const DE: PetStrings = {
  sheetTitle1: '🐾 Welches Tier reist mit?',
  sheetTitle2: '⚖️ Gewicht und Rasse',
  sheetTitle3: 'Ergebnis',
  stepIndicator: (step: number) => `${step}/3`,
  resultCabin: 'In der Kabine erlaubt',
  resultHold: 'Nur im Frachtraum',
  resultNotAllowed: 'Nicht erlaubt',
  resultUnknown: 'Unbekannt — bei der Airline nachfragen',
  requirementsTitle: 'Was Sie brauchen',
  warningsTitle: 'Bitte beachten',
  disclaimerTitle: '⚠️ Wichtig',
  disclaimerText:
    'Diese Angaben sind unverbindlich und können veraltet sein. Vorschriften ändern sich ohne Vorankündigung. Prüfen Sie die aktuellen Anforderungen immer bei Ihrer Airline, Ihrer Regierung und den Behörden des Ziellandes. WaiAir übernimmt keine Haftung.',
  sourceText: (date: string) => `Geprüft am ${date} · Offizielle Quelle ansehen ↗`,
  petButtonText: '🐾  Reist Ihr Haustier mit diesem Flug?',
  horseTitle: 'Pferde reisen mit Charterflügen',
  horseText:
    'Pferde werden nicht auf Linienflügen transportiert. Der Transport erfolgt über spezialisierte Charterflüge nach den IATA Live Animals Regulations.\n\nKontaktieren Sie einen Spezialisten:\n• Peden Bloodstock\n• IRT (International Racetrack Transport)\n• Air Horse One',
  horseDisclaimer:
    '⚠️ WaiAir übernimmt keine Haftung. Prüfen Sie immer bei Ihrer Regierung und im Zielland nach.',
  unknownAirline: (iata: string) =>
    `Keine Daten für ${iata} — bitte die Website der Airline prüfen.`,
  animalDogSmall: 'Kleiner Hund (<8kg)',
  animalDogLarge: 'Großer Hund (>8kg)',
  animalCat: 'Katze',
  animalRabbit: 'Kaninchen',
  animalBird: 'Vogel',
  animalOther: 'Sonstiges',
  animalHorse: 'Pferd',
  weightLabel: (kg: number) => `${kg} kg`,
  brachyLabel: 'Kurzschnauzenrasse (Bulldogge, Mops)?',
  confirmCheck: 'Prüfen',
  back: 'Zurück',
  nextStepsTitle: 'Nächste Schritte',
  nextStepsReady: '✅ Fertig! Was möchten Sie als Nächstes tun?',
  checkHint: '☝️ Haken Sie jeden Punkt ab, wenn er erledigt ist',
  actionHotel: 'Haustierfreundliches Hotel buchen',
  actionTransfer: 'Haustierfreundlicher Transfer',
  actionDocuments: 'Meine Dokumente',
  actionScan: 'Dokument scannen',
  actionContacts: 'Lokale Tierkontakte',
  documentsSoon: 'Demnächst — Dokumentenspeicher',
  documentsSoonHint: 'Hier können Sie später Gesundheitszeugnisse, Tollwutnachweise und Einfuhrgenehmigungen ablegen.',
  cameraNeedPermission: 'Kamerazugriff ist nötig, um Ihr Dokument zu scannen.',
  allowCamera: 'Kamera erlauben',
  cameraInApps: 'Kamerascans sind in der iOS- und Android-App verfügbar.',
  capturePhoto: 'Foto aufnehmen',
  photoSaved: 'Foto in Ihrer Mediathek gespeichert',
  photoSaveFailed: 'Foto konnte nicht gespeichert werden. Prüfen Sie die Fotos-Berechtigung und versuchen Sie es erneut.',
  close: 'Schließen',
  contactsHint: 'Tippen Sie auf eine Nummer zum Anrufen. Vor Ort immer bestätigen — Nummern können sich ändern.',
  contactsNoMatch: 'Noch kein Eintrag für diesen Flughafen — große Drehkreuze unten.',
  crateTitle: EN.crateTitle,
  crateLength: EN.crateLength,
  crateHeight: EN.crateHeight,
  crateHint: EN.crateHint,
  crateResult: EN.crateResult,
  hotelsSection: EN.hotelsSection,
  hotelsBringFido: EN.hotelsBringFido,
  hotelsPetsWelcome: EN.hotelsPetsWelcome,
  relocationSection: EN.relocationSection,
  relocationIpata: EN.relocationIpata,
  relocationPetAir: EN.relocationPetAir,
  relocationAnimalsAway: EN.relocationAnimalsAway,
  relocationHappyTails: EN.relocationHappyTails,
  insuranceSection: EN.insuranceSection,
  insurancePetplan: EN.insurancePetplan,
};

const RU: PetStrings = {
  sheetTitle1: '🐾 Какое животное летит?',
  sheetTitle2: '⚖️ Вес и порода',
  sheetTitle3: 'Результат',
  stepIndicator: (step: number) => `${step}/3`,
  resultCabin: 'Можно в салон',
  resultHold: 'Только в багажный отсек',
  resultNotAllowed: 'Не разрешено',
  resultUnknown: 'Неизвестно — уточните у авиакомпании',
  requirementsTitle: 'Что нужно',
  warningsTitle: 'Обратите внимание',
  disclaimerTitle: '⚠️ Важно',
  disclaimerText:
    'Эта информация носит справочный характер и может быть устаревшей. Правила меняются без предварительного уведомления. Всегда проверяйте актуальные требования у авиакомпании, в государственных органах вашей страны и страны назначения. WaiAir не несёт ответственности.',
  sourceText: (date: string) => `Проверено ${date} · Официальный источник ↗`,
  petButtonText: '🐾  Ваш питомец летит этим рейсом?',
  horseTitle: 'Лошадей перевозят чартерными рейсами',
  horseText:
    'Лошадей не перевозят на регулярных пассажирских рейсах. Транспорт организуют специализированные чартеры по правилам IATA Live Animals Regulations.\n\nОбратитесь к специалисту:\n• Peden Bloodstock\n• IRT (International Racetrack Transport)\n• Air Horse One',
  horseDisclaimer:
    '⚠️ WaiAir не несёт ответственности. Всегда уточняйте требования у властей своей страны и страны назначения.',
  unknownAirline: (iata: string) =>
    `Нет данных по ${iata} — проверьте сайт авиакомпании.`,
  animalDogSmall: 'Маленькая собака (<8 кг)',
  animalDogLarge: 'Большая собака (>8 кг)',
  animalCat: 'Кошка',
  animalRabbit: 'Кролик',
  animalBird: 'Птица',
  animalOther: 'Другое',
  animalHorse: 'Лошадь',
  weightLabel: (kg: number) => `${kg} кг`,
  brachyLabel: 'Короткомордая порода (бульдог, мопс)?',
  confirmCheck: 'Проверить',
  back: 'Назад',
  nextStepsTitle: 'Дальше',
  nextStepsReady: '✅ Готово! Что хотите сделать дальше?',
  checkHint: '☝️ Отмечайте пункты, когда они выполнены',
  actionHotel: 'Забронировать отель для питомцев',
  actionTransfer: 'Трансфер с питомцем',
  actionDocuments: 'Мои документы',
  actionScan: 'Сканировать документ',
  actionContacts: 'Местные контакты для животных',
  documentsSoon: 'Скоро — хранение документов',
  documentsSoonHint: 'Здесь можно будет хранить справки о здоровье, прививки от бешенства и разрешения на ввоз.',
  cameraNeedPermission: 'Для сканирования документа нужен доступ к камере.',
  allowCamera: 'Разрешить камеру',
  cameraInApps: 'Сканирование камерой доступно в приложениях iOS и Android.',
  capturePhoto: 'Сделать фото',
  photoSaved: 'Фото сохранено в галерею',
  photoSaveFailed: 'Не удалось сохранить фото. Проверьте доступ к Фото и попробуйте снова.',
  close: 'Закрыть',
  contactsHint: 'Нажмите номер, чтобы позвонить. Всегда уточняйте на месте — номера могут меняться.',
  contactsNoMatch: 'Для этого аэропорта пока нет записи — крупные хабы ниже.',
  crateTitle: EN.crateTitle,
  crateLength: EN.crateLength,
  crateHeight: EN.crateHeight,
  crateHint: EN.crateHint,
  crateResult: EN.crateResult,
  hotelsSection: EN.hotelsSection,
  hotelsBringFido: EN.hotelsBringFido,
  hotelsPetsWelcome: EN.hotelsPetsWelcome,
  relocationSection: EN.relocationSection,
  relocationIpata: EN.relocationIpata,
  relocationPetAir: EN.relocationPetAir,
  relocationAnimalsAway: EN.relocationAnimalsAway,
  relocationHappyTails: EN.relocationHappyTails,
  insuranceSection: EN.insuranceSection,
  insurancePetplan: EN.insurancePetplan,
};

const CATALOG: Record<PetLocale, PetStrings> = {
  en: EN,
  nl: NL,
  es: ES,
  de: DE,
  ru: RU,
};

export function getPetStrings(): PetStrings {
  return CATALOG[resolvePetLocale()] ?? EN;
}

export const PET_STRINGS: PetStrings = new Proxy({} as PetStrings, {
  get(_target, prop) {
    const dict = getPetStrings();
    return dict[prop as keyof PetStrings];
  },
});

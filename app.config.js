/** @type {import('expo/config').ExpoConfig} */
const config = {
  "expo": {
    "name": "WaiAir",
    "slug": "waiair",
    "owner": "waiair",
    "version": "1.16.2",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "userInterfaceStyle": "light",
    "scheme": "waiair",
    "ios": {
      "icon": "./assets/images/icon.png",
      "supportsTablet": true,
      "buildNumber": "132",
      "infoPlist": {
        "ExpoWidgetsAppGroupIdentifier": "group.com.waiair.WaiAir",
        "NSLocationWhenInUseUsageDescription": "WaiAir uses your location to find nearby airports and estimate drive time for pickup alerts.",
        "NSPhotoLibraryUsageDescription": "WaiAir uses your photos so you can add a picture of the person you're picking up.",
        "NSPhotoLibraryAddUsageDescription": "WaiAir saves your flight memory cards and passport images to your photo library.",
        "NSCameraUsageDescription": "Used to scan boarding passes and to take a photo of the person you are picking up.",
        "NSCalendarsUsageDescription": "WaiAir needs calendar access to add flights and import upcoming trips from your events.",
        "NSCalendarsFullAccessUsageDescription": "WaiAir needs calendar access to find flight numbers in your events and add flights to your calendar.",
        "NSSupportsLiveActivities": true,
        "UIBackgroundModes": [
          "remote-notification",
          "processing"
        ],
        "BGTaskSchedulerPermittedIdentifiers": [
          "com.expo.modules.backgroundtask.processing"
        ],
        "LSApplicationQueriesSchemes": [
          "message",
          "grab",
          "bolt",
          "indrive",
          "airbnb",
          "uber",
          "foodpanda",
          "ubereats",
          "whatsapp",
          "line",
          "fb-messenger",
          "kakaolink",
          "kakaotalk",
          "gojek",
          "didiglobal",
          "careem",
          "kakaot",
          "yandexnavi",
          "bitaksi",
          "olacabs",
          "lyft",
          "gomobility",
          "be",
          "pathao",
          "cabify",
          "ninetynine",
          "shohoz",
          "rapido"
        ],
        "ITSAppUsesNonExemptEncryption": false
      },
      "bundleIdentifier": "com.waiair.WaiAir",
      "appleTeamId": "J56ZKH58J9",
      "entitlements": {
        "com.apple.security.application-groups": [
          "group.com.waiair.WaiAir"
        ]
      },
      "appStoreUrl": "https://apps.apple.com/nl/app/waiair/id6798072839"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#0D1B2E"
      },
      "predictiveBackGestureEnabled": false,
      "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "READ_CALENDAR",
        "WRITE_CALENDAR",
        "POST_NOTIFICATIONS",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.READ_CALENDAR",
        "android.permission.WRITE_CALENDAR"
      ],
      "blockedPermissions": [
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
        "android.permission.READ_MEDIA_AUDIO",
        "android.permission.ACCESS_MEDIA_LOCATION",
        "android.permission.RECORD_AUDIO"
      ],
      "package": "com.waiair.WaiAir",
      "playStoreUrl": "https://play.google.com/store/apps/details?id=com.waiair.WaiAir",
      "versionCode": 138
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "updates": {
      "enabled": true,
      "checkAutomatically": "ON_LOAD",
      "fallbackToCacheTimeout": 0,
      "url": "https://u.expo.dev/fa77ac74-c0b8-4035-8f7f-f417436f93c7"
    },
    "runtimeVersion": "1.3.0",
    "plugins": [
      "./plugins/withStoreReviewSceneFix",
      [
        "expo-location",
        {
          "locationWhenInUsePermission": "Allow WaiAir to use your location for nearby airports and pickup drive times."
        }
      ],
      [
        "expo-image-picker",
        {
          "photosPermission": "Allow WaiAir to access your photos to add a picture of the person you're picking up.",
          "microphonePermission": false
        }
      ],
      [
        "expo-camera",
        {
          "cameraPermission": "Used to scan boarding passes and to take a photo of the person you are picking up.",
          "barcodeScannerEnabled": true,
          "recordAudioAndroid": false
        }
      ],
      [
        "expo-calendar",
        {
          "calendarPermission": "Allow WaiAir to find flight numbers in your calendar and add flight events."
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/images/icon.png",
          "color": "#1d4ed8",
          "defaultChannel": "flights",
          "sounds": [
            "assets/sounds/airport_chime.caf"
          ]
        }
      ],
      "expo-font",
      "expo-background-task",
      [
        "expo-quick-actions",
        {
          "iosActions": [
            {
              "id": "myflights",
              "title": "My Flights",
              "subtitle": "Tracked flights",
              "icon": "favorite"
            },
            {
              "id": "scan",
              "title": "Scan Boarding Pass",
              "subtitle": "Open camera scanner",
              "icon": "capturePhoto"
            },
            {
              "id": "departures",
              "title": "Departures",
              "subtitle": "Saved airport board",
              "icon": "time"
            },
            {
              "id": "search",
              "title": "Track a Flight",
              "subtitle": "Search flight number",
              "icon": "search"
            }
          ]
        }
      ],
      [
        "expo-widgets",
        {
          "groupIdentifier": "group.com.waiair.WaiAir",
          "bundleIdentifier": "com.waiair.WaiAir.ExpoWidgetsTarget",
          "widgets": [
            {
              "name": "FlightHomeWidget",
              "displayName": "WaiAir",
              "description": "Your next tracked flight on the Home Screen.",
              "supportedFamilies": [
                "systemSmall",
                "systemMedium",
                "systemLarge"
              ]
            }
          ]
        }
      ],
      [
        "@bacons/apple-targets",
        {
          "root": "./targets"
        }
      ],
      "expo-sharing",
      "expo-localization",
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#0D1B2E",
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 220,
          "resizeMode": "contain"
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "fa77ac74-c0b8-4035-8f7f-f417436f93c7"
      }
    }
  }
};

config.expo.android.config = {
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '',
  },
};

export default config;

import { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import MilesWallet from './MilesWallet';

export const AIRLINE_MILES: Record<string, { program: string; milesUrl: string; upgradeUrl: string }> = {
  EY: { program: 'Etihad Guest', milesUrl: 'https://www.etihad.com/en/etihad-guest', upgradeUrl: 'https://www.etihad.com/en/etihad-guest/use-miles/upgrades' },
  TG: { program: 'Royal Orchid Plus', milesUrl: 'https://www.thaiairways.com/rop', upgradeUrl: 'https://www.thaiairways.com/en/royal_orchid_plus/upgrade/upgrade_with_miles.page' },
  QR: { program: 'Privilege Club', milesUrl: 'https://www.qatarairways.com/privilegeclub', upgradeUrl: 'https://www.qatarairways.com/en/privilege-club/use-avios/upgrade.html' },
  EK: { program: 'Skywards', milesUrl: 'https://www.emirates.com/skywards', upgradeUrl: 'https://www.emirates.com/english/skywards/use-miles/upgrade-with-miles/' },
  KL: { program: 'Flying Blue', milesUrl: 'https://www.flyingblue.com', upgradeUrl: 'https://www.klm.com/information/flying-blue/use-miles' },
  AF: { program: 'Flying Blue', milesUrl: 'https://www.flyingblue.com', upgradeUrl: 'https://www.airfrance.com/upgrade' },
  LH: { program: 'Miles & More', milesUrl: 'https://www.miles-and-more.com', upgradeUrl: 'https://www.lufthansa.com/upgrade' },
  LX: { program: 'Miles & More', milesUrl: 'https://www.miles-and-more.com', upgradeUrl: 'https://www.swiss.com/upgrade' },
  WK: { program: 'Miles & More', milesUrl: 'https://www.miles-and-more.com', upgradeUrl: 'https://www.edelweissair.com/upgrade' },
  SQ: { program: 'KrisFlyer', milesUrl: 'https://www.singaporeair.com/krisflyer', upgradeUrl: 'https://www.singaporeair.com/en_UK/ppsclub-krisflyer/use-miles/upgrade/' },
  TK: { program: 'Miles&Smiles', milesUrl: 'https://www.turkishairlines.com/milesandsmiles', upgradeUrl: 'https://www.turkishairlines.com/upgrade' },
  AA: { program: 'AAdvantage', milesUrl: 'https://www.aa.com/aadvantage', upgradeUrl: 'https://www.aa.com/upgrade' },
  AC: { program: 'Aeroplan', milesUrl: 'https://www.aircanada.com/aeroplan', upgradeUrl: 'https://www.aircanada.com/upgrade' },
  BR: { program: 'Infinity MileageLands', milesUrl: 'https://www.evaair.com/mileagelands', upgradeUrl: 'https://www.evaair.com/upgrade' },
  PG: { program: 'FlyerBonus', milesUrl: 'https://www.bangkokair.com/flyerbonus', upgradeUrl: 'https://www.bangkokair.com/upgrade' },
  CX: { program: 'Asia Miles', milesUrl: 'https://www.cathaypacific.com/asiamiles', upgradeUrl: 'https://www.cathaypacific.com/upgrade' },
};

export default function MilesUpgradeCard({
  airlineCode,
  flightNumber,
  theme: _theme,
}: {
  airlineCode: string;
  flightNumber: string;
  theme: 'dark' | 'light';
}) {
  const [imgError, setImgError] = useState(false);
  console.log('MilesUpgradeCard props:', airlineCode, flightNumber);
  console.log('AIRLINE_MILES keys:', Object.keys(AIRLINE_MILES));
  console.log('Found:', AIRLINE_MILES[airlineCode]);
  console.log('MilesUpgradeCard rendering for:', airlineCode);
  console.log('MilesUpgradeCard airlineCode:', airlineCode);
  console.log('Found in map:', AIRLINE_MILES[airlineCode]);
  const code = String(airlineCode || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  const miles = AIRLINE_MILES[code];
  if (!miles) return null;

  return (
    <View style={st.card}>
      <View style={st.headRow}>
        {imgError ? null : (
          <Image
            source={{
              uri: `https://www.gstatic.com/flights/airline_logos/70px/${code}.png`,
            }}
            style={{ width: 32, height: 32, borderRadius: 6, marginRight: 8 }}
            onError={() => setImgError(true)}
          />
        )}
        <Text style={st.header}>✈️  Miles & Upgrades</Text>
      </View>
      <View style={st.row}>
        <Pressable
          onPress={() => { void Linking.openURL(miles.milesUrl); }}
          accessibilityRole="link"
          accessibilityLabel={`Spaar miles → ${miles.program} ${flightNumber}`}
          style={st.milesBtn}
        >
          <Text style={st.milesTop} numberOfLines={1}>{miles.program}</Text>
          <Text style={st.milesSub}>Loyalty program</Text>
        </Pressable>
        <Pressable
          onPress={() => { void Linking.openURL(miles.upgradeUrl); }}
          accessibilityRole="link"
          accessibilityLabel={`Bid for upgrade → ${flightNumber}`}
          style={st.upgradeBtn}
        >
          <Text style={st.upgradeTop} numberOfLines={1}>Bid for upgrade</Text>
          <Text style={st.upgradeSub}>Upgrade your seat</Text>
        </Pressable>
      </View>
      <MilesWallet
        airlineCode={code}
        program={miles.program}
        milesUrl={miles.milesUrl}
      />
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  header: {
    fontSize: 12,
    color: '#C9A84C',
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flex: 1,
  },
  row: {
    flexDirection: 'row',
  },
  milesBtn: {
    flex: 1,
    marginRight: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: 10,
  },
  milesTop: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  milesSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  upgradeBtn: {
    flex: 1,
    marginLeft: 6,
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(201,168,76,0.4)',
    borderRadius: 8,
    padding: 10,
  },
  upgradeTop: {
    fontSize: 13,
    color: '#C9A84C',
    fontWeight: '700',
  },
  upgradeSub: {
    fontSize: 11,
    color: 'rgba(201,168,76,0.6)',
    marginTop: 2,
  },
});

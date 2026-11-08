import * as Location from 'expo-location';

import { matchChain, STORE_CHAINS, type StoreChain } from '@/constants/stores';

export type NearbyStore = {
  chain: StoreChain;
  /** 門市名稱，例如「7-ELEVEN 信義門市」 */
  name: string;
  distance: number; // 公尺
  latitude: number;
  longitude: number;
};

export type DetectResult = {
  coords: { latitude: number; longitude: number } | null;
  stores: NearbyStore[];
  error?: string;
};

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const RADIUS_M = 300;

function haversine(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

type OsmElement = {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function getFallbackNearbyStores(lat: number, lng: number): NearbyStore[] {
  return [
    { chain: STORE_CHAINS[0], name: '7-ELEVEN 鄰近門市', distance: 120, latitude: lat, longitude: lng },
    { chain: STORE_CHAINS[1], name: '全家便利商店 鄰近門市', distance: 180, latitude: lat, longitude: lng },
    { chain: STORE_CHAINS[2], name: '全聯福利中心 鄰近門市', distance: 260, latitude: lat, longitude: lng },
    { chain: STORE_CHAINS[3], name: '寶雅 POYA 鄰近門市', distance: 350, latitude: lat, longitude: lng },
  ];
}

/** 透過 OpenStreetMap 查詢附近的連鎖門市（加裝 2 秒快速逾時保護，不卡轉圈）。 */
export async function queryNearbyStores(lat: number, lng: number): Promise<NearbyStore[]> {
  const q = `[out:json][timeout:3];
nwr(around:${RADIUS_M},${lat},${lng})[shop~"^(convenience|supermarket|wholesale|chemist|department_store|general|variety_store)$"];
out center tags 30;`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2000);
  try {
    const res = await fetch(OVERPASS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'SearchPrice/1.0',
      },
      body: `data=${encodeURIComponent(q)}`,
      signal: ctrl.signal,
    });
    if (!res.ok) return getFallbackNearbyStores(lat, lng);
    const json = (await res.json()) as { elements: OsmElement[] };
    const stores: NearbyStore[] = [];
    for (const el of json.elements ?? []) {
      const t = el.tags ?? {};
      const sLat = el.lat ?? el.center?.lat;
      const sLng = el.lon ?? el.center?.lon;
      if (sLat == null || sLng == null) continue;
      const chain = matchChain(
        t['brand:zh'],
        t.brand,
        t['name:zh'],
        t.name,
        t['name:en'],
        t['brand:en'],
        t.operator,
      );
      if (!chain) continue;
      stores.push({
        chain,
        name: t['name:zh'] ?? t.name ?? chain.name,
        distance: Math.round(haversine(lat, lng, sLat, sLng)),
        latitude: sLat,
        longitude: sLng,
      });
    }
    return stores.length > 0
      ? stores.sort((a, b) => a.distance - b.distance)
      : getFallbackNearbyStores(lat, lng);
  } catch {
    return getFallbackNearbyStores(lat, lng);
  } finally {
    clearTimeout(timer);
  }
}

/** 取得目前位置並快速偵測最近的門市（最長 2 秒完成，絕不卡住）。 */
export async function detectNearbyStores(): Promise<DetectResult> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      return {
        coords: null,
        stores: getFallbackNearbyStores(25.033964, 121.564468),
        error: '未授權定位，請手動選擇通路',
      };
    }
    const last = await Location.getLastKnownPositionAsync();
    let pos = last;
    if (!pos) {
      const timeoutPos = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
      pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        timeoutPos,
      ]);
    }
    const coords = pos
      ? { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
      : { latitude: 25.033964, longitude: 121.564468 };
    const stores = await queryNearbyStores(coords.latitude, coords.longitude);
    return { coords, stores };
  } catch {
    return {
      coords: null,
      stores: getFallbackNearbyStores(25.033964, 121.564468),
    };
  }
}

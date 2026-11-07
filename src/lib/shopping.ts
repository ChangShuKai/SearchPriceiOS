import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

export type ShoppingEngine = 'google' | 'feebee' | 'biggo';

export interface ShoppingEngineInfo {
  id: ShoppingEngine;
  name: string;
  shortName: string;
  badgeColor: string;
  description: string;
  buildUrl: (query: string) => string;
}

export const SHOPPING_ENGINES: ShoppingEngineInfo[] = [
  {
    id: 'google',
    name: 'Google 購物',
    shortName: 'Google',
    badgeColor: '#4285F4',
    description: '整合各大電商與專門店最新價格行情',
    buildUrl: (query: string) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`,
  },
  {
    id: 'feebee',
    name: '飛比價格',
    shortName: '飛比',
    badgeColor: '#FF6F00',
    description: '涵蓋蝦皮、momo、PChome 全台最低價',
    buildUrl: (query: string) => `https://feebee.com.tw/s/?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'biggo',
    name: 'BigGo 比個夠',
    shortName: 'BigGo',
    badgeColor: '#00897B',
    description: '支援歷史價格曲線與電商特惠分析',
    buildUrl: (query: string) => `https://biggo.com.tw/s/?q=${encodeURIComponent(query)}`,
  },
];

/**
 * 使用 iOS 原生 PageSheet 彈窗開啟比價網頁，絕不跳出 App，並提供震動反饋。
 */
export async function openShoppingPage(
  engine: ShoppingEngine,
  query: string,
  tintColor: string,
) {
  const target = SHOPPING_ENGINES.find((e) => e.id === engine) ?? SHOPPING_ENGINES[0];
  const url = target.buildUrl(query);

  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: tintColor,
      enableBarCollapsing: true,
      showTitle: true,
      dismissButtonStyle: Platform.OS === 'ios' ? 'done' : 'close',
    });
  } catch (error) {
    console.warn('[Shopping] WebBrowser open failed:', error);
  }
}

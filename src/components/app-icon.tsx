import { SymbolView } from 'expo-symbols';
import React from 'react';

export type AppIconName =
  | 'person.fill'
  | 'person.crop.circle'
  | 'person.crop.circle.fill'
  | 'chevron.right'
  | 'checkmark.icloud.fill'
  | 'megaphone.fill'
  | 'arrow.up.right.square'
  | 'server.rack'
  | 'heart.fill'
  | 'bubble.left'
  | 'checkmark.seal.fill'
  | 'xmark'
  | 'checkmark.circle.fill'
  | 'bolt.fill'
  | 'location.fill';

const ICON_MAP: Record<
  AppIconName,
  {
    ios:
      | 'person.fill'
      | 'person.crop.circle'
      | 'person.crop.circle.fill'
      | 'chevron.right'
      | 'checkmark.icloud.fill'
      | 'megaphone.fill'
      | 'arrow.up.right.square'
      | 'server.rack'
      | 'heart.fill'
      | 'bubble.left'
      | 'checkmark.seal.fill'
      | 'xmark'
      | 'checkmark.circle.fill'
      | 'bolt.fill'
      | 'location.fill';
    android:
      | 'person'
      | 'account_circle'
      | 'chevron_right'
      | 'cloud_done'
      | 'campaign'
      | 'open_in_new'
      | 'dns'
      | 'favorite'
      | 'chat_bubble_outline'
      | 'verified'
      | 'close'
      | 'check_circle'
      | 'bolt'
      | 'location_on';
  }
> = {
  'person.fill': { ios: 'person.fill', android: 'person' },
  'person.crop.circle': { ios: 'person.crop.circle', android: 'account_circle' },
  'person.crop.circle.fill': { ios: 'person.crop.circle.fill', android: 'account_circle' },
  'chevron.right': { ios: 'chevron.right', android: 'chevron_right' },
  'checkmark.icloud.fill': { ios: 'checkmark.icloud.fill', android: 'cloud_done' },
  'megaphone.fill': { ios: 'megaphone.fill', android: 'campaign' },
  'arrow.up.right.square': { ios: 'arrow.up.right.square', android: 'open_in_new' },
  'server.rack': { ios: 'server.rack', android: 'dns' },
  'heart.fill': { ios: 'heart.fill', android: 'favorite' },
  'bubble.left': { ios: 'bubble.left', android: 'chat_bubble_outline' },
  'checkmark.seal.fill': { ios: 'checkmark.seal.fill', android: 'verified' },
  xmark: { ios: 'xmark', android: 'close' },
  'checkmark.circle.fill': { ios: 'checkmark.circle.fill', android: 'check_circle' },
  'bolt.fill': { ios: 'bolt.fill', android: 'bolt' },
  'location.fill': { ios: 'location.fill', android: 'location_on' },
};

export function AppIcon({
  name,
  size = 18,
  color = '#1F2421',
}: {
  name: AppIconName;
  size?: number;
  color?: string;
}) {
  const mapped = ICON_MAP[name];
  return <SymbolView name={mapped} size={size} tintColor={color} />;
}

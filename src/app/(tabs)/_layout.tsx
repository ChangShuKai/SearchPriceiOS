import { NativeTabs } from 'expo-router/native-tabs';

/**
 * 底部 Dock：使用原生 Tab Bar，在 iOS 26 上自動呈現 Liquid Glass 樣式。
 */
export default function TabLayout() {
  return (
    <NativeTabs minimizeBehavior="never">
      <NativeTabs.Trigger name="discount">
        <NativeTabs.Trigger.Label>即期品</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'tag', selected: 'tag.fill' }}
          md="local_offer"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="radar">
        <NativeTabs.Trigger.Label>超商雷達</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'sparkles', selected: 'sparkles' }}
          md="auto_awesome"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>掃描比價</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="barcode.viewfinder" md="barcode_scanner" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="add">
        <NativeTabs.Trigger.Label>新增價格</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'plus.circle', selected: 'plus.circle.fill' }}
          md="add_circle"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

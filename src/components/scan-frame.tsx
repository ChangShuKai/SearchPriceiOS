import * as React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

export type TargetBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Props = {
  width: number;
  height: number;
  color?: string;
  style?: ViewStyle;
  active?: boolean;
  targetBox?: TargetBox | null;
};

/**
 * 仿微信/Apple 原生掃描框：
 * 正常時置中呼吸；一旦掃描到條碼，平滑變形、移動並貼合到條碼的實際邊界！
 */
export function ScanFrame({
  width: initialWidth,
  height: initialHeight,
  color = '#FFFFFF',
  style,
  active,
  targetBox,
}: Props) {
  const c = active ? '#3DD27A' : color;
  const corner = { borderColor: c, width: 28, height: 28, position: 'absolute' as const };

  return (
    <View style={[{ width: initialWidth, height: initialHeight }, style]} pointerEvents="none">
      <View style={[corner, styles.tl]} />
      <View style={[corner, styles.tr]} />
      <View style={[corner, styles.bl]} />
      <View style={[corner, styles.br]} />
      {!active && <View style={[styles.line, { backgroundColor: c, top: initialHeight / 2 }]} />}
    </View>
  );
}

/**
 * 條碼貼合動畫框（微信風格：綠色四角平滑框住條碼）
 */
export function BarcodeTrackingFrame({
  target,
  screenOffset = { x: 0, y: 0 },
}: {
  target: TargetBox;
  screenOffset?: { x: number; y: number };
}) {
  const c = '#3DD27A';
  const corner = { borderColor: c, width: 20, height: 20, position: 'absolute' as const };

  return (
    <Animated.View
      style={[
        styles.trackingFrame,
        {
          left: target.x - screenOffset.x - 8,
          top: target.y - screenOffset.y - 8,
          width: target.width + 16,
          height: target.height + 16,
          borderColor: c,
        },
      ]}>
      <View style={[corner, styles.tl]} />
      <View style={[corner, styles.tr]} />
      <View style={[corner, styles.bl]} />
      <View style={[corner, styles.br]} />
    </Animated.View>
  );
}

const W = 3.5;
const R = 12;
const styles = StyleSheet.create({
  tl: { top: 0, left: 0, borderTopWidth: W, borderLeftWidth: W, borderTopLeftRadius: R },
  tr: { top: 0, right: 0, borderTopWidth: W, borderRightWidth: W, borderTopRightRadius: R },
  bl: { bottom: 0, left: 0, borderBottomWidth: W, borderLeftWidth: W, borderBottomLeftRadius: R },
  br: { bottom: 0, right: 0, borderBottomWidth: W, borderRightWidth: W, borderBottomRightRadius: R },
  line: { position: 'absolute', left: 20, right: 20, height: 2, opacity: 0.7, borderRadius: 1 },
  trackingFrame: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: R,
    backgroundColor: 'rgba(61, 210, 122, 0.12)',
  },
});

import React from 'react';
import { Image, View, StyleSheet, type ViewStyle } from 'react-native';
import { COLORS } from '../lib/theme';

type Props = {
  uri?: string | null;
  size?: number;
  color?: string; // 감정 색 테두리/배경 강조
  style?: ViewStyle;
};

// 저장된 두들 PNG 썸네일. 없으면 빈 칸 표시.
export default function DoodleThumbnail({ uri, size = 56, color, style }: Props) {
  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: size * 0.22,
          borderColor: color ?? COLORS.border,
        },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
});

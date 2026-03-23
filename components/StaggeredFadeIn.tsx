import React from 'react';
import Animated, { FadeInUp, type EntryOrExitLayoutType } from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';

type StaggeredFadeInProps = {
  children: React.ReactNode;
  index?: number;
  delayStep?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
};

export default function StaggeredFadeIn({
  children,
  index = 0,
  delayStep = 120,
  duration = 460,
  style,
}: StaggeredFadeInProps) {
  const entering = FadeInUp
    .delay(index * delayStep)
    .duration(duration)
    .springify()
    .damping(18)
    .stiffness(160) as EntryOrExitLayoutType;

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}

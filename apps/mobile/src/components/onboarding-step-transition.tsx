import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

type TransitionDirection = 'forward' | 'back';

interface OnboardingStepTransitionProps {
  stepKey: string;
  direction: TransitionDirection;
  children: ReactNode;
  onTransitioningChange?: (transitioning: boolean) => void;
}

const transitionDistance = 24;
const transitionDurationMs = 190;

export function OnboardingStepTransition({
  stepKey,
  direction,
  children,
  onTransitioningChange,
}: OnboardingStepTransitionProps) {
  const [displayedKey, setDisplayedKey] = useState(stepKey);
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (stepKey === displayedKey) {
      setDisplayedChildren(children);
      return;
    }

    if (reduceMotion) {
      setDisplayedKey(stepKey);
      setDisplayedChildren(children);
      opacity.setValue(1);
      translateX.setValue(0);
      onTransitioningChange?.(false);
      return;
    }

    const sign = direction === 'forward' ? 1 : -1;
    onTransitioningChange?.(true);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: transitionDurationMs / 2,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: -sign * transitionDistance,
        duration: transitionDurationMs / 2,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setDisplayedKey(stepKey);
      setDisplayedChildren(children);
      translateX.setValue(sign * transitionDistance);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: transitionDurationMs,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0,
          duration: transitionDurationMs,
          useNativeDriver: true,
        }),
      ]).start(() => onTransitioningChange?.(false));
    });
  }, [
    children,
    direction,
    displayedKey,
    onTransitioningChange,
    opacity,
    reduceMotion,
    stepKey,
    translateX,
  ]);

  return (
    <Animated.View
      key={displayedKey}
      style={{ flex: 1, opacity, transform: [{ translateX }] }}
    >
      {displayedChildren}
    </Animated.View>
  );
}

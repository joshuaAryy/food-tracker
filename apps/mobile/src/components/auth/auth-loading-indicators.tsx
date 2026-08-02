import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  View,
} from 'react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface AuthLoadingIndicatorsProps {
  active: boolean;
  children: (indicators: { dots: ReactNode; spinner: ReactNode }) => ReactNode;
}

const DOT_INACTIVE_OPACITY = 0.56;
const DOT_WRAPPER_STYLE = { width: 52, height: 12 } as const;
const SPINNER_WRAPPER_STYLE = {
  width: 20,
  height: 20,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

export function AuthLoadingIndicators({
  active,
  children,
}: AuthLoadingIndicatorsProps) {
  const dotValues = useRef([
    new Animated.Value(DOT_INACTIVE_OPACITY),
    new Animated.Value(DOT_INACTIVE_OPACITY),
    new Animated.Value(DOT_INACTIVE_OPACITY),
  ]).current;
  const spinValue = useRef(new Animated.Value(0)).current;
  const dotLoop = useRef<Animated.CompositeAnimation | null>(null);
  const spinnerLoop = useRef<Animated.CompositeAnimation | null>(null);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [appIsActive, setAppIsActive] = useState(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  );

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(enabled);
      })
      .catch(() => {
        if (mounted) setReduceMotion(false);
      });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppIsActive(nextState !== 'background' && nextState !== 'inactive');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!active || reduceMotion !== false || !appIsActive) {
      dotValues.forEach((value) => value.setValue(DOT_INACTIVE_OPACITY));
      spinValue.setValue(0);
      return;
    }

    if (dotLoop.current === null || spinnerLoop.current === null) {
      dotLoop.current = Animated.loop(
        Animated.stagger(
          130,
          dotValues.map((value) =>
            Animated.sequence([
              Animated.timing(value, {
                toValue: 1,
                duration: 180,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
                isInteraction: false,
              }),
              Animated.timing(value, {
                toValue: DOT_INACTIVE_OPACITY,
                duration: 280,
                easing: Easing.inOut(Easing.quad),
                useNativeDriver: true,
                isInteraction: false,
              }),
            ]),
          ),
        ),
      );
      spinnerLoop.current = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1_100,
          easing: Easing.linear,
          useNativeDriver: true,
          isInteraction: false,
        }),
      );
    }

    dotLoop.current.start();
    spinnerLoop.current.start();

    return () => {
      dotLoop.current?.stop();
      spinnerLoop.current?.stop();
    };
  }, [active, appIsActive, dotValues, reduceMotion, spinValue]);

  const dots = (
    <View
      accessible={false}
      style={DOT_WRAPPER_STYLE}
      testID="auth-loading-dots"
    >
      <View className="flex-row gap-2">
        {dotValues.map((opacity, index) => (
          <Animated.View
            key={index}
            className="h-3 w-3 rounded-full bg-[#0E0E0E]"
            style={{ opacity }}
            testID={`auth-loading-dot-${index + 1}`}
          />
        ))}
      </View>
    </View>
  );
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const spinner = (
    <View
      accessibilityLabel="Restoring your session"
      accessibilityRole="progressbar"
      style={SPINNER_WRAPPER_STYLE}
      testID="auth-loading-spinner-wrapper"
    >
      <Animated.View
        style={{ transform: [{ rotate: spin }] }}
        testID="auth-loading-spinner-rotator"
      >
        <ActivityIndicator
          animating={false}
          color="#0E0E0E"
          hidesWhenStopped={false}
        />
      </Animated.View>
    </View>
  );

  return <>{children({ dots, spinner })}</>;
}

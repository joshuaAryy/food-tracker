import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText } from './app-text';

interface WheelAction {
  label: string;
  symbol: string;
  route?: '/food-log' | '/weight-log';
  position: {
    left: number;
    bottom: number;
  };
}

const actions: WheelAction[] = [
  {
    label: 'Food',
    symbol: 'F',
    route: '/food-log',
    position: { left: -132, bottom: 38 },
  },
  {
    label: 'Weight',
    symbol: 'W',
    route: '/weight-log',
    position: { left: -70, bottom: 106 },
  },
  {
    label: 'Water',
    symbol: '≈',
    position: { left: 14, bottom: 106 },
  },
  {
    label: 'Note',
    symbol: 'N',
    position: { left: 76, bottom: 38 },
  },
];

export function FloatingActionWheel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const selectAction = (action: WheelAction) => {
    if (action.route === undefined) {
      return;
    }
    setOpen(false);
    router.push(action.route);
  };

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 bottom-0 items-center"
    >
      {open ? (
        <Pressable
          accessibilityLabel="Close logging menu"
          className="absolute bottom-0 h-[1000px] w-[1000px] bg-ink/10"
          onPress={() => setOpen(false)}
        />
      ) : null}

      <View pointerEvents="box-none" className="relative bottom-7">
        {open ? (
          <View className="absolute -left-[148px] bottom-5 h-[156px] w-[360px] rounded-t-full border border-border bg-surface-raised/95 shadow-sm shadow-ink/10" />
        ) : null}
        {open
          ? actions.map((action) => {
              const disabled = action.route === undefined;
              return (
                <View
                  key={action.label}
                  className="absolute w-[72px] items-center gap-1"
                  style={action.position}
                >
                  <Pressable
                    accessibilityLabel={
                      disabled
                        ? `${action.label} logging, coming soon`
                        : `Log ${action.label.toLowerCase()}`
                    }
                    accessibilityRole="button"
                    accessibilityState={{ disabled }}
                    className={`h-[52px] w-[52px] items-center justify-center rounded-full border ${
                      disabled
                        ? 'border-border bg-canvas opacity-60'
                        : 'border-sage bg-sage-soft shadow-sm shadow-ink/15 active:bg-sage'
                    }`}
                    disabled={disabled}
                    onPress={() => selectAction(action)}
                  >
                    <AppText
                      variant="label"
                      className={
                        disabled
                          ? 'text-muted'
                          : 'text-lg font-semibold text-sage-dark'
                      }
                    >
                      {action.symbol}
                    </AppText>
                  </Pressable>
                  <AppText
                    variant="caption"
                    className={disabled ? 'text-muted' : 'text-ink'}
                  >
                    {action.label}
                  </AppText>
                  {disabled ? (
                    <AppText
                      variant="caption"
                      className="text-[9px] uppercase tracking-wide text-muted"
                    >
                      Soon
                    </AppText>
                  ) : null}
                </View>
              );
            })
          : null}

        <Pressable
          accessibilityLabel={open ? 'Close logging menu' : 'Open logging menu'}
          accessibilityRole="button"
          className="h-[62px] w-[62px] items-center justify-center rounded-full border-4 border-canvas bg-sage shadow-md shadow-ink/25 active:bg-sage-dark"
          onPress={() => setOpen((current) => !current)}
        >
          <Text
            className="text-3xl font-light text-surface-raised"
            style={{ transform: [{ rotate: open ? '45deg' : '0deg' }] }}
          >
            +
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

import { View } from 'react-native';
import { AppText } from './app-text';

interface ProgressRingProps {
  value: number;
  label: string;
  displayValue: string;
  size?: number;
  color?: string;
}

export function ProgressRing({
  value,
  label,
  displayValue,
  size = 148,
  color = '#7A9B76',
}: ProgressRingProps) {
  const progress = Math.max(0, Math.min(value, 1));
  const activeSides = Math.ceil(progress * 4);

  return (
    <View className="items-center gap-3">
      <View
        className="items-center justify-center rounded-full border-[11px] border-border"
        style={{
          width: size,
          height: size,
          borderTopColor: activeSides >= 1 ? color : '#D8CEBB',
          borderRightColor: activeSides >= 2 ? color : '#D8CEBB',
          borderBottomColor: activeSides >= 3 ? color : '#D8CEBB',
          borderLeftColor: activeSides >= 4 ? color : '#D8CEBB',
          transform: [{ rotate: '-45deg' }],
        }}
      >
        <View style={{ transform: [{ rotate: '45deg' }] }}>
          <AppText variant="heading" className="text-center tabular-nums">
            {displayValue}
          </AppText>
        </View>
      </View>
      <AppText variant="caption" muted>
        {label}
      </AppText>
    </View>
  );
}

export const ProgressDonut = ProgressRing;

import { View } from 'react-native';
import { AppText } from '@/components/app-text';

export function LoggingDayStateLegend({
  showInProgress = false,
}: {
  showInProgress?: boolean;
}) {
  return (
    <View className="flex-row flex-wrap gap-4">
      <LegendItem color="#00B86B" label="Complete" />
      <LegendItem color="#3FA66A" label="Partial" />
      <LegendItem color="#6B6B65" label="Unlogged" />
      {showInProgress ? (
        <LegendItem color="#D99000" markerColor="#B66B00" label="In progress" />
      ) : null}
    </View>
  );
}

function LegendItem({
  color,
  markerColor = color,
  label,
}: {
  color: string;
  markerColor?: string;
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View
        accessible={false}
        className="h-2.5 w-2.5 rounded-[3px]"
        style={{ backgroundColor: markerColor }}
      />
      <AppText style={{ color }}>{label}</AppText>
    </View>
  );
}

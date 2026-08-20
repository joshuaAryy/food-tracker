import { View } from 'react-native';
import { AppText } from './app-text';
import { ReportingIcon, type ReportingIconName } from './reporting-icon';

export function ReportingSectionHeading({
  icon,
  title,
  subtitle,
  compact = false,
  markerColor,
}: {
  icon: ReportingIconName;
  title: string;
  subtitle?: string;
  compact?: boolean;
  markerColor?: string | undefined;
}) {
  return (
    <View className="flex-row items-center gap-3">
      {markerColor === undefined ? (
        <ReportingIcon name={icon} size={compact ? 32 : 34} />
      ) : (
        <View
          testID={`reporting-section-marker-${icon}`}
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: markerColor,
          }}
        >
          <ReportingIcon
            name={icon}
            size={24}
            badgeColor={markerColor}
            testID={`reporting-icon-${icon}`}
          />
        </View>
      )}
      <View className="min-w-0 flex-1 gap-0.5">
        <AppText
          variant="heading"
          className={
            compact
              ? 'text-[22px] leading-7 text-ink'
              : 'text-[25px] leading-8 text-ink'
          }
        >
          {title}
        </AppText>
        {subtitle === undefined ? null : (
          <AppText variant="caption" className="text-muted">
            {subtitle}
          </AppText>
        )}
      </View>
    </View>
  );
}

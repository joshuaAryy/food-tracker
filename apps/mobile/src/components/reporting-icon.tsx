import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

export type ReportingIconName =
  | 'compare'
  | 'detail'
  | 'energy'
  | 'food'
  | 'macros'
  | 'momentum'
  | 'nutrients'
  | 'report'
  | 'tips'
  | 'weight';

interface ReportingIconProps {
  name: ReportingIconName;
  size?: number;
  badgeColor?: string | undefined;
  iconColor?: string | undefined;
  testID?: string | undefined;
}

const badgeColors: Record<ReportingIconName, string> = {
  compare: '#0E0E0E',
  detail: '#76DBA0',
  energy: '#EA1226',
  food: '#FFB80D',
  macros: '#76DBA0',
  momentum: '#EA1226',
  nutrients: '#FFB80D',
  report: '#0E0E0E',
  tips: '#FFB80D',
  weight: '#76DBA0',
};

const iconColors: Record<ReportingIconName, string> = {
  compare: '#FFFFFF',
  detail: '#0E0E0E',
  energy: '#FFFFFF',
  food: '#0E0E0E',
  macros: '#0E0E0E',
  momentum: '#FFFFFF',
  nutrients: '#0E0E0E',
  report: '#FFFFFF',
  tips: '#0E0E0E',
  weight: '#0E0E0E',
};

function ReportingIconPaths({
  color,
  name,
}: {
  color: string;
  name: ReportingIconName;
}) {
  switch (name) {
    case 'compare':
      return (
        <Path
          d="M7.18658 7.18669H18.4799L15.3999 4.10669M17.4532 17.4534H6.15991L9.23991 20.5334"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
    case 'detail':
      return (
        <>
          <Path
            d="M4.10669 6.15991H9.24002M13.3467 6.15991H20.5334M4.10669 12.3199H14.3734M18.48 12.3199H20.5334M4.10669 18.4799H6.16002M10.2667 18.4799H20.5334"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M11.2933 8.21336C12.4273 8.21336 13.3467 7.29405 13.3467 6.16002C13.3467 5.026 12.4273 4.10669 11.2933 4.10669C10.1593 4.10669 9.23999 5.026 9.23999 6.16002C9.23999 7.29405 10.1593 8.21336 11.2933 8.21336Z"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M16.4266 14.3733C17.5606 14.3733 18.48 13.454 18.48 12.3199C18.48 11.1859 17.5606 10.2666 16.4266 10.2666C15.2926 10.2666 14.3733 11.1859 14.3733 12.3199C14.3733 13.454 15.2926 14.3733 16.4266 14.3733Z"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M8.21325 20.5334C9.34727 20.5334 10.2666 19.6141 10.2666 18.4801C10.2666 17.3461 9.34727 16.4268 8.21325 16.4268C7.07922 16.4268 6.15991 17.3461 6.15991 18.4801C6.15991 19.6141 7.07922 20.5334 8.21325 20.5334Z"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case 'energy':
      return (
        <Path
          d="M13.3467 2.05322L4.10669 14.3732H11.2934L10.2667 22.5866L20.5334 9.23989H13.3467V2.05322Z"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
    case 'food':
      return (
        <Path
          d="M6.16008 2.05322V22.5866M3.08008 2.05322V9.23989C3.08008 11.2932 4.10674 12.3199 6.16008 12.3199C8.21341 12.3199 9.24008 11.2932 9.24008 9.23989V2.05322M16.4267 22.5866V2.05322C19.5067 3.07989 21.5601 6.15989 21.5601 10.2666V12.3199H16.4267"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'macros':
      return (
        <>
          <Path
            d="M4.10669 6.15991H11.2934M15.4 6.15991H20.5334M4.10669 12.3199H7.18669M11.2934 12.3199H20.5334M4.10669 18.4799H14.3734M18.48 18.4799H20.5334"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M13.3465 8.21336C14.4806 8.21336 15.3999 7.29405 15.3999 6.16002C15.3999 5.026 14.4806 4.10669 13.3465 4.10669C12.2125 4.10669 11.2932 5.026 11.2932 6.16002C11.2932 7.29405 12.2125 8.21336 13.3465 8.21336Z"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M9.2401 14.3733C10.3741 14.3733 11.2934 13.454 11.2934 12.3199C11.2934 11.1859 10.3741 10.2666 9.2401 10.2666C8.10608 10.2666 7.18677 11.1859 7.18677 12.3199C7.18677 13.454 8.10608 14.3733 9.2401 14.3733Z"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M16.4266 20.5334C17.5606 20.5334 18.48 19.6141 18.48 18.4801C18.48 17.3461 17.5606 16.4268 16.4266 16.4268C15.2926 16.4268 14.3733 17.3461 14.3733 18.4801C14.3733 19.6141 15.2926 20.5334 16.4266 20.5334Z"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case 'momentum':
      return (
        <>
          <Path
            d="M12.32 20.5334C16.8561 20.5334 20.5334 16.8561 20.5334 12.32C20.5334 7.78392 16.8561 4.10669 12.32 4.10669C7.78392 4.10669 4.10669 7.78392 4.10669 12.32C4.10669 16.8561 7.78392 20.5334 12.32 20.5334Z"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M12.32 15.4C14.021 15.4 15.4 14.021 15.4 12.32C15.4 10.619 14.021 9.23999 12.32 9.23999C10.619 9.23999 9.23999 10.619 9.23999 12.32C9.23999 14.021 10.619 15.4 12.32 15.4Z"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M12.3199 2.05322V5.13322M22.5866 12.3199H19.5066M12.3199 22.5866V19.5066M2.05322 12.3199H5.13322"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
    case 'nutrients':
      return (
        <>
          <Path
            d="M8.21338 6.15991H20.5334M8.21338 12.3199H20.5334M8.21338 18.4799H20.5334"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
          <Path
            d="M4.10669 6.15991H4.11696M4.10669 12.3199H4.11696M4.10669 18.4799H4.11696"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case 'report':
      return (
        <>
          <Path
            d="M17.4534 3.08008H7.18669C5.48565 3.08008 4.10669 4.45904 4.10669 6.16008V18.4801C4.10669 20.1811 5.48565 21.5601 7.18669 21.5601H17.4534C19.1544 21.5601 20.5334 20.1811 20.5334 18.4801V6.16008C20.5334 4.45904 19.1544 3.08008 17.4534 3.08008Z"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M8.21338 8.21338H16.4267M8.21338 12.32H16.4267M8.21338 16.4267H13.3467"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
    case 'tips':
      return (
        <>
          <Path
            d="M9.23999 18.48H15.4M10.2667 22.5866H14.3733"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M8.41863 14.8868C7.11595 14.0447 6.12066 12.8038 5.58147 11.3494C5.04228 9.89497 4.98812 8.30514 5.42709 6.81741C5.86606 5.32968 6.77459 4.0239 8.01695 3.09516C9.25932 2.16641 10.7688 1.66455 12.32 1.66455C13.8711 1.66455 15.3806 2.16641 16.623 3.09516C17.8653 4.0239 18.7739 5.32968 19.2128 6.81741C19.6518 8.30514 19.5977 9.89497 19.0585 11.3494C18.5193 12.8038 17.524 14.0447 16.2213 14.8868C15.092 15.8108 14.3733 16.8374 14.3733 18.4801H10.2666C10.2666 16.8374 9.54797 15.8108 8.41863 14.8868Z"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
    case 'weight':
      return (
        <>
          <Path
            d="M5.13336 20.5334H19.5067L20.5334 7.18677H4.10669L5.13336 20.5334Z"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M9.23999 11.2934C9.23999 10.4765 9.56449 9.6931 10.1421 9.11549C10.7197 8.53788 11.5031 8.21338 12.32 8.21338C13.1369 8.21338 13.9203 8.53788 14.4979 9.11549C15.0755 9.6931 15.4 10.4765 15.4 11.2934"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M12.3201 11.2933L14.3734 9.23999"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </>
      );
  }
}

export function ReportingIcon({
  name,
  size = 44,
  badgeColor,
  iconColor,
  testID,
}: ReportingIconProps) {
  const resolvedIconColor = iconColor ?? iconColors[name];

  return (
    <View
      accessible={false}
      testID={testID ?? `reporting-icon-${name}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 44 44">
        <Circle cx={22} cy={22} r={22} fill={badgeColor ?? badgeColors[name]} />
        <G transform="translate(9.68 9.68)">
          <ReportingIconPaths color={resolvedIconColor} name={name} />
        </G>
      </Svg>
    </View>
  );
}

export function ReportingChevron({
  direction,
  size = 18,
}: {
  direction: 'down' | 'up';
  size?: number;
}) {
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d={direction === 'down' ? 'M5 9L12 16L19 9' : 'M5 15L12 8L19 15'}
          fill="none"
          stroke="#6E6E6E"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.25}
        />
      </Svg>
    </View>
  );
}

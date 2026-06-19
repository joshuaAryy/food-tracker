export const colors = {
  light: {
    canvas: '#EDE4D1',
    surface: '#F8F3E8',
    surfaceRaised: '#FFFCF5',
    ink: '#252821',
    muted: '#74776E',
    border: '#D8CEBB',
    primary: '#7A9B76',
    primaryDark: '#506D4F',
    primarySoft: '#DDE7D8',
    water: '#7895A6',
    carbs: '#B59A5B',
    fat: '#A87962',
    error: '#A45E54',
    errorSoft: '#F1DDD7',
  },
  dark: {
    canvas: '#1B2028',
    surface: '#252B34',
    surfaceRaised: '#2B323C',
    ink: '#F2EEE6',
    muted: '#AEB5BE',
    border: '#3A424D',
    primary: '#91AF8B',
    primaryDark: '#B7CFB2',
    primarySoft: '#344338',
    water: '#8DAFC0',
    carbs: '#C7AA68',
    fat: '#C08E75',
    error: '#CF8175',
    errorSoft: '#4A312F',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  control: 14,
  card: 20,
  pill: 999,
} as const;

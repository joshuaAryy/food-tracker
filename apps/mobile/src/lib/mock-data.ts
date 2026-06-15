export const mockDashboardCards = [
  { label: 'Calories', value: '0 / 2,200 kcal' },
  { label: 'Protein', value: '0.0 / 150.0 g' },
  { label: 'Latest weight', value: 'No entries' },
] as const;

export const mockNavigationItems = [
  { href: '/onboarding', label: 'Onboarding' },
  { href: '/food-log', label: 'Log food' },
  { href: '/food-history', label: 'Food history' },
  { href: '/weight-tracking', label: 'Weight tracking' },
  { href: '/recommendations', label: 'Recommendations' },
  { href: '/settings', label: 'Settings' },
] as const;

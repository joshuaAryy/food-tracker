import { Text } from 'react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function OnboardingScreen() {
  return (
    <PlaceholderScreen
      title="Onboarding"
      description="Profile, goals, and tracking preferences will be collected here."
    >
      <Text className="text-slate-600">Mock step: Profile setup</Text>
    </PlaceholderScreen>
  );
}

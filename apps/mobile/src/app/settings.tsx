import { Pressable, Text, View } from 'react-native';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { useAppStore } from '@/store/app-store';

export default function SettingsScreen() {
  const mockMode = useAppStore((state) => state.mockMode);
  const setMockMode = useAppStore((state) => state.setMockMode);

  return (
    <PlaceholderScreen
      title="Settings"
      description="Profile and tracking preferences will be managed here."
    >
      <View className="gap-3">
        <Text className="text-slate-700">Mock tracking mode: {mockMode}</Text>
        <Pressable
          className="rounded-xl bg-slate-900 px-4 py-3"
          onPress={() =>
            setMockMode(mockMode === 'simple' ? 'complex' : 'simple')
          }
        >
          <Text className="text-center font-semibold text-white">
            Toggle mock mode
          </Text>
        </Pressable>
      </View>
    </PlaceholderScreen>
  );
}

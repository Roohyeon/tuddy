import { OnboardingScreen } from '@/components/screens/OnboardingScreen';
import { Guard } from '@/components/ui/Guards';

export default function OnboardingPage() {
  return <Guard need="user"><OnboardingScreen /></Guard>;
}

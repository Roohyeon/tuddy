import { AuthScreen } from '@/components/screens/AuthScreen';
import { Guard } from '@/components/ui/Guards';

export default function LoginPage() {
  return <Guard need="guest"><AuthScreen /></Guard>;
}

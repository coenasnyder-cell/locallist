import { useAccountStatus } from '@/hooks/useAccountStatus';
import { Redirect } from 'expo-router';
import BusinessHubScreen from '../business-hub';

export default function BusinessHubTabRoute() {
  const { user, profile, loading } = useAccountStatus();

  if (!loading && !user) {
    return <Redirect href="/login" />;
  }

  if (!loading && profile && profile.accountType !== 'business') {
    return <Redirect href="/(tabs)/profilebutton" />;
  }

  if (loading || (user && !profile)) {
    return null;
  }

  return <BusinessHubScreen showHeader={false} />;
}

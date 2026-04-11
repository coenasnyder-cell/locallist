import { Redirect } from 'expo-router';
import Profile from '../../components/profilecomp';
import { useAccountStatus } from '../../hooks/useAccountStatus';

export default function ProfileButtonRoute() {
	const { user, profile, loading } = useAccountStatus();
	const waitingForProfile = !!user && !profile;

	if (loading || waitingForProfile) {
		return null;
	}

	if (!user) {
		return <Redirect href="/signInOrSignUp" />;
	}

	if (profile?.accountType === 'business') {
		return <Redirect href="/(tabs)/businesshubbutton" />;
	}

	return <Profile />;
}

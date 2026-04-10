import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LoginRedirect() {
  const { email: emailParam, returnTo: returnToParam } = useLocalSearchParams();
  const email = Array.isArray(emailParam) ? emailParam[0] : emailParam;
  const returnTo = Array.isArray(returnToParam) ? returnToParam[0] : returnToParam;

  return (
    <Redirect
      href={{
        pathname: '/signInOrSignUp' as any,
        params: {
          ...(typeof email === 'string' && email ? { email } : {}),
          ...(typeof returnTo === 'string' && returnTo.startsWith('/') ? { returnTo } : {}),
        },
      }}
    />
  );
}


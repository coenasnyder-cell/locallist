import {
    getAuthErrorMessage,
    getPostAuthRoute,
    isPasswordAccountUnverified,
    normalizeAuthCode,
} from './auth-helpers';

describe('auth-helpers', () => {
  describe('normalizeAuthCode', () => {
    it('returns direct code when present', () => {
      expect(normalizeAuthCode({ code: 'auth/invalid-email' })).toBe('auth/invalid-email');
    });

    it('extracts auth code from message', () => {
      expect(normalizeAuthCode({ message: 'Firebase: Error (auth/wrong-password).' })).toBe('auth/wrong-password');
    });

    it('returns undefined when no code exists', () => {
      expect(normalizeAuthCode({ message: 'Some other error' })).toBeUndefined();
    });
  });

  describe('getAuthErrorMessage', () => {
    it('maps login wrong-password style errors', () => {
      expect(getAuthErrorMessage({ code: 'auth/wrong-password' }, 'login')).toBe('Invalid email or password.');
    });

    it('maps login too-many-requests errors', () => {
      expect(getAuthErrorMessage({ code: 'auth/too-many-requests' }, 'login')).toBe(
        'Too many failed login attempts. Please try again later.'
      );
    });

    it('maps signup duplicate-account errors', () => {
      expect(getAuthErrorMessage({ code: 'auth/email-already-in-use' }, 'signup')).toBe(
        'Account already exists. Please log in instead.'
      );
    });

    it('falls back to default signup message for unknown errors', () => {
      expect(getAuthErrorMessage(new Error('boom'), 'signup')).toBe('Signup failed. Please try again.');
    });
  });

  describe('getPostAuthRoute', () => {
    it('prioritizes listing route when listingId is provided', () => {
      expect(getPostAuthRoute({ listingId: 'abc123', returnTo: '/(tabs)', isNewUser: true })).toBe('/listing?id=abc123');
    });

    it('uses returnTo when listingId is not provided', () => {
      expect(getPostAuthRoute({ returnTo: '/(app)/help', isNewUser: true })).toBe('/(app)/help');
    });

    it('routes new users to profile onboarding when no overrides are provided', () => {
      expect(getPostAuthRoute({ isNewUser: true })).toBe('/(tabs)/profilebutton');
    });

    it('routes existing users to tabs by default', () => {
      expect(getPostAuthRoute()).toBe('/(tabs)');
    });
  });

  describe('isPasswordAccountUnverified', () => {
    it('returns true for unverified password users', () => {
      const user = {
        providerData: [{ providerId: 'password' }],
        emailVerified: false,
      } as any;
      expect(isPasswordAccountUnverified(user)).toBe(true);
    });

    it('returns false for verified password users', () => {
      const user = {
        providerData: [{ providerId: 'password' }],
        emailVerified: true,
      } as any;
      expect(isPasswordAccountUnverified(user)).toBe(false);
    });

    it('returns false for non-password providers', () => {
      const user = {
        providerData: [{ providerId: 'google.com' }],
        emailVerified: false,
      } as any;
      expect(isPasswordAccountUnverified(user)).toBe(false);
    });
  });
});

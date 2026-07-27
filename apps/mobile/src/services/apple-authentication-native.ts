import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { AppleAuthProvider } from '@react-native-firebase/auth';
import type { AppleAuthenticationAdapter } from './apple-authentication';

export function createNativeAppleAuthenticationAdapter(): AppleAuthenticationAdapter {
  return {
    randomBytes: Crypto.getRandomBytesAsync,
    digest: (rawNonce) =>
      Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce, {
        encoding: Crypto.CryptoEncoding.HEX,
      }),
    signIn: async ({ nonce }) => {
      const result = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce,
      });
      return {
        identityToken: result.identityToken,
        email: result.email,
        fullName:
          result.fullName === null
            ? null
            : {
                givenName: result.fullName.givenName,
                familyName: result.fullName.familyName,
              },
      };
    },
    createFirebaseCredential: (identityToken, rawNonce) =>
      AppleAuthProvider.credential(identityToken, rawNonce),
  };
}

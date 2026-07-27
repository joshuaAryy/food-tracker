import {
  GoogleSignin,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider } from '@react-native-firebase/auth';
import type { GoogleAuthenticationAdapter } from './google-authentication';

export function createNativeGoogleAuthenticationAdapter(): GoogleAuthenticationAdapter {
  return {
    configure: (options) => GoogleSignin.configure(options),
    signIn: async () => {
      const result = await GoogleSignin.signIn();
      if (!isSuccessResponse(result)) return { type: 'cancelled' };
      return { type: 'success', idToken: result.data.idToken };
    },
    createFirebaseCredential: (idToken) =>
      GoogleAuthProvider.credential(idToken),
  };
}

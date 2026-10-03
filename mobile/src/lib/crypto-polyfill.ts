// React Native has no WebCrypto, so Supabase's PKCE helper warned "WebCrypto API is not supported"
// and fell back to the `plain` challenge method, and made its code verifier from Math.random.
// This fills in the two pieces it looks for, backed by the phone's own crypto (expo-crypto), so
// sign-in uses S256 and a properly random verifier. Import it before creating the Supabase client.
import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto'

type MutableCrypto = {
  getRandomValues?: typeof getRandomValues
  subtle?: { digest: (algorithm: string, data: BufferSource) => Promise<ArrayBuffer> }
}

const root = globalThis as unknown as { crypto?: MutableCrypto }
if (!root.crypto) root.crypto = {}
const target = root.crypto

if (!target.getRandomValues) target.getRandomValues = getRandomValues

if (!target.subtle) {
  target.subtle = {
    digest: (algorithm, data) => {
      if (algorithm !== CryptoDigestAlgorithm.SHA256) {
        return Promise.reject(new Error(`Unsupported digest algorithm: ${algorithm}`))
      }
      return digest(CryptoDigestAlgorithm.SHA256, data)
    },
  }
}

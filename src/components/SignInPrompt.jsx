import useAuth from '../hooks/useAuth.js'
import Button from './Button.jsx'

// Shown on pages that belong to a signed-in shopper. Signing in returns to `returnPath`.
export default function SignInPrompt({ title, text, returnPath }) {
  const { available, signIn } = useAuth()
  return (
    <div className="state">
      <h1 className="display state__title">{title}</h1>
      <p className="state__text">{text}</p>
      {available && <Button onClick={() => signIn(returnPath)}>CONTINUE WITH GOOGLE</Button>}
    </div>
  )
}

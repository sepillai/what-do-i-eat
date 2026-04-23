'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleAuth() {
    setLoading(true)
    setMessage('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMessage(error.message)
      else {
        // Auto sign in after signup for easier dev experience
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (!signInError) router.push('/onboarding')
        else setMessage('Account created! Check your email to confirm, then sign in.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message)
      else router.push('/')
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="text-4xl">🥘</div>
          <h1 className="text-2xl font-bold">What Do I Eat?</h1>
          <p className="text-neutral-400 text-sm">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
            placeholder="Password (min 6 characters)"
            className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
          <button
            onClick={handleAuth}
            disabled={loading || !email || !password}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? 'Loading...' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </div>

        {message && (
          <p className="text-center text-sm text-neutral-400">{message}</p>
        )}

        <p className="text-center text-neutral-500 text-sm">
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}
            className="text-orange-400 hover:underline"
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </main>
  )
}
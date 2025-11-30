'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' or 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleEmailSubmit() {
    setLoading(true)
    setMessage('')
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        })
        if (error) throw error

        // 创建 profile 记录，默认 role=fan
        if (data.user) {
          await supabase.from('profiles').insert({
            id: data.user.id,
            display_name: data.user.email.split('@')[0]
          })
        }
        setMessage('Sign up successful. Please check your email if confirmation is required.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })
        if (error) throw error
        setMessage('Logged in successfully.')
      }
    } catch (err) {
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/auth'
      }
    })
    if (error) {
      setMessage(error.message)
      setLoading(false)
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h1 className="logo">GetFanSee</h1>
        <p className="tagline">Where fans get to see it all.</p>

        {!user && (
          <>
            <div className="tabs">
              <button
                className={mode === 'login' ? 'tab active' : 'tab'}
                onClick={() => setMode('login')}
              >
                Log in
              </button>
              <button
                className={mode === 'signup' ? 'tab active' : 'tab'}
                onClick={() => setMode('signup')}
              >
                Sign up
              </button>
            </div>

            <button className="google-btn" onClick={handleGoogle} disabled={loading}>
              Continue with Google
            </button>

            <div className="divider">
              <span>or use email</span>
            </div>

            <div className="form">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <button onClick={handleEmailSubmit} disabled={loading || !email || !password}>
                {mode === 'login' ? 'Log in' : 'Create account'}
              </button>
            </div>

            {mode === 'login' && (
              <p className="hint">Forgot password? You can add reset flow later in settings.</p>
            )}

            {message && <p className="message">{message}</p>}
          </>
        )}

        {user && (
          <>
            <p className="logged-in">You are logged in as {user.email}</p>
            <button className="logout-btn" onClick={handleLogout}>
              Log out
            </button>
          </>
        )}
      </div>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' or 'signup'
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        ensureProfile(session.user)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  async function ensureProfile(user) {
    const { data: existing, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (!error && !existing) {
      await supabase.from('profiles').insert({
        id: user.id,
        display_name: user.user_metadata?.full_name || user.email?.split('@')[0],
        role: 'fan'
      })
    }
  }

  const view = mode === 'login' ? 'sign_in' : 'sign_up'

  const appearance = {
    theme: ThemeSupa,
    variables: {
      default: {
        colors: {
          brand: '#0ea5e9',
          brandAccent: '#22c55e',
          inputBackground: '#020617',
          inputText: '#e5e7eb'
        }
      }
    },
    className: {
      container: 'auth-form',
      button: 'auth-button',
      input: 'auth-input'
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-left">
        <h1>Where fans get to see it all.</h1>
        <p className="subtitle">
          Not sure what you're into? <strong>We’ll figure it out.</strong>
        </p>
        <ul className="feature-list">
          <li>
            <span className="icon-square" /> Our algorithms find and filter content just for you.
          </li>
          <li>
            <span className="icon-search" /> Swipe and discover your next favorite creator.
          </li>
          <li>
            <span className="icon-chat" /> Livestreaming, personal messaging, and more.
          </li>
        </ul>
      </div>

      <div className="auth-right">
        <div className="switch-buttons">
          <button
            className={mode === 'signup' ? 'switch active' : 'switch'}
            onClick={() => setMode('signup')}
          >
            Sign up
          </button>
          <button
            className={mode === 'login' ? 'switch active' : 'switch'}
            onClick={() => setMode('login')}
          >
            Login
          </button>
        </div>

        <p className="terms">
          By joining, you agree to our <span>Terms &amp; Conditions</span> and{' '}
          <span>Privacy Policy</span>, and confirm that you are at least 18 years old.
        </p>

        <div className="auth-box">
          <Auth
            supabaseClient={supabase}
            view={view}
            providers={['google']}
            socialLayout="vertical"
            socialButtonSize="xlarge"
            onlyThirdPartyProviders={false}
            appearance={appearance}
          />
        </div>

        {user && (
          <p className="logged-in-info">You are logged in as {user.email}. (Later we redirect.)</p>
        )}
      </div>
    </div>
  )
}

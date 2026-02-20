import { useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { HeroSection } from './components/HeroSection'
import { ProductPreview } from './components/ProductPreview'
import { FeaturesSection } from './components/FeaturesSection'
import { HowItWorksSection } from './components/HowItWorksSection'
import { CtaSection } from './components/CtaSection'
import { Footer } from './components/Footer'
import { AuthModal } from './components/AuthModal'
import landingStyles from './landing.module.css'
import styles from './LandingPage.module.css'

type AuthMode = 'login' | 'register'

export function LandingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const authParam = searchParams.get('auth') as AuthMode | null
  const [modalOpen, setModalOpen] = useState(authParam === 'login' || authParam === 'register')
  const [authMode, setAuthMode] = useState<AuthMode>(
    authParam === 'register' ? 'register' : 'login',
  )

  const openModal = useCallback((mode: AuthMode) => {
    setAuthMode(mode)
    setModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setModalOpen(false)
    // Remove ?auth param if present
    if (searchParams.has('auth')) {
      searchParams.delete('auth')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  return (
    <div className={`${landingStyles.landing} ${styles.page}`}>
      <Navbar onLoginClick={() => openModal('login')} onSignupClick={() => openModal('register')} />
      <HeroSection onCtaClick={() => openModal('register')} />
      <ProductPreview />
      <FeaturesSection />
      <HowItWorksSection />
      <CtaSection onCtaClick={() => openModal('register')} />
      <Footer />
      <AuthModal isOpen={modalOpen} onClose={closeModal} initialMode={authMode} />
    </div>
  )
}

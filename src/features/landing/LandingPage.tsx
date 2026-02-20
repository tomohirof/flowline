import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { HeroSection } from './components/HeroSection'
import { ProductPreview } from './components/ProductPreview'
import { FeaturesSection } from './components/FeaturesSection'
import { HowItWorksSection } from './components/HowItWorksSection'
import { CtaSection } from './components/CtaSection'
import { Footer } from './components/Footer'
import landingStyles from './landing.module.css'
import styles from './LandingPage.module.css'

export function LandingPage() {
  const navigate = useNavigate()

  // PR1: redirect to /login (PR2 will change to modal)
  const handleLogin = useCallback(() => {
    navigate('/login')
  }, [navigate])

  const handleSignup = useCallback(() => {
    navigate('/register')
  }, [navigate])

  return (
    <div className={`${landingStyles.landing} ${styles.page}`}>
      <Navbar onLoginClick={handleLogin} onSignupClick={handleSignup} />
      <HeroSection onCtaClick={handleSignup} />
      <ProductPreview />
      <FeaturesSection />
      <HowItWorksSection />
      <CtaSection onCtaClick={handleSignup} />
      <Footer />
    </div>
  )
}

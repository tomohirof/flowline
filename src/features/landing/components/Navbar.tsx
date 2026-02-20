import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import styles from './Navbar.module.css'

interface NavbarProps {
  onLoginClick: () => void
  onSignupClick: () => void
}

export function Navbar({ onLoginClick, onSignupClick }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav
      data-testid="landing-navbar"
      className={`${styles.navbar} ${scrolled ? styles.scrolled : ''}`}
    >
      <div className={styles.inner}>
        <Link to="/" className={styles.logo}>
          <span className={styles.logoIcon}>F</span>
          <span className={styles.logoText}>Flowline</span>
        </Link>

        <div className={styles.navLinks}>
          <button className={styles.navLink} onClick={() => scrollTo('features')}>
            機能
          </button>
          <button className={styles.navLink} onClick={() => scrollTo('how-it-works')}>
            使い方
          </button>
        </div>

        <div className={styles.actions}>
          <button className={styles.loginBtn} onClick={onLoginClick}>
            ログイン
          </button>
          <button className={styles.signupBtn} onClick={onSignupClick}>
            無料で始める
          </button>
        </div>
      </div>
    </nav>
  )
}

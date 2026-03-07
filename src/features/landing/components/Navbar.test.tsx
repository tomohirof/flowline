// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { BRAND } from '../../../constants/brand'
import { Navbar } from './Navbar'

describe('Navbar', () => {
  afterEach(() => {
    cleanup()
  })

  const defaultProps = {
    onLoginClick: vi.fn(),
    onSignupClick: vi.fn(),
  }

  const renderNavbar = (props = defaultProps) => {
    return render(
      <MemoryRouter>
        <Navbar {...props} />
      </MemoryRouter>,
    )
  }

  it('should render with data-testid="landing-navbar"', () => {
    renderNavbar()
    expect(screen.getByTestId('landing-navbar')).toBeInTheDocument()
  })

  it('should render logo text "Flowline"', () => {
    renderNavbar()
    expect(screen.getByText(BRAND.name)).toBeInTheDocument()
  })

  it('should render logo icon "F"', () => {
    renderNavbar()
    expect(screen.getByText(BRAND.logoInitial)).toBeInTheDocument()
  })

  it('should render nav links (i18n keys)', () => {
    renderNavbar()
    expect(screen.getByText('nav.features')).toBeInTheDocument()
    expect(screen.getByText('nav.howToUse')).toBeInTheDocument()
  })

  it('should render login button (i18n key)', () => {
    renderNavbar()
    expect(screen.getByText('nav.login')).toBeInTheDocument()
  })

  it('should render signup button (i18n key)', () => {
    renderNavbar()
    expect(screen.getByText('brand.ctaButtonNav')).toBeInTheDocument()
  })

  it('should call onLoginClick when login button is clicked', async () => {
    const user = userEvent.setup()
    const onLoginClick = vi.fn()
    renderNavbar({ ...defaultProps, onLoginClick })

    await user.click(screen.getByText('nav.login'))
    expect(onLoginClick).toHaveBeenCalledTimes(1)
  })

  it('should call onSignupClick when signup button is clicked', async () => {
    const user = userEvent.setup()
    const onSignupClick = vi.fn()
    renderNavbar({ ...defaultProps, onSignupClick })

    await user.click(screen.getByText('brand.ctaButtonNav'))
    expect(onSignupClick).toHaveBeenCalledTimes(1)
  })

  it('should have nav link buttons for scrolling', () => {
    renderNavbar()
    const featuresBtn = screen.getByText('nav.features')
    const howItWorksBtn = screen.getByText('nav.howToUse')
    expect(featuresBtn.tagName).toBe('BUTTON')
    expect(howItWorksBtn.tagName).toBe('BUTTON')
  })
})

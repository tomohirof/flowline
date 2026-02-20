// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
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
    expect(screen.getByText('Flowline')).toBeInTheDocument()
  })

  it('should render logo icon "F"', () => {
    renderNavbar()
    expect(screen.getByText('F')).toBeInTheDocument()
  })

  it('should render nav links "機能" and "使い方"', () => {
    renderNavbar()
    expect(screen.getByText('機能')).toBeInTheDocument()
    expect(screen.getByText('使い方')).toBeInTheDocument()
  })

  it('should render "ログイン" button', () => {
    renderNavbar()
    expect(screen.getByText('ログイン')).toBeInTheDocument()
  })

  it('should render "無料で始める" button', () => {
    renderNavbar()
    expect(screen.getByText('無料で始める')).toBeInTheDocument()
  })

  it('should call onLoginClick when "ログイン" is clicked', async () => {
    const user = userEvent.setup()
    const onLoginClick = vi.fn()
    renderNavbar({ ...defaultProps, onLoginClick })

    await user.click(screen.getByText('ログイン'))
    expect(onLoginClick).toHaveBeenCalledTimes(1)
  })

  it('should call onSignupClick when "無料で始める" is clicked', async () => {
    const user = userEvent.setup()
    const onSignupClick = vi.fn()
    renderNavbar({ ...defaultProps, onSignupClick })

    await user.click(screen.getByText('無料で始める'))
    expect(onSignupClick).toHaveBeenCalledTimes(1)
  })

  it('should have nav link buttons for scrolling', () => {
    renderNavbar()
    const featuresBtn = screen.getByText('機能')
    const howItWorksBtn = screen.getByText('使い方')
    expect(featuresBtn.tagName).toBe('BUTTON')
    expect(howItWorksBtn.tagName).toBe('BUTTON')
  })
})

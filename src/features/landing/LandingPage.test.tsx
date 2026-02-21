// @vitest-environment jsdom
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LandingPage } from './LandingPage'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(),
    register: vi.fn(),
  }),
}))

describe('index.css global styles', () => {
  it('should not have body flex centering that prevents full-width layout', () => {
    const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8')
    expect(css).not.toContain('place-items: center')
    expect(css).not.toContain('place-items:center')
  })

  it('should set #root to full width', () => {
    const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8')
    expect(css).toMatch(/#root\s*\{[^}]*width:\s*100%/)
  })
})

describe('LandingPage', () => {
  afterEach(() => {
    cleanup()
  })

  const renderPage = () =>
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )

  it('Navbarを表示する', () => {
    renderPage()
    expect(screen.getByTestId('landing-navbar')).toBeInTheDocument()
  })

  it('HeroSectionを表示する', () => {
    renderPage()
    expect(screen.getByTestId('hero-section')).toBeInTheDocument()
  })

  it('ProductPreviewを表示する', () => {
    renderPage()
    expect(screen.getByTestId('product-preview')).toBeInTheDocument()
  })

  it('FeaturesSectionを表示する', () => {
    renderPage()
    expect(document.getElementById('features')).toBeInTheDocument()
  })

  it('HowItWorksSectionを表示する', () => {
    renderPage()
    expect(document.getElementById('how-it-works')).toBeInTheDocument()
  })

  it('Footerを表示する', () => {
    renderPage()
    expect(screen.getByTestId('landing-footer')).toBeInTheDocument()
  })

  it('ログインボタンクリックでAuthModalが表示される', async () => {
    renderPage()
    fireEvent.click(screen.getByText('ログイン'))
    expect(screen.getByTestId('auth-modal')).toBeInTheDocument()
  })

  it('無料で始めるボタンクリックでAuthModalが新規登録モードで表示される', async () => {
    renderPage()
    fireEvent.click(screen.getAllByText(/無料で始める/)[0])
    expect(screen.getByTestId('auth-modal')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('お名前')).toBeInTheDocument()
  })
})

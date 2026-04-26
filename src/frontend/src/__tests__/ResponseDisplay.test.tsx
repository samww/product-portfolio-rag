import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ResponseDisplay } from '../components/ResponseDisplay'
import type { CitedSource } from '../lib/querySession'

function renderDisplay(props: Partial<React.ComponentProps<typeof ResponseDisplay>> = {}) {
  return render(
    <MemoryRouter>
      <ResponseDisplay
        answer={props.answer ?? 'AuthService is the relevant app.'}
        cited={props.cited ?? []}
        uncited={props.uncited ?? []}
        context={props.context ?? []}
        isStreaming={props.isStreaming ?? false}
      />
    </MemoryRouter>
  )
}

describe('ResponseDisplay — source pills', () => {
  it('renders a pill for every cited source', () => {
    const cited: CitedSource[] = [
      { name: 'AuthService', kind: 'app' },
      { name: 'CoreProduct', kind: 'product' },
    ]
    renderDisplay({ cited })
    expect(screen.getByText('AuthService')).toBeInTheDocument()
    expect(screen.getByText('CoreProduct')).toBeInTheDocument()
  })

  it('applies cited (yellow) styling to app sources', () => {
    const cited: CitedSource[] = [{ name: 'AuthService', kind: 'app' }]
    renderDisplay({ cited })
    expect(screen.getByText('AuthService').className).toMatch(/yellow/)
  })

  it('applies cited (yellow) styling to product sources', () => {
    const cited: CitedSource[] = [{ name: 'CoreProduct', kind: 'product' }]
    renderDisplay({ cited })
    expect(screen.getByText('CoreProduct').className).toMatch(/yellow/)
  })

  it('renders uncited app sources with violet styling', () => {
    const uncited: CitedSource[] = [{ name: 'PaymentGateway', kind: 'app' }]
    renderDisplay({ answer: 'nothing relevant', uncited })
    expect(screen.getByText('PaymentGateway').className).toMatch(/violet/)
  })

  it('renders uncited product sources with blue styling', () => {
    const uncited: CitedSource[] = [{ name: 'CoreProduct', kind: 'product' }]
    renderDisplay({ answer: 'nothing relevant', uncited })
    expect(screen.getByText('CoreProduct').className).toMatch(/blue/)
  })

  it('renders both cited and uncited sources together', () => {
    const cited: CitedSource[] = [{ name: 'AuthService', kind: 'app' }]
    const uncited: CitedSource[] = [{ name: 'PaymentGateway', kind: 'app' }]
    renderDisplay({ cited, uncited })
    expect(screen.getByText('AuthService').className).toMatch(/yellow/)
    expect(screen.getByText('PaymentGateway').className).toMatch(/violet/)
  })
})

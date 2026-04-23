import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ResponseDisplay } from '../components/ResponseDisplay'

function renderDisplay(props: Partial<React.ComponentProps<typeof ResponseDisplay>> = {}) {
  return render(
    <MemoryRouter>
      <ResponseDisplay
        answer={props.answer ?? 'AuthService is the relevant app.'}
        appSources={props.appSources ?? []}
        productSources={props.productSources ?? []}
        context={props.context ?? []}
        isStreaming={props.isStreaming ?? false}
      />
    </MemoryRouter>
  )
}

describe('ResponseDisplay — source pills', () => {
  it('renders a pill for every app source, including those not in the answer text', () => {
    renderDisplay({
      answer: 'AuthService is the relevant app.',
      appSources: ['AuthService', 'PaymentGateway'],
    })
    expect(screen.getByText('AuthService')).toBeInTheDocument()
    expect(screen.getByText('PaymentGateway')).toBeInTheDocument()
  })

  it('applies cited styling to sources whose name appears in the answer', () => {
    renderDisplay({
      answer: 'AuthService is the relevant app.',
      appSources: ['AuthService', 'PaymentGateway'],
    })
    const cited = screen.getByText('AuthService')
    expect(cited.className).toMatch(/yellow/)
  })

  it('applies uncited styling to sources whose name does not appear in the answer', () => {
    renderDisplay({
      answer: 'AuthService is the relevant app.',
      appSources: ['AuthService', 'PaymentGateway'],
    })
    const uncited = screen.getByText('PaymentGateway')
    expect(uncited.className).toMatch(/violet/)
  })
})

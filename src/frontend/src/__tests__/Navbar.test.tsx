import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Navbar } from '../components/Navbar'

function renderNavbar(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<Navbar />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('Navbar — hamburger', () => {
  it('hamburger button is present in the DOM', () => {
    renderNavbar()
    expect(screen.getByRole('button', { name: /toggle navigation menu/i })).toBeInTheDocument()
  })

  it('hamburger starts with aria-expanded="false"', () => {
    renderNavbar()
    expect(screen.getByRole('button', { name: /toggle navigation menu/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('clicking hamburger sets aria-expanded to true', async () => {
    const user = userEvent.setup()
    renderNavbar()
    await user.click(screen.getByRole('button', { name: /toggle navigation menu/i }))
    expect(screen.getByRole('button', { name: /toggle navigation menu/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('clicking a nav link in the open mobile menu closes it', async () => {
    const user = userEvent.setup()
    renderNavbar()
    await user.click(screen.getByRole('button', { name: /toggle navigation menu/i }))
    const mobileLinks = screen.getAllByRole('link', { name: /risk summary/i })
    await user.click(mobileLinks[mobileLinks.length - 1])
    expect(screen.getByRole('button', { name: /toggle navigation menu/i })).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('Navbar — links', () => {
  it('renders nav links for Query, Risk Summary, and Embeddings', () => {
    renderNavbar()
    expect(screen.getByRole('link', { name: /query/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /risk summary/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /embeddings/i })).toBeInTheDocument()
  })

  it('the link matching the current route has aria-current="page"', () => {
    renderNavbar('/summary')
    expect(screen.getByText('Risk Summary').closest('[aria-current="page"]')).toBeInTheDocument()
    expect(screen.queryByText('Query')?.closest('[aria-current="page"]')).not.toBeInTheDocument()
  })
})

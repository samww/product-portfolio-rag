import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryChips } from '../components/QueryChips'

const GROUPS = ['Risk', 'ROI', 'Governance', 'Explore']

const CHIPS = [
  { group: 'Risk', query: 'How much revenue is at risk from the DataLicensing product\'s infrastructure dependencies?' },
  { group: 'Risk', query: 'Which applications have a Critical or High risk rating?' },
  { group: 'ROI', query: 'Which products have the highest ROI relative to their application costs?' },
  { group: 'ROI', query: 'Are there any products where application costs exceed the revenue they support?' },
  { group: 'Governance', query: 'Which applications have no named owner?' },
  { group: 'Governance', query: 'Which applications are approaching end-of-life?' },
  { group: 'Explore', query: 'Which applications have been recently modernised and what savings did that deliver?' },
  { group: 'Explore', query: 'Are there applications with overlapping capabilities that could be consolidated?' },
]

describe('QueryChips', () => {
  it('renders all 4 group labels', () => {
    render(<QueryChips onSelect={() => {}} />)
    for (const group of GROUPS) {
      expect(screen.getByText(group)).toBeInTheDocument()
    }
  })

  it('renders all 8 chips', () => {
    render(<QueryChips onSelect={() => {}} />)
    for (const { query } of CHIPS) {
      expect(screen.getByText(query)).toBeInTheDocument()
    }
  })

  it('calls onSelect with correct query when a chip is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<QueryChips onSelect={onSelect} />)

    await user.click(screen.getByText(CHIPS[0].query))
    expect(onSelect).toHaveBeenCalledWith(CHIPS[0].query)
  })

  it('calls onSelect with the query for whichever chip is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<QueryChips onSelect={onSelect} />)

    await user.click(screen.getByText(CHIPS[4].query))
    expect(onSelect).toHaveBeenCalledWith(CHIPS[4].query)
  })
})

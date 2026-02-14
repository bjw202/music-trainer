import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from '@/App'

describe('App', () => {
  it('renders heading', () => {
    render(<App />)
    const heading = screen.getByText('Music Trainer')
    expect(heading).toBeInTheDocument()
  })

  it('renders file upload area', () => {
    render(<App />)
    const dropZone = screen.getByRole('button', { name: /drag and drop audio file/i })
    expect(dropZone).toBeInTheDocument()
  })
})

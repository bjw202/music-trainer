import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Mock Worker for jsdom environment
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  private timerId: ReturnType<typeof setInterval> | null = null

  constructor(_url: string | URL) {
    // No-op in test environment
  }

  postMessage(message: string): void {
    if (message === 'start') {
      this.timerId = setInterval(() => {
        if (this.onmessage) {
          this.onmessage({ data: 'tick' } as MessageEvent)
        }
      }, 25)
    } else if (message === 'stop') {
      if (this.timerId) {
        clearInterval(this.timerId)
        this.timerId = null
      }
    }
  }

  terminate(): void {
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
    }
  }
}

// @ts-expect-error - Worker is not defined in jsdom
globalThis.Worker = MockWorker

// Mock URL.createObjectURL
URL.createObjectURL = vi.fn(() => 'blob:mock-url')
URL.revokeObjectURL = vi.fn()

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

// Type declarations for jest-dom matchers
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeInTheDocument(): T
    toBeDisabled(): T
    toBeEnabled(): T
    toBeEmpty(): T
    toBeEmptyDOMElement(): T
    toBeInvalid(): T
    toBeRequired(): T
    toBeValid(): T
    toBeVisible(): T
    toContainElement(element: Element | null): T
    toContainHTML(html: string): T
    toHaveAccessibleDescription(description?: string | RegExp): T
    toHaveAccessibleName(name?: string | RegExp): T
    toHaveAttribute(attr: string, value?: string | RegExp): T
    toHaveClass(...classNames: string[]): T
    toHaveFocus(): T
    toHaveFormValues(values: Record<string, any>): T
    toHaveStyle(css: Record<string, any>): T
    toHaveTextContent(text: string | RegExp, options?: { normalizeWhitespace: boolean }): T
    toHaveValue(value?: string | string[] | number): T
    toHaveDisplayValue(value?: string | string[] | RegExp): T
    toBeChecked(): T
    toBePartiallyChecked(): T
    toHaveErrorMessage(message?: string | RegExp): T
  }
}

// Cleanup after each test
afterEach(() => {
  cleanup()
})

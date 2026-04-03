// Ink global type augmentations
// This file is imported for JSX namespace side effects

import * as React from 'react'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'ink-box': React.HTMLAttributes<HTMLElement> & { [key: string]: unknown }
      'ink-text': React.HTMLAttributes<HTMLElement> & { [key: string]: unknown }
      'ink-newline': React.HTMLAttributes<HTMLElement>
      'ink-spacer': React.HTMLAttributes<HTMLElement>
      'ink-virtual': React.HTMLAttributes<HTMLElement>
      'ink-virtual-newline': React.HTMLAttributes<HTMLElement>
    }
  }
}

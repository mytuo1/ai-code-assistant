import { writeFileSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'

const reactDir = join('node_modules', 'react')

// 1. compiler-runtime shim
if (existsSync(reactDir)) {
  const shimPath = join(reactDir, 'compiler-runtime.js')
  if (!existsSync(shimPath)) {
    writeFileSync(shimPath, `export function c(size) {
  return new Array(size).fill(Symbol.for('react.memo_cache_sentinel'))
}\n`)
  }

  // 2. Rewrite index.js as a wrapper that spreads React + adds missing APIs
  const indexPath = join(reactDir, 'index.js')
  writeFileSync(indexPath, `'use strict';
// Patched by install-shims.js to add React 19 APIs missing from React 18
const React = require('./cjs/react.production.min.js');
const shims = {
  use: React.use || function use(thenable) {
    if (thenable && typeof thenable.then === 'function') throw thenable;
    return thenable;
  },
  useEffectEvent: React.useEffectEvent || function useEffectEvent(fn) { return fn; },
};
module.exports = Object.assign({}, React, shims);
`)
  console.log('✓ Rewrote react/index.js with React 19 shims')
}

// 3. react-reconciler/constants
if (existsSync(join('node_modules', 'react-reconciler'))) {
  writeFileSync(join('node_modules', 'react-reconciler', 'constants.js'),
`export var NoEventPriority = 0;
export var DefaultEventPriority = 0;
export var DiscreteEventPriority = 1;
export var ContinuousEventPriority = 4;
export var IdleEventPriority = 536870912;
export var LegacyRoot = 0;
export var ConcurrentRoot = 1;
`)
  console.log('✓ Patched react-reconciler/constants.js')
}
console.log('✓ Done')
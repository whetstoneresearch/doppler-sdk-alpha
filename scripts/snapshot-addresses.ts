#!/usr/bin/env -S node

import { ADDRESSES } from '../src/addresses'

// Print only the used addresses snapshot to stdout
console.log(JSON.stringify(ADDRESSES, null, 2))



/**
 * MSW Browser setup for development mode
 * This allows testing auth flows in the browser without a real backend
 */

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);


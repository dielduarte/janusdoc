/**
 * UI module that provides real or mocked prompts based on context
 */
import * as p from '@clack/prompts';

// Check if we're in silent mode (set by commands)
let silentMode = false;

export function setSilentMode(enabled: boolean) {
  silentMode = enabled;
}

// Create mock implementations
const noop = () => {};
const noopSpinner = {
  start: noop,
  stop: noop,
  message: noop,
};

// Export either real or mocked versions
export const intro = (message: string) => {
  if (!silentMode) p.intro(message);
};

export const outro = (message: string) => {
  if (!silentMode) p.outro(message);
};

export const log = {
  info: (message: string) => {
    if (!silentMode) p.log.info(message);
  },
  warn: (message: string) => {
    if (!silentMode) p.log.warn(message);
  },
  success: (message: string) => {
    if (!silentMode) p.log.success(message);
  },
  error: (message: string) => {
    if (!silentMode) p.log.error(message);
  },
};

export const note = (message: string, title?: string) => {
  if (!silentMode) p.note(message, title);
};

export const spinner = () => {
  if (silentMode) return noopSpinner;
  return p.spinner();
};

export const cancel = p.cancel;
export const isCancel = p.isCancel;
export const confirm = p.confirm;
export const text = p.text;

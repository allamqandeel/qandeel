import { ANALYSIS_COMMAND_WORDS } from '../../analysis-language';
import type { PresentationController } from '../window/controller';

/**
 * Arabic-Indic (U+0660–0669) and Extended Arabic-Indic (U+06F0–06F9) digits, and the Arabic percent
 * sign, read as their Western forms, so an Arabic keyboard can enter a percentage as it is.
 */
const normalizeDigits = (text: string): string =>
  text
    .replace(/[٠-٩]/gu, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/gu, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٪/gu, '%');

type Command = 'first' | 'last' | 'next' | 'previous' | 'narrow' | 'widen';

/** Every approved command word of EITHER language: an Arabic reader never has to type English. */
function wordCommand(text: string): Command | null {
  for (const words of ANALYSIS_COMMAND_WORDS) {
    for (const command of ['first', 'last', 'next', 'previous', 'narrow', 'widen'] as const) {
      if (text === words[command].toLowerCase()) return command;
    }
  }
  return null;
}

/** Text + Enter works with native external keyboards and assistive text entry;
 * no dependence on web-only keydown or an onKeyPress hardware-key guarantee. */
export function runPresentationCommand(controller: PresentationController, input: string): boolean {
  const command = normalizeDigits(input.trim().toLowerCase());
  const word = wordCommand(command);
  if (word === 'first' || word === 'last') {
    controller.move({ type: 'PRESENTATION_POSITION_MOVE', position: word === 'first' ? 0 : 1 });
  } else if (word === 'next' || word === 'previous') {
    controller.page(word === 'next' ? 1 : -1);
  } else if (command === '+' || command === '-' || command === 'plus' || command === 'minus') {
    controller.adjust(command === '+' || command === 'plus' ? 1 : -1);
  } else if (word === 'narrow' || word === 'widen') {
    controller.move({ type: word === 'narrow' ? 'PRESENTATION_POSITION_REFINE' : 'PRESENTATION_POSITION_WIDEN' });
  } else if (/^(?:\d{1,3}(?:\.\d{1,3})?)%?$/.test(command)) {
    const value = Number(command.replace('%', ''));
    if (value > 100) return false;
    controller.move({ type: 'PRESENTATION_POSITION_MOVE', position: value / 100 });
  } else return false;
  return true;
}

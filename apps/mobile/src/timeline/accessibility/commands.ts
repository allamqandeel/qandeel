import type { PresentationController } from '../window/controller';

/** Text + Enter works with native external keyboards and assistive text entry;
 * no dependence on web-only keydown or an onKeyPress hardware-key guarantee. */
export function runPresentationCommand(controller: PresentationController, input: string): boolean {
  const command = input.trim().toLowerCase();
  if (command === 'first' || command === 'last') {
    controller.move({ type: 'PRESENTATION_POSITION_MOVE', position: command === 'first' ? 0 : 1 });
  } else if (command === 'next' || command === 'previous') {
    controller.page(command === 'next' ? 1 : -1);
  } else if (command === '+' || command === '-' || command === 'plus' || command === 'minus') {
    controller.adjust(command === '+' || command === 'plus' ? 1 : -1);
  } else if (command === 'refine' || command === 'widen') {
    controller.move({ type: command === 'refine' ? 'PRESENTATION_POSITION_REFINE' : 'PRESENTATION_POSITION_WIDEN' });
  } else if (/^(?:\d{1,3}(?:\.\d{1,3})?)%?$/.test(command)) {
    const value = Number(command.replace('%', ''));
    if (value > 100) return false;
    controller.move({ type: 'PRESENTATION_POSITION_MOVE', position: value / 100 });
  } else return false;
  return true;
}

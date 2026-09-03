import { render, screen } from '@testing-library/react-native';

import {
  FOUNDATION_SHELL_STATUS,
  FOUNDATION_SHELL_TEST_ID,
  FOUNDATION_SHELL_TITLE,
  FoundationShell,
} from '../FoundationShell';

describe('FoundationShell (T-01 technical boot assertion)', () => {
  it('renders the technical shell reachable by test id, accessibility label and header text', async () => {
    await render(<FoundationShell />);

    expect(screen.getByTestId(FOUNDATION_SHELL_TEST_ID)).toBeTruthy();
    expect(screen.getByLabelText(`${FOUNDATION_SHELL_TITLE} ${FOUNDATION_SHELL_STATUS}`)).toBeTruthy();
    expect(screen.getByRole('header', { name: FOUNDATION_SHELL_TITLE })).toBeTruthy();
    expect(screen.getByText(FOUNDATION_SHELL_STATUS)).toBeTruthy();
  });
});

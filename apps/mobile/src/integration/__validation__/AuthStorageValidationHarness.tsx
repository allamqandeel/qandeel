/**
 * T-12 Phase M — the `QAN-BL-T12-04` harness surface, extended by T-13 with the recovery procedures.
 *
 * VALIDATION ONLY, and deliberately ugly. It is the least interface that can take two credentials and
 * show a report on a device, and it is not a login gateway: no branding, no onboarding, no provider
 * buttons, no Product copy, no Product language, no visual language, and no path to any Product
 * surface. Building the real sign-in experience is explicitly out of scope, and nothing here should
 * ever be mistaken for a first draft of one.
 *
 * It is never mounted by the Product route. `app/index.tsx` renders `ProductRoot`, `ProductRoot`
 * imports nothing from this directory, and the T-12 static contract proves that the whole production
 * import closure — the router root, the shell, and every module `ProductRoot` transitively reaches —
 * contains no reference to `__validation__` at all. The only way to run this is the separate entry
 * beside it, selected at build time.
 *
 * ## Credentials
 *
 * Typed at validation time, held in component state for the life of one run, `secureTextEntry` on the
 * password, never logged, never persisted, never rendered back, and never placed in the report. There
 * is no default, no placeholder value and no autofill hint carrying one. A failure shows the failure
 * KIND, so a screenshot of this screen is safe to attach as evidence.
 *
 * ## T-13
 *
 * The recovery procedures take two more inputs, neither a credential: a Session LOCATOR to adopt and a
 * Moment to pin. The report they produce prints the Session locator on purpose — "the same Session came
 * back" can only be checked across two launches by comparing values — and nothing else that is not a
 * kind, a mode or a count.
 */

import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  validateAfterRestart,
  validateBeforeRestart,
  validateSignOutAndReplacement,
  type AuthStorageValidationReport,
} from './auth-storage-validation';
import { runRecoveryValidation, type RecoveryRunKind, type RecoveryValidationReport } from './recovery-validation';

export const VALIDATION_HARNESS_TEST_ID = 'qandeel-t1204-validation-harness';

type RunKind = 'BEFORE_RESTART' | 'AFTER_RESTART' | 'SIGN_OUT_AND_REPLACEMENT';

const RECOVERY_RUNS: readonly RecoveryRunKind[] = [
  'RECOVERY_BEFORE',
  'RECOVERY_AFTER',
  'RECOVERY_AFTER_SIGNED_OUT',
  'RECOVERY_AFTER_REFUSED',
  'ADOPT_SESSION',
  'PIN_MOMENT',
  'RECOVERY_SIGN_OUT',
  'RECOVERY_REPLACEMENT',
];

export function AuthStorageValidationHarness() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secondEmail, setSecondEmail] = useState('');
  const [secondPassword, setSecondPassword] = useState('');
  const [sessionLocator, setSessionLocator] = useState('');
  const [moment, setMoment] = useState('');
  const [report, setReport] = useState<AuthStorageValidationReport | RecoveryValidationReport | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(
    async (kind: RunKind) => {
      setRunning(true);
      setReport(null);
      try {
        if (kind === 'BEFORE_RESTART') {
          setReport(await validateBeforeRestart({ email, password }));
        } else if (kind === 'AFTER_RESTART') {
          setReport(await validateAfterRestart());
        } else {
          const replacement = secondEmail === '' ? null : { email: secondEmail, password: secondPassword };
          setReport(await validateSignOutAndReplacement(replacement));
        }
      } finally {
        // The credentials are dropped the moment the run that needed them is over. They are held for
        // exactly as long as one procedure call, and never longer.
        setPassword('');
        setSecondPassword('');
        setRunning(false);
      }
    },
    [email, password, secondEmail, secondPassword],
  );

  const runRecovery = useCallback(
    async (kind: RecoveryRunKind) => {
      setRunning(true);
      setReport(null);
      try {
        setReport(
          await runRecoveryValidation(kind, {
            credentials: email === '' ? undefined : { email, password },
            replacement: secondEmail === '' ? undefined : { email: secondEmail, password: secondPassword },
            sessionId: sessionLocator === '' ? undefined : sessionLocator,
            moment: moment === '' ? undefined : Number(moment),
          }),
        );
      } finally {
        setPassword('');
        setSecondPassword('');
        setRunning(false);
      }
    },
    [email, password, secondEmail, secondPassword, sessionLocator, moment],
  );

  return (
    <View style={styles.root} testID={VALIDATION_HARNESS_TEST_ID}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>T-12 / QAN-BL-T12-04 + T-13 recovery validation harness — NOT PRODUCT</Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          accessibilityLabel="validation identity email"
          testID="t1204-email"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="validation identity password"
          testID="t1204-password"
        />
        <TextInput
          style={styles.input}
          value={secondEmail}
          onChangeText={setSecondEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          accessibilityLabel="replacement identity email"
          testID="t1204-second-email"
        />
        <TextInput
          style={styles.input}
          value={secondPassword}
          onChangeText={setSecondPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="replacement identity password"
          testID="t1204-second-password"
        />
        {/* T-13 inputs. Neither is a credential: a Session locator and a Moment ordinal. */}
        <TextInput
          style={styles.input}
          value={sessionLocator}
          onChangeText={setSessionLocator}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="session locator to adopt"
          testID="t13-session-locator"
        />
        <TextInput
          style={styles.input}
          value={moment}
          onChangeText={setMoment}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="number-pad"
          accessibilityLabel="moment to pin"
          testID="t13-moment"
        />

        {/*
          The credential BOUNDARY, stated in quantities that are not the credential.

          A run once failed with `INVALID_CREDENTIALS` while the same identity authenticated directly,
          and the evidence needed to say where the value was lost did not exist: the field is erased
          before any screenshot by design, and the per-run diagnostics were overwritten. Character
          counts and distinctness answer "did the value arrive, whole and as the right one" without
          carrying any part of the value, so the next run can localise the boundary instead of
          guessing at it. Nothing here is reversible into a credential, and nothing is persisted.
        */}
        {/*
          Each count carries a name no other count contains as a substring. The first version wrote
          `email=` and `second-email=`, and an assertion looking for `email=0` matched the SECOND one —
          which is legitimately zero until a replacement identity is entered. The flow therefore failed
          before it ever reached the sign-in, and the failure looked exactly like a credential that had
          not arrived. A diagnostic that can be misread as the fault it is meant to localise is worse
          than none.
        */}
        <Text style={styles.step} testID="t1204-input-lengths">
          {`identityEmailChars=${email.length} identityPasswordChars=${password.length} replacementEmailChars=${secondEmail.length} replacementPasswordChars=${secondPassword.length} identitiesDistinct=${String(email.length > 0 && secondEmail.length > 0 && email !== secondEmail)} sessionLocatorChars=${sessionLocator.length} momentChars=${moment.length}`}
        </Text>

        {(['BEFORE_RESTART', 'AFTER_RESTART', 'SIGN_OUT_AND_REPLACEMENT'] as const).map((kind) => (
          <TouchableOpacity
            key={kind}
            style={styles.button}
            disabled={running}
            onPress={() => void run(kind)}
            accessibilityRole="button"
            accessibilityLabel={`run ${kind}`}
            testID={`t1204-run-${kind}`}
          >
            <Text style={styles.buttonText}>{running ? 'running…' : `run ${kind}`}</Text>
          </TouchableOpacity>
        ))}

        {RECOVERY_RUNS.map((kind) => (
          <TouchableOpacity
            key={kind}
            style={styles.button}
            disabled={running}
            onPress={() => void runRecovery(kind)}
            accessibilityRole="button"
            accessibilityLabel={`run ${kind}`}
            testID={`t13-run-${kind}`}
          >
            <Text style={styles.buttonText}>{running ? 'running…' : `run ${kind}`}</Text>
          </TouchableOpacity>
        ))}

        {report === null ? null : (
          <View testID="t1204-report">
            <Text style={styles.heading}>{`${report.phase} — allPassed=${String(report.allPassed)}`}</Text>
            {report.steps.map((entry) => (
              <Text key={entry.id} style={styles.step} testID={`t1204-step-${entry.id}`}>
                {`${entry.outcome}  ${entry.id}\n  ${entry.claim}\n  ${entry.evidence}`}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 64 },
  content: { padding: 16, rowGap: 12 },
  heading: { fontSize: 14, fontWeight: '600' },
  input: { minHeight: 44, borderWidth: 1, paddingHorizontal: 8 },
  button: { minHeight: 44, justifyContent: 'center', borderWidth: 1, paddingHorizontal: 8 },
  buttonText: { fontSize: 14 },
  step: { fontSize: 12, marginTop: 8 },
});

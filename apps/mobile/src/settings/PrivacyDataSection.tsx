/**
 * W3-MEGA-S — the Language row of «قنديل والمحادثة» / QANDEEL & Conversation and the «الخصوصية والبيانات» /
 * Privacy & Data group, inside the ONE General Settings destination (P1 §8.1; W3-PDG-01 §5, §7, §8).
 *
 *   LanguageRow        the language QANDEEL is in now, by its own name; it opens the SYSTEM's language setting.
 *                      There is no in-app switch (W3-PDG-01 §5).
 *   PrivacyDataRows    Export my data and Delete account, each with the state the server holds:
 *                        export  — request · preparing · ready until {date} + Download · expired · could not prepare;
 *                        delete  — request · will be deleted on {date} + Cancel deletion · being deleted now · blocked.
 *                      Never "deleted" before the final deletion.
 *   ExportRequest      the password, behind the export promise; then the package is prepared on the server.
 *   DeletionRequest    the consequence first, then the password, then the one destructive act.
 *
 * Both requests are STATES of this destination (the W3-MEGA-A `ChangeForm`): no route, no dialog, no new world; its
 * title is the first thing a screen reader reaches, the consequence is read before the password field, and a result
 * is said in one polite live region. Every word comes from `copy.ts`; every date comes from the one locale authority
 * (Egypt, Western digits) on the Gregorian calendar.
 */
import { Text, View } from 'react-native';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import { numberFormattingTag, productLocale } from '../integration';
import type { ChromeLanguage } from '../orientation-chrome';
import type { PrivacyStateView } from '../runtime-entry';
import { ActionRow, ChangeForm, isolatedLtr, type Outcome } from './AccountSecuritySection';
import type { LanguageCopy, PrivacyDataCopy } from './copy';
import type { PrivacyDataController } from './privacy-data-controller';

const ROW_START = 24;
const ROW_END = 20;

const writingOf = (language: ChromeLanguage) => (language === 'ar' ? 'rtl' : 'ltr');

/** A day, in the reader's Product language, on the one locale authority's numeral policy and the Gregorian calendar. */
export function formatDay(instant: string, language: ChromeLanguage): string {
  const tag = `${numberFormattingTag(productLocale(language, language === 'ar' ? 'RTL' : 'LTR'))}-ca-gregory`;
  return new Intl.DateTimeFormat(tag, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(instant));
}

/** A term and the state it is in: read, never pressed. */
function StatusRow({ term, status, language, palette, testID }: {
  readonly term: string;
  readonly status: string;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly testID: string;
}) {
  const writing = writingOf(language);
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={[term, status].join(', ')}
      accessibilityLanguage={language}
      style={{ minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, justifyContent: 'center', rowGap: 2 }}
    >
      <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{term}</Text>
      <Text testID={`${testID}-status`} style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{status}</Text>
    </View>
  );
}

export function LanguageRow({ copy, language, palette, onOpen, rowRef }: {
  readonly copy: LanguageCopy;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly onOpen: () => void;
  readonly rowRef?: (node: View | null) => void;
}) {
  const writing = writingOf(language);
  const name = copy.names[language];
  // A language name written in another script is its own run, so it never reorders the line around it.
  const drawn = language === 'ar' ? name : isolatedLtr(name);
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityLabel={[copy.term, name].join(', ')}
      onPress={onOpen}
      testID="qandeel-language-row"
      controlRef={rowRef}
      style={{ minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0 }}
    >
      <View style={{ rowGap: 2 }}>
        <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{copy.term}</Text>
        <Text testID="qandeel-language-row-value" style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{drawn}</Text>
      </View>
    </Control>
  );
}

export function PrivacyDataRows({ view, copy, language, palette, notices, busy, onRequestExport, onDownload, onRequestDeletion, onCancelDeletion, rowRef }: {
  readonly view: PrivacyStateView;
  readonly copy: PrivacyDataCopy;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly notices: { readonly export: string | null; readonly deletion: string | null };
  readonly busy: { readonly download: boolean; readonly cancel: boolean };
  readonly onRequestExport: () => void;
  readonly onDownload: () => void;
  readonly onRequestDeletion: () => void;
  readonly onCancelDeletion: () => void;
  readonly rowRef: (key: 'EXPORT' | 'DELETE') => (node: View | null) => void;
}) {
  const exportState = view.export;
  const deletion = view.deletion;
  let exportRows;
  if (exportState.status === 'PREPARING') {
    exportRows = <StatusRow term={copy.exportAction} status={copy.exportPreparing} language={language} palette={palette} testID="qandeel-export-status" />;
  } else if (exportState.status === 'READY' && exportState.availableUntil !== null) {
    exportRows = (
      <>
        <StatusRow term={copy.exportAction} status={copy.exportReady(formatDay(exportState.availableUntil, language))} language={language} palette={palette} testID="qandeel-export-status" />
        <ActionRow label={copy.exportDownload} notice={notices.export} busy={busy.download} language={language} palette={palette} onPress={onDownload} testID="qandeel-export-download" />
      </>
    );
  } else {
    const said = exportState.status === 'EXPIRED' ? copy.exportExpired : exportState.status === 'FAILED' ? copy.exportFailed : notices.export;
    exportRows = <ActionRow label={copy.exportAction} notice={said} busy={false} language={language} palette={palette} onPress={onRequestExport} rowRef={rowRef('EXPORT')} testID="qandeel-export-request" />;
  }

  let deletionRows;
  if (deletion.status === 'SCHEDULED' && deletion.finalAt !== null) {
    deletionRows = (
      <>
        <StatusRow term={copy.deleteAction} status={copy.deleteScheduled(formatDay(deletion.finalAt, language))} language={language} palette={palette} testID="qandeel-deletion-status" />
        <ActionRow label={copy.deleteCancel} notice={notices.deletion} busy={busy.cancel} language={language} palette={palette} onPress={onCancelDeletion} testID="qandeel-deletion-cancel" />
      </>
    );
  } else if (deletion.status === 'BLOCKED') {
    deletionRows = (
      <>
        <StatusRow term={copy.deleteAction} status={copy.deleteBlocked} language={language} palette={palette} testID="qandeel-deletion-status" />
        <ActionRow label={copy.deleteCancel} notice={notices.deletion} busy={busy.cancel} language={language} palette={palette} onPress={onCancelDeletion} testID="qandeel-deletion-cancel" />
      </>
    );
  } else if (deletion.status === 'FINALIZING' || deletion.status === 'SCHEDULED') {
    deletionRows = <StatusRow term={copy.deleteAction} status={copy.deleteFinalizing} language={language} palette={palette} testID="qandeel-deletion-status" />;
  } else {
    deletionRows = <ActionRow label={copy.deleteAction} notice={notices.deletion} busy={false} language={language} palette={palette} onPress={onRequestDeletion} rowRef={rowRef('DELETE')} testID="qandeel-deletion-request" />;
  }

  return (
    <>
      {exportRows}
      {deletionRows}
    </>
  );
}

interface RequestProps {
  readonly controller: PrivacyDataController;
  readonly copy: PrivacyDataCopy;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  /** Leave the request, saying what is now true. */
  readonly onAccepted: () => void;
  readonly busyChanged: (busy: boolean) => void;
}

function requestOutcome(result: 'ACCEPTED' | 'EMPTY' | 'PASSWORD_REJECTED' | 'RETRY' | null, copy: PrivacyDataCopy, onAccepted: () => void): Outcome {
  switch (result) {
    case 'ACCEPTED':
      return onAccepted;
    case 'EMPTY':
      return copy.enterPassword;
    case 'PASSWORD_REJECTED':
      return copy.passwordIncorrect;
    case 'RETRY':
      return copy.network;
    default:
      return null;
  }
}

export function ExportRequest({ controller, copy, language, palette, onAccepted, busyChanged }: RequestProps) {
  return (
    <ChangeForm
      testID="qandeel-export-request-form"
      title={copy.exportAction}
      fields={[{ key: 'password', label: copy.password, kind: 'password', instruction: copy.exportExplain }]}
      confirmLabel={copy.exportConfirm}
      language={language}
      palette={palette}
      busyChanged={busyChanged}
      onConfirm={async (values) => requestOutcome(await controller.requestExport(values.password ?? ''), copy, onAccepted)}
    />
  );
}

export function DeletionRequest({ controller, copy, language, palette, onAccepted, busyChanged }: RequestProps) {
  return (
    <ChangeForm
      testID="qandeel-deletion-request-form"
      title={copy.deleteAction}
      fields={[{ key: 'password', label: copy.password, kind: 'password', instruction: copy.deleteExplain }]}
      confirmLabel={copy.deleteConfirm}
      language={language}
      palette={palette}
      busyChanged={busyChanged}
      onConfirm={async (values) => requestOutcome(await controller.requestDeletion(values.password ?? ''), copy, onAccepted)}
    />
  );
}

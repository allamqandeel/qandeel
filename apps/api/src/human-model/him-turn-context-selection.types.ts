export interface HimTurnContextSelection {
  contractVersion: 1;
  selectionState: 'SELECTED';
  source: 'AUTHORITATIVE_CONVERSATION_TURN';
  sourceTurnId: string;
  contextKind: 'CONVERSATION_SESSION';
  contextId: string;
  selectionReason: 'AUTHORITATIVE_SESSION_BINDING';
}

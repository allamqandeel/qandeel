/**
 * The three frozen promoted-act authorities, re-exported for the integration proofs.
 *
 * They are imported from their owners' public barrels so a test asserting identity is comparing
 * against the same objects production wires, not against a copy.
 */
export { MAP_ACTION_AUTHORITY } from '../../map';
export { TEMPORAL_ACTION_AUTHORITY } from '../../temporal-navigation';
export { RETURN_ACTION_AUTHORITY } from '../../return-navigation';

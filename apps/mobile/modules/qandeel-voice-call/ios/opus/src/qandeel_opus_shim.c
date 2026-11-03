/* S8B-06 CP2 (iOS) — see include/qandeel_opus_shim.h. Not part of libopus. */
#include "qandeel_opus_shim.h"

int qandeel_opus_encoder_configure(OpusEncoder *enc, int bitrate, int complexity, int inband_fec, int loss_percent, int dtx) {
  int err;
  if ((err = opus_encoder_ctl(enc, OPUS_SET_BITRATE(bitrate))) != OPUS_OK) return err;
  if ((err = opus_encoder_ctl(enc, OPUS_SET_COMPLEXITY(complexity))) != OPUS_OK) return err;
  if ((err = opus_encoder_ctl(enc, OPUS_SET_INBAND_FEC(inband_fec))) != OPUS_OK) return err;
  if ((err = opus_encoder_ctl(enc, OPUS_SET_PACKET_LOSS_PERC(loss_percent))) != OPUS_OK) return err;
  if ((err = opus_encoder_ctl(enc, OPUS_SET_DTX(dtx))) != OPUS_OK) return err;
  return opus_encoder_ctl(enc, OPUS_SET_SIGNAL(OPUS_SIGNAL_VOICE));
}

int qandeel_opus_encoder_reset(OpusEncoder *enc) {
  return opus_encoder_ctl(enc, OPUS_RESET_STATE);
}

int qandeel_opus_decoder_reset(OpusDecoder *dec) {
  return opus_decoder_ctl(dec, OPUS_RESET_STATE);
}

int qandeel_opus_encoder_get(OpusEncoder *enc, int *bitrate, int *complexity, int *inband_fec, int *loss_percent, int *dtx) {
  opus_int32 b = 0, c = 0, f = 0, l = 0, d = 0;
  int err;
  if ((err = opus_encoder_ctl(enc, OPUS_GET_BITRATE(&b))) != OPUS_OK) return err;
  if ((err = opus_encoder_ctl(enc, OPUS_GET_COMPLEXITY(&c))) != OPUS_OK) return err;
  if ((err = opus_encoder_ctl(enc, OPUS_GET_INBAND_FEC(&f))) != OPUS_OK) return err;
  if ((err = opus_encoder_ctl(enc, OPUS_GET_PACKET_LOSS_PERC(&l))) != OPUS_OK) return err;
  if ((err = opus_encoder_ctl(enc, OPUS_GET_DTX(&d))) != OPUS_OK) return err;
  *bitrate = (int)b; *complexity = (int)c; *inband_fec = (int)f; *loss_percent = (int)l; *dtx = (int)d;
  return OPUS_OK;
}

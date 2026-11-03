/* S8B-06 CP2 (iOS) — QANDEEL's shim over libopus 1.5.2: Swift cannot call the variadic opus_*_ctl, so the few
 * settings the frozen v1 frame format needs (D-C1) are set through these plain functions. Not part of libopus. */
#ifndef QANDEEL_OPUS_SHIM_H
#define QANDEEL_OPUS_SHIM_H

#include "opus.h"

#ifdef __cplusplus
extern "C" {
#endif

/** The uplink settings: bitrate (bps), complexity 0-10, in-band FEC on/off, expected loss %, DTX on/off, voice signal. */
int qandeel_opus_encoder_configure(OpusEncoder *enc, int bitrate, int complexity, int inband_fec, int loss_percent, int dtx);
int qandeel_opus_encoder_reset(OpusEncoder *enc);
int qandeel_opus_decoder_reset(OpusDecoder *dec);
/** Reads back what the encoder holds (the codec probe test). */
int qandeel_opus_encoder_get(OpusEncoder *enc, int *bitrate, int *complexity, int *inband_fec, int *loss_percent, int *dtx);

#ifdef __cplusplus
}
#endif

#endif

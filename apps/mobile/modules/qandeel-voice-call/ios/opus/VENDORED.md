# libopus 1.5.2 — vendored for the QANDEEL iOS call (S8B-06 CP2)

- **Source:** `https://downloads.xiph.org/releases/opus/opus-1.5.2.tar.gz` (the Xiph.Org release tarball; the Product
  Owner approved the download for S8B-06 CP2).
- **sha256 of the tarball:** `65c1d2f78b9f2fb20082c38cbe47c951ad5839345876e46941612ee87f9a7ce1`, 7,839,412 bytes, checked
  before extraction.
- **Licence:** BSD-3-Clause (`COPYING`, unchanged; the authors are in `AUTHORS`).
- **What was taken:** the float build's encoder and decoder only: `include/`, `src/` (no `opus_demo`, `opus_compare`,
  `repacketizer_demo`, no DNN / DRED / OSCE / LPCNet code), `celt/` (no `arm/`, `x86/`, `mips/`, no tests), `silk/` and
  `silk/float/` (the `silk/fixed/` headers that the float build includes; no fixed-point sources). The 137 compiled
  sources are listed in `sources.txt`, copied byte for byte; no upstream file was edited.
- **Build defines:** `OPUS_BUILD`, `VAR_ARRAYS`, `HAVE_LRINTF`, `HAVE_LRINT` (no `config.h`; no SIMD, no assembly).
- **QANDEEL's own files:** `include/qandeel_opus_shim.h` and `src/qandeel_opus_shim.c` (the encoder settings Swift cannot
  set through the variadic `opus_*_ctl`). Not part of libopus.
- **Why vendored and not Apple's Opus:** `AVAudioConverter`'s Opus encoder exposes no in-band FEC setting, and the frozen
  v1 uplink requires FEC on with a 10 % expected loss (D-C1). The server's codec is libopus too.
- **Built by:** `QandeelOpus.podspec` (the app; its Swift module is `COpus`) and `Package.swift` (the host and simulator
  tests).

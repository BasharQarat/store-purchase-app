export function isBarcodeScanSupported() {
  return (
    typeof navigator !== "undefined" &&
    !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  );
}

function playBeep(audioCtx) {
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.type = "sine";
  oscillator.frequency.value = 1800;
  gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.12);
  oscillator.onended = () => audioCtx.close();
}

export async function startBarcodeScan(videoElement, onDetected) {
  // Created up front (in the same tick as the button's click handler,
  // before any await) so browser autoplay policies treat it as unlocked
  // by the user gesture — creating it later, at detection time, can get
  // silently blocked.
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioCtx = AudioContextClass ? new AudioContextClass() : null;

  const hints = new Map();
  hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
    ZXing.BarcodeFormat.CODE_128,
    ZXing.BarcodeFormat.EAN_13,
    ZXing.BarcodeFormat.EAN_8,
    ZXing.BarcodeFormat.UPC_A,
    ZXing.BarcodeFormat.UPC_E,
  ]);
  const reader = new ZXing.BrowserMultiFormatReader(hints);

  let stopped = false;

  await reader.decodeFromConstraints(
    { video: { facingMode: "environment" } },
    videoElement,
    (result) => {
      if (stopped || !result) return;
      stopped = true;
      reader.reset();
      if (audioCtx) playBeep(audioCtx);
      onDetected(result.getText());
    }
  );

  return function cancelScan() {
    if (!stopped) {
      stopped = true;
      reader.reset();
    }
  };
}

export function isBarcodeScanSupported() {
  return (
    typeof navigator !== "undefined" &&
    !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  );
}

export async function startBarcodeScan(videoElement, onDetected) {
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

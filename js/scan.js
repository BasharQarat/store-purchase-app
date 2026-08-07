export function isBarcodeScanSupported() {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

export async function startBarcodeScan(videoElement, onDetected) {
  const detector = new BarcodeDetector({ formats: ["code_128"] });
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" },
  });
  videoElement.srcObject = stream;
  await videoElement.play();

  let stopped = false;

  function stopStream() {
    stream.getTracks().forEach((track) => track.stop());
  }

  async function tick() {
    if (stopped) return;
    try {
      const barcodes = await detector.detect(videoElement);
      if (barcodes.length > 0) {
        stopped = true;
        stopStream();
        onDetected(barcodes[0].rawValue);
        return;
      }
    } catch {
      // A transient bad frame can throw; keep scanning.
    }
    requestAnimationFrame(tick);
  }

  tick();

  return function cancelScan() {
    stopped = true;
    stopStream();
  };
}

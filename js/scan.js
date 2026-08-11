export function isBarcodeScanSupported() {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
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

  const detector = new BarcodeDetector({
    formats: ["code_128", "ean_13", "ean_8", "upc_a", "upc_e"],
  });
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
        if (audioCtx) playBeep(audioCtx);
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
    if (audioCtx) audioCtx.close();
  };
}

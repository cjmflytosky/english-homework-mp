/**
 * 录音封装：基于 wx.getRecorderManager
 *   - start()       开始录音
 *   - stop()        停止并返回 { tempFilePath, duration }
 *   - onFrame(cb)   计时回调，每 200ms 触发一次
 *
 * 录音参数：mp3 / 16kHz / 16k 比特率，便于后续走 SOE 评测。
 */
const DEFAULT_MAX_DURATION_MS = 60_000; // 默认单题最长 60 秒

export interface RecordResult {
  tempFilePath: string;
  duration: number; // 毫秒
  fileSize: number;
}

let manager: any = null;
let timer: ReturnType<typeof setInterval> | null = null;
let elapsedMs = 0;
let currentMaxMs = DEFAULT_MAX_DURATION_MS;
let frameCb: ((ms: number) => void) | null = null;

function ensureManager() {
  if (!manager) manager = wx.getRecorderManager();
  return manager;
}

export function start(
  onFrame?: (ms: number) => void,
  maxDurationMs?: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const mgr = ensureManager();
    elapsedMs = 0;
    currentMaxMs = maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
    frameCb = onFrame ?? null;

    const onStart = () => {
      mgr.offStart?.(onStart);
      mgr.offError?.(onError);
      // 启动 200ms 计时
      timer = setInterval(() => {
        elapsedMs += 200;
        frameCb?.(elapsedMs);
        if (elapsedMs >= currentMaxMs) {
          mgr.stop();
        }
      }, 200);
      resolve();
    };
    const onError = (err: { errMsg: string }) => {
      mgr.offStart?.(onStart);
      mgr.offError?.(onError);
      reject(new Error(err.errMsg));
    };

    mgr.onStart?.(onStart);
    mgr.onError?.(onError);

    mgr.start({
      duration: currentMaxMs,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 24000,
      format: 'mp3',
    });
  });
}

export function stop(): Promise<RecordResult> {
  return new Promise((resolve, reject) => {
    const mgr = ensureManager();
    const cleanup = () => {
      if (timer) { clearInterval(timer); timer = null; }
      mgr.offStop?.(onStop);
      mgr.offError?.(onError);
      frameCb = null;
    };

    const onStop = (res: { tempFilePath: string; duration: number; fileSize: number }) => {
      cleanup();
      resolve({
        tempFilePath: res.tempFilePath,
        duration: res.duration,
        fileSize: res.fileSize,
      });
    };
    const onError = (err: { errMsg: string }) => {
      cleanup();
      reject(new Error(err.errMsg));
    };

    mgr.onStop?.(onStop);
    mgr.onError?.(onError);
    mgr.stop();
  });
}

export function getMaxDurationMs(): number {
  return DEFAULT_MAX_DURATION_MS;
}

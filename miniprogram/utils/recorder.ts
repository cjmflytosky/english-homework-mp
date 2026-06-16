/**
 * 录音封装：基于 wx.getRecorderManager（小程序内全局单例）。
 *
 *   start(onFrame?, maxDurationMs?, onAutoStop?)  开始录音
 *     - onFrame(ms)    计时回调，每 200ms 触发
 *     - maxDurationMs  录音上限（到点后原生自动停）
 *     - onAutoStop(r)  到达上限自动停时回调（手动 stop 不走这里）
 *   stop()            手动停止，返回 { tempFilePath, duration, fileSize }
 *   isRecording()     当前是否正在录音
 *
 * 关键：onStart/onStop/onError 在管理器上**只注册一次**，并用 recording/starting
 * 状态守卫防止「audio is recording」重复启动错误；自动停（到时长上限）也能被捕获。
 *
 * 录音参数：mp3 / 16kHz，便于后续走 SOE 评测。
 */
const DEFAULT_MAX_DURATION_MS = 60_000;

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
let autoStopCb: ((r: RecordResult) => void) | null = null;

let recording = false; // 录音真正进行中（onStart 后）
let starting = false; // 已调用 start，等待 onStart（防双触发）
let pendingStart: { resolve: () => void; reject: (e: Error) => void } | null = null;
let pendingStop: { resolve: (r: RecordResult) => void; reject: (e: Error) => void } | null = null;

function clearTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function ensureManager() {
  if (manager) return manager;
  manager = wx.getRecorderManager();

  manager.onStart(() => {
    starting = false;
    recording = true;
    clearTimer();
    elapsedMs = 0;
    timer = setInterval(() => {
      elapsedMs += 200;
      frameCb?.(elapsedMs);
    }, 200);
    pendingStart?.resolve();
    pendingStart = null;
  });

  manager.onStop((res: RecordResult) => {
    recording = false;
    starting = false;
    clearTimer();
    if (pendingStop) {
      // 手动 stop()
      pendingStop.resolve(res);
      pendingStop = null;
    } else {
      // 到达 duration 上限的自动停
      autoStopCb?.(res);
    }
  });

  manager.onError((err: { errMsg: string }) => {
    recording = false;
    starting = false;
    clearTimer();
    if (pendingStart) {
      pendingStart.reject(new Error(err.errMsg));
      pendingStart = null;
    }
    if (pendingStop) {
      pendingStop.reject(new Error(err.errMsg));
      pendingStop = null;
    }
  });

  return manager;
}

export function start(
  onFrame?: (ms: number) => void,
  maxDurationMs?: number,
  onAutoStop?: (r: RecordResult) => void,
): Promise<void> {
  const mgr = ensureManager();
  frameCb = onFrame ?? null;
  autoStopCb = onAutoStop ?? null;
  currentMaxMs = maxDurationMs ?? DEFAULT_MAX_DURATION_MS;

  // 已在录音 / 正在启动：忽略重复启动，避免原生报 "audio is recording"
  if (recording || starting) return Promise.resolve();

  starting = true;
  return new Promise<void>((resolve, reject) => {
    pendingStart = { resolve, reject };
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
  const mgr = ensureManager();
  if (!recording) {
    return Promise.reject(new Error('当前没有进行中的录音'));
  }
  return new Promise<RecordResult>((resolve, reject) => {
    pendingStop = { resolve, reject };
    mgr.stop();
  });
}

export function isRecording(): boolean {
  return recording || starting;
}

export function getMaxDurationMs(): number {
  return DEFAULT_MAX_DURATION_MS;
}

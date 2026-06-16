/**
 * 提示音「嘟」：用 WebAudioContext 合成一段短促正弦音，免去打包音频文件。
 *
 * - 播完（约 0.2s）后 resolve。
 * - 真机若 WebAudioContext 不可用（旧基础库），静默跳过、立即 resolve，
 *   不阻断「范读→嘟→录音」的串联流程。
 */
const BEEP_FREQ_HZ = 880; // A5，清脆好辨识
const BEEP_MS = 220;
const BEEP_GAIN = 0.2;

export function beep(): Promise<void> {
  return new Promise((resolve) => {
    try {
      const createCtx = (wx as unknown as {
        createWebAudioContext?: () => any;
      }).createWebAudioContext;
      if (!createCtx) {
        resolve();
        return;
      }
      const ctx = createCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = BEEP_FREQ_HZ;
      gain.gain.value = BEEP_GAIN;
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      osc.start(now);
      osc.stop(now + BEEP_MS / 1000);

      setTimeout(() => {
        try {
          ctx.close?.();
        } catch (e) {
          // 忽略关闭异常
        }
        resolve();
      }, BEEP_MS + 60);
    } catch (e) {
      // 合成失败不阻断主流程
      resolve();
    }
  });
}

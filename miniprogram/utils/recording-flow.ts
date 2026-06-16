/**
 * 录音「回放 / 上传」复用逻辑：单词卡片页与长句跟读页共用。
 *
 * 录音本身仍用 utils/recorder 的 start/stop；本模块只负责：
 *   - playbackLocal：回放本地临时录音文件（页面负责销毁返回的 audioContext）
 *   - uploadRecording：本地录音 → COS → 登记为某题提交项（复用现有提交链路）
 */
import { uploadFile } from './upload';
import { uploadSubmissionItem } from '../api/submission';
import { SubmissionItem } from '../api/types';

/** 回放本地录音文件，返回 audioContext 供页面控制 / 在 onUnload 里销毁 */
export function playbackLocal(
  filePath: string,
): WechatMiniprogram.InnerAudioContext {
  const ctx = wx.createInnerAudioContext();
  ctx.src = filePath;
  ctx.play();
  return ctx;
}

export interface UploadRecordingParams {
  assignmentId: string;
  homeworkItemId: string;
  filePath: string;
  durationMs: number;
}

/** 上传本地录音并登记为某题的提交项，返回登记后的 SubmissionItem */
export async function uploadRecording(
  params: UploadRecordingParams,
): Promise<SubmissionItem> {
  const { assignmentId, homeworkItemId, filePath, durationMs } = params;
  const uploaded = await uploadFile(filePath);
  const { item } = await uploadSubmissionItem({
    assignmentId,
    homeworkItemId,
    audioUrl: uploaded.url,
    duration: Math.round(durationMs / 1000),
  });
  return item;
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HomeworkType } from '@prisma/client';

export interface SoeEvalResult {
  /** 总分（百分制 0~100，整数） */
  score: number;
  /** 流利度 */
  fluency: number;
  /** 完整度 */
  integrity: number;
  /** 发音 */
  pronunciation: number;
  /** 原始返回（COS 接入时存 SOE 完整 JSON） */
  raw: Record<string, unknown>;
}

/**
 * 语音评测抽象层。
 *
 * ⚠️ MVP 阶段已下线：SubmissionService 不再调用 evaluate()。
 *    数据库 Submission.totalScore / SubmissionItem.score 等字段保留为 null，
 *    前端不展示分数。未来恢复评分时：
 *      1) 接入腾讯云 SOE SDK 替换 mockEvaluate
 *      2) 在 SubmissionService.uploadAndScoreItem 里恢复 speech.evaluate 调用
 *      3) 在 SubmissionService.finalize 里恢复加权平均
 *      4) 前端恢复分数字段展示
 *
 *   SOE_MOCK=true：本地按文本长度/随机给出 70~98 的拟真分
 *   SOE_MOCK=false：留给后续接入腾讯云 SOE
 */
@Injectable()
export class SpeechService {
  private readonly logger = new Logger(SpeechService.name);

  constructor(private readonly config: ConfigService) {}

  async evaluate(params: {
    audioUrl: string;
    refText: string;
    type: HomeworkType;
  }): Promise<SoeEvalResult> {
    const mock = this.config.get<boolean>('soe.mock');
    if (mock) return this.mockEvaluate(params);
    // 接入时使用 tencentcloud-sdk-nodejs 调用 SOE，返回字段映射到 SoeEvalResult
    return this.mockEvaluate(params);
  }

  // ---------------------------------------------------------------

  private mockEvaluate(params: {
    audioUrl: string;
    refText: string;
    type: HomeworkType;
  }): SoeEvalResult {
    // 用稳定算法生成「看起来真实」的分数：
    //   - 基础分由 refText 长度 + audioUrl 哈希派生（同一题反复评估，分差很小）
    //   - 背诵稍微比跟读严格 2 分
    const seed = this.hash(params.audioUrl + ':' + params.refText.length);
    const base = 78 + (seed % 18); // 78~95
    const penalty = params.type === 'RECITE' ? 2 : 0;

    const overall = Math.max(60, Math.min(100, base - penalty));
    // 三维度围绕总分±3 波动
    const pronunciation = Math.max(60, Math.min(100, overall + ((seed % 7) - 3)));
    const fluency = Math.max(60, Math.min(100, overall + ((seed % 5) - 2)));
    const integrity = Math.max(60, Math.min(100, overall + ((seed % 9) - 4)));

    const result: SoeEvalResult = {
      score: overall,
      pronunciation,
      fluency,
      integrity,
      raw: {
        mock: true,
        audioUrl: params.audioUrl,
        refTextLen: params.refText.length,
        type: params.type,
      },
    };
    this.logger.log(
      `[mock-soe] type=${params.type} score=${overall} f=${fluency} i=${integrity} p=${pronunciation}`,
    );
    return result;
  }

  private hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }
}

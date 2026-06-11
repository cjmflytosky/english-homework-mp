import { BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { StorageService } from './storage.service';

// mock COS SDK：构造函数返回一个带可控 putObject 的实例
const putObjectMock = jest.fn();
jest.mock('cos-nodejs-sdk-v5', () =>
  jest.fn().mockImplementation(() => ({ putObject: putObjectMock })),
);

type CosMap = Record<string, unknown>;

function makeConfig(map: CosMap) {
  return {
    get: (key: string) => map[key],
  } as { get: (key: string) => unknown };
}

const BASE_COS = {
  'cos.region': 'ap-guangzhou',
  'cos.bucket': 'xc-homework-1250000000',
  'cos.secretId': 'AKIDxxxx',
  'cos.secretKey': 'secretxxxx',
  'cos.mock': false,
  port: 3000,
};

describe('StorageService', () => {
  beforeEach(() => {
    putObjectMock.mockReset();
  });

  it('空 buffer 抛 BadRequestException', async () => {
    const svc = new StorageService(makeConfig(BASE_COS) as never);
    await expect(
      svc.uploadBuffer(Buffer.alloc(0), 'a.mp3', 'audio/mp3'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('mock 模式写本地并返回 localhost URL', async () => {
    const svc = new StorageService(
      makeConfig({ ...BASE_COS, 'cos.mock': true }) as never,
    );
    const mkdir = jest.spyOn(fs, 'mkdir').mockResolvedValue(undefined as never);
    const writeFile = jest
      .spyOn(fs, 'writeFile')
      .mockResolvedValue(undefined as never);

    const res = await svc.uploadBuffer(
      Buffer.from('hello'),
      'rec.mp3',
      'audio/mp3',
    );

    expect(mkdir).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalled();
    expect(res.url).toMatch(/^http:\/\/localhost:3000\/uploads\/audios\//);
    expect(res.key).toMatch(/^audios\/\d{8}\/[a-f0-9]+\.mp3$/);
    expect(res.size).toBe(5);
    expect(putObjectMock).not.toHaveBeenCalled();

    mkdir.mockRestore();
    writeFile.mockRestore();
  });

  it('生产模式上传 COS 成功，返回 https 永久 URL', async () => {
    putObjectMock.mockImplementation((_params, cb) =>
      cb(null, {
        Location: 'xc-homework-1250000000.cos.ap-guangzhou.myqcloud.com/audios/20260611/abcd.mp3',
        statusCode: 200,
      }),
    );
    const svc = new StorageService(makeConfig(BASE_COS) as never);

    const res = await svc.uploadBuffer(
      Buffer.from('audio-bytes'),
      'rec.mp3',
      'audio/mp3',
    );

    expect(putObjectMock).toHaveBeenCalledTimes(1);
    const params = putObjectMock.mock.calls[0][0];
    expect(params.Bucket).toBe('xc-homework-1250000000');
    expect(params.Region).toBe('ap-guangzhou');
    expect(params.ACL).toBe('public-read');
    expect(params.ContentType).toBe('audio/mp3');
    expect(res.url).toBe(
      'https://xc-homework-1250000000.cos.ap-guangzhou.myqcloud.com/audios/20260611/abcd.mp3',
    );
  });

  it('生产模式缺 bucket 抛 BadRequestException', async () => {
    const svc = new StorageService(
      makeConfig({ ...BASE_COS, 'cos.bucket': '' }) as never,
    );
    await expect(
      svc.uploadBuffer(Buffer.from('x'), 'a.mp3', 'audio/mp3'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(putObjectMock).not.toHaveBeenCalled();
  });

  it('生产模式缺密钥抛 BadRequestException', async () => {
    const svc = new StorageService(
      makeConfig({ ...BASE_COS, 'cos.secretId': '' }) as never,
    );
    await expect(
      svc.uploadBuffer(Buffer.from('x'), 'a.mp3', 'audio/mp3'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('COS putObject 失败时抛 BadRequestException', async () => {
    putObjectMock.mockImplementation((_params, cb) =>
      cb(new Error('AccessDenied'), null),
    );
    const svc = new StorageService(makeConfig(BASE_COS) as never);
    await expect(
      svc.uploadBuffer(Buffer.from('x'), 'a.mp3', 'audio/mp3'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

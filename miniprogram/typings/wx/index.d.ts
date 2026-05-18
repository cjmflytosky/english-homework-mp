// 简化版小程序全局声明（让 IDE / 微信开发者工具的 tsc 不报错）
// 正式项目建议 `npm i -D miniprogram-api-typings` 拿到完整类型，然后删除本文件。

declare const wx: any;
declare const App: any;
declare const Page: any;
declare const Component: any;
declare const Behavior: any;
declare const getApp: <T = IAppOption>() => T;
declare const getCurrentPages: () => any[];

declare namespace WechatMiniprogram {
  interface BaseEvent {
    detail: any;
    currentTarget: any;
    target: any;
  }
  interface CustomEvent<T = any> extends BaseEvent {
    detail: T;
  }
  interface InnerAudioContext {
    src: string;
    play(): void;
    stop(): void;
    pause(): void;
    destroy?: () => void;
    onPlay?: (cb: () => void) => void;
    onEnded?: (cb: () => void) => void;
    onError?: (cb: (err: any) => void) => void;
  }
}

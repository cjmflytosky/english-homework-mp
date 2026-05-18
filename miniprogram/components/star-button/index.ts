Component({
  options: { multipleSlots: true },
  properties: {
    type: { type: String, value: 'primary' }, // primary / ghost
    disabled: { type: Boolean, value: false },
    openType: { type: String, value: '' },
  },
  methods: {
    onTap(e: WechatMiniprogram.BaseEvent) {
      if (this.data.disabled) return;
      this.triggerEvent('tap', e.detail);
    },
    onGetUserInfo(e: WechatMiniprogram.CustomEvent) {
      this.triggerEvent('getuserinfo', e.detail);
    },
    onGetPhoneNumber(e: WechatMiniprogram.CustomEvent) {
      this.triggerEvent('getphonenumber', e.detail);
    },
    onChooseAvatar(e: WechatMiniprogram.CustomEvent) {
      this.triggerEvent('chooseavatar', e.detail);
    },
  },
});

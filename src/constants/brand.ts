export const BRAND = {
  // ── ブランド基本情報（非翻訳） ──
  name: 'Flowline',
  logoInitial: 'F',
  copyright: '© 2026 Flowline',

  // ── URL（非翻訳） ──
  siteUrl: 'https://flowline.six1.jp/',
  flowsUrl: 'https://flowline.six1.jp/flows',

  // ── 以下は i18n 移行中。翻訳は landing.json / shared.json に定義済み ──
  // ── 各コンポーネント i18n 完了後に順次削除予定 ──

  // @deprecated → t('landing:brand.taglinePart1')
  taglinePart1: 'フローを描く。',
  // @deprecated → t('landing:brand.taglinePart2')
  taglinePart2: 'チームが動く。',
  // @deprecated → t('landing:brand.heroBadge')
  heroBadge: '無料で使える業務フローエディタ',
  // @deprecated → t('landing:brand.heroSubtext')
  heroSubtext: '業務フローの設計・可視化・共有をひとつのツールで。',
  // @deprecated → t('landing:brand.heroSubtext2')
  heroSubtext2: '直感的なエディタで、誰でもすぐに始められます。',
  // @deprecated → t('landing:brand.featuresTitle')
  featuresTitle: 'すべての機能を、ひとつに',
  // @deprecated → t('landing:brand.featuresSubtitle')
  featuresSubtitle: '業務フロー設計に必要な機能をすべて備えています',
  // @deprecated → t('landing:brand.ctaHeading')
  ctaHeading: '業務フローの可視化を、今日から。',
  // @deprecated → t('landing:brand.ctaSubtext')
  ctaSubtext: 'アカウント登録で無料で始められます',
  // @deprecated → t('landing:brand.ctaButtonPrimary')
  ctaButtonPrimary: '無料で始める →',
  // @deprecated → t('landing:brand.ctaButtonNav')
  ctaButtonNav: '無料で始める',
  // @deprecated → t('landing:brand.ctaButtonShared')
  ctaButtonShared: '無料で試す →',
  // @deprecated → t('shared:footer')
  sharedFooter: 'Flowlineで作成',
  // @deprecated → t('shared:createdBy')
  sharedCreatedBy: 'Flowline で作成されたフロー',
  // @deprecated → t('shared:createCta')
  sharedCreateCta: 'Flowline でフロー図を作成',
  // @deprecated → t('shared:ctaFeatures')
  sharedCtaFeatures: '無料で始める · チームで共有 · Mermaid対応',
  // @deprecated → t('shared:topLink')
  sharedTopLink: 'Flowline トップへ',
  // @deprecated → t('shared:viewButton')
  sharedViewButton: 'フロー図を表示する',
  // @deprecated → t('shared:viewBadge')
  sharedViewBadge: '閲覧モード',
  // @deprecated → t('shared:freeText')
  sharedFreeText: '閲覧は無料 · ログイン不要',
  // @deprecated → t('shared:demoTryLink')
  demoTryLink: '今すぐ試す（ログイン不要）→',
  // @deprecated → t('shared:demoSaveCta')
  demoSaveCta: 'ログインして保存',
} as const

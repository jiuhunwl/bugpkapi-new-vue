/**
 * 支付（赞助）协议正文。
 *
 * 为什么正文不放进 i18n json：
 * 1. 条款段落是法律文本，条目数多、改动频繁，放 i18n 会产生上百个扁平 key，
 *    中英任一侧漏写都不会被 check-locales 的「静态 key 存在性」检查发现；
 * 2. 这里用结构化的 Section[] 表达，渲染层只负责排版，条款增删改都是同文件内的原子改动；
 * 3. 弹窗与（可选的）独立页面共用同一份数据源，避免两处文案漂移。
 *
 * 免责与费用条款中的比例、时限、上限均为对外承诺的硬数字，修改前需同步运营口径。
 */

export interface AgreementSection {
  /** 锚点 id，同时用于弹窗内目录跳转 */
  id: string;
  title: string;
  intro?: string;
  items: string[];
  /** 需要视觉强化的条款（赞助性质、退款费用、免责） */
  highlight?: boolean;
  /** 条款尾注 */
  outro?: string;
}

export interface PaymentAgreementDoc {
  ack: string;
  effectiveDate: string;
  eyebrow: string;
  notice: string;
  sections: AgreementSection[];
  summary: string;
  title: string;
  version: string;
}

const zhCN: PaymentAgreementDoc = {
  eyebrow: '支付前必读',
  title: '支付与赞助服务协议',
  version: 'v1.0',
  effectiveDate: '2026-11-04',
  summary:
    '本协议约定你向本站提供赞助支持的自愿性质、对应服务额度的使用规则、退款与费用扣除方式，以及双方的责任边界。提交赞助前请完整阅读全部条款。',
  notice:
    '当你在支付页面勾选本协议并完成支付，即表示你已完整阅读、理解并不可撤销地同意本协议全部内容。若你不同意其中任何一条，请停止支付。',
  ack:
    '勾选即表示：我已完整阅读并理解上述全部条款，特别是第三条（赞助性质）、第八条（退款与费用扣除）、第九条（不予退款情形）、第十三条（免责声明）；我自愿提供赞助，不要求等价交换，不主张投资回报。',
  sections: [
    {
      id: 'parties',
      title: '一、协议主体与适用范围',
      items: [
        '本协议由你（以下称“赞助人”）与本站运营方（以下称“本站”）就赞助支持事宜订立，适用于本站全部充值、套餐购买、点数购买、额度追加等付费入口。',
        '本协议与《用户服务协议》《隐私政策》共同构成完整约定；三者就赞助与付费事项表述不一致时，以本协议为准。',
        '你使用本站服务即受本协议约束；若你代表组织或团队提供赞助，应确保已获得该组织或团队的有效授权，并由你承担相应责任。',
      ],
    },
    {
      id: 'definitions',
      title: '二、定义',
      items: [
        '“赞助支持”：你基于对本站服务持续运营的认可，自愿、无偿、单方面向本站提供的资金支持，不构成买卖、租赁、借贷、投资、入股、预付卡发行或任何形式的对价交换。',
        '“回馈额度”：本站为感谢赞助支持，向你的账号授予的接口调用次数、点数、套餐有效期等虚拟使用权益，属于本站可自主确定的单方回馈，不具有财产属性，不可转让、不可兑现、不可继承、不可分割。',
        '“赞助档位”：支付页面展示的赞助金额、时长与便利内容，仅用于区分并发保障、工单支持等非解析能力的差异，不构成商品标价、服务报价或要约。',
        '“第三方支付渠道”：微信支付、支付宝及其聚合服务商等具备合法资质的支付机构。',
      ],
    },
    {
      id: 'nature',
      highlight: true,
      title: '三、赞助性质声明（核心条款）',
      intro:
        '本条是理解本协议的基础。请确认你在完全理解下列内容后再作出赞助决定。',
      items: [
        '你在本站支付页面完成的一切支付行为，性质均为对本站的自愿赞助支持，不属于交易，不构成你与本站之间的买卖、服务采购、消费合同或任何等价交换关系。',
        '本站不以任何形式承诺赞助必然获得等值或超额回报。回馈额度是感谢性质的回馈，不是商品；其数量、范围、有效期由本站根据运营情况自主确定并可调整。',
        '本站不发行预付卡、储值卡、代币、积分理财或任何具有货币属性的凭证。账户余额仅用于抵扣本站服务额度，不计息、不可提现、不可转让、不可用于任何支付结算场景。',
        '赞助不构成投资。本站不承诺任何收益、分红、返利、增值或本金返还；你不得以投资、理财、入股、借款、预付款等名义向本站主张任何权利。',
        '你确认已充分理解上述性质，赞助完全出于自愿，不存在被欺诈、胁迫、误导或重大误解的情形。',
      ],
      outro:
        '如你不认同“支付属于赞助、不属于交易”这一性质，请勿进行支付。',
    },
    {
      id: 'tiers',
      title: '四、赞助档位与回馈额度',
      items: [
        '支付页面所列充值金额、套餐名称、点数数量、有效期，为当前时点的回馈方案。本站可随时新增、调整或下架方案，不影响已生效部分的存续。',
        '会员套餐按自然时间计期，到期未续订则相应权益自动失效。套餐升级、降级、变更的折算规则以页面说明与系统实时配置为准。',
        '点数、调用额度按实际使用扣减，扣减顺序、并发限制、速率限制（每分钟、每小时、每日、每月配额及 QPS）以系统实时配置为准。',
        '因你所在用户组的配额被调整而导致可用额度变化的，属于本站运营策略调整，不构成违约，不触发退款或补偿。',
      ],
    },
    {
      id: 'voluntary',
      title: '五、自愿原则与知情确认',
      items: [
        '你在完全知情、自愿的前提下作出赞助决定。本站已就赞助性质、回馈内容、退款限制、费用扣除向你作出充分提示。',
        '本站已在支付页面显著位置展示本协议入口，且未勾选同意即无法获取支付二维码，视为本站已履行提示与说明义务。',
        '你确认具备完全民事行为能力。若你不具备，应由你的监护人代为决定并承担相应责任；监护人代为你作出赞助决定的，视为你已知情同意。',
      ],
    },
    {
      id: 'channels',
      title: '六、支付渠道与第三方服务',
      items: [
        '支付由具备合法资质的第三方支付机构处理。本站不接触、不存储你的银行卡号、支付密码、短信验证码等敏感支付信息。',
        '支付过程中产生的通道服务费、结算费由第三方机构按其公示费率收取，费率变动以第三方公示为准。',
        '因第三方支付渠道故障、限额、风控拦截、清算延迟导致的支付失败或到账延迟，本站不承担违约责任，但应协助你排查并推进处理。',
        '你应使用本人合法持有的支付账户完成支付。因使用他人账户、非本人授权账户、盗用账户产生的纠纷与损失，由你自行承担。',
      ],
    },
    {
      id: 'effect',
      title: '七、赞助生效与额度到账',
      items: [
        '支付成功后，回馈额度通常在数分钟内自动到账。遇第三方通道回调延迟，本站将在核实后补入。',
        '你应在支付后 24 小时内核对到账情况。逾期未通过工单提出异议的，视为你认可到账结果。',
        '订单超时未支付将自动关闭，已关闭订单不可继续支付，需重新发起。因订单关闭导致的档位价格变动，以新订单页面为准。',
      ],
    },
    {
      id: 'refund',
      highlight: true,
      title: '八、退款与费用扣除',
      intro:
        '赞助原则上不予退还。本条列明可受理的情形、申请时限与费用扣除标准，请在支付前确认已理解。',
      items: [
        '可受理退款的有限情形：① 支付成功但因本站系统原因未到账且无法补入；② 重复支付、误支付且对应回馈额度完全未使用；③ 法律法规明确规定应当退还的其他情形。',
        '退款申请应在支付之日起 7 个自然日内通过站内工单提交，并提供订单号、支付凭证与退款原因。超过该期限的申请，本站不再受理。',
        '微信支付通道服务费：按实际支付金额的 0.6% 扣除（以微信支付当期公示费率为准；如官方费率上调，按上调后的标准扣除）。',
        '第三方商家服务费：按实际支付金额的 2% 扣除。该费用由第三方支付服务商就订单处理、对账、清算环节收取。',
        '提现与结算手续费：按结算渠道实际收取标准扣除，通常为退款金额的 0.1%，单笔最低 1 元；跨境或特殊渠道按其实际费率扣除。',
        '已消耗额度折价：已使用的调用次数、点数，以及套餐已生效天数，按对应赞助档位的折算单价扣除；折算单价以订单页面单价为准。',
        '赠送部分全额收回：赠送金额、赠送点数、活动加赠额度、优惠券抵扣部分不予折现，退款时一并收回。',
        '退款金额计算方式：退款金额 = 实际支付金额 − 通道服务费 − 商家服务费 − 提现结算手续费 − 已消耗额度折价 − 赠送部分。计算结果小于或等于 0 时，不予退款。',
        '退款按原路退回至原支付账户，到账时间以第三方渠道为准（通常 1 至 15 个工作日）。跨境、跨行或特殊渠道可能更长，本站无法干预第三方处理时效。',
        '退款完成后，对应回馈额度立即冻结并清零。因额度清零导致的接口中断、数据不可用、业务损失，本站不承担赔偿责任。',
        '你理解并同意：上述费用为第三方渠道及结算环节已实际发生的成本，不属于本站收取的违约金、服务报酬或惩罚性收费。',
      ],
      outro:
        '如你无法接受上述费用扣除方式，请勿提供赞助。赞助完成后提出退款，即视为你同意按本条标准扣除费用后退还余额。',
    },
    {
      id: 'non-refund',
      highlight: true,
      title: '九、不予退款的情形',
      items: [
        '回馈额度已全部或部分使用，且已使用部分无法原状返还的。',
        '账号因违反《用户服务协议》或本协议，被限制功能、暂停、封禁、注销的。',
        '以套现、洗钱、信用卡套现、虚假赞助、对刷、批量注册、代付代充等目的发起支付的。',
        '赞助已超过 7 个自然日，或无法提供有效订单号、支付凭证的。',
        '通过非本站官方渠道获得的额度，包括第三方代充、账号共享、私下转让、非法渠道购买。',
        '因你自身设备、网络环境、操作失误导致的重复支付，且对应额度已使用的。',
        '你已明确知晓服务存在缺陷、限制或即将下线，仍自愿提供赞助的。',
        '法律法规、监管要求或司法机关明确不予退还的其他情形。',
      ],
    },
    {
      id: 'changes',
      title: '十、服务变更、中止与终止',
      items: [
        '本站可基于运营、合规、成本、上游接口可用性等原因，调整、中止或终止部分服务功能，调整前将以公告或站内提示的方式告知。',
        '本站决定终止全部服务时，将提前不少于 30 日公告。对未消耗的回馈额度，按第八条扣除费用后退还，或提供等值替代方案供你选择。',
        '因不可抗力、政策监管、上游供应商终止合作导致服务中断或终止的，本站不承担违约责任，但应及时告知并尽合理努力减少影响。',
      ],
    },
    {
      id: 'prohibited',
      title: '十一、禁止行为',
      items: [
        '不得将回馈额度、账号、接口凭证用于转售、出租、出借、代充、分成、返利等经营性用途。',
        '不得通过技术手段绕过配额、限速、鉴权、风控，或进行批量注册、撞库、爬取、自动化滥用。',
        '不得利用本站服务从事任何违反法律法规、侵犯他人合法权益、危害网络安全的活动。',
        '不得以赞助为名进行洗钱、套现、资金归集、虚构交易或规避外汇、税务监管。',
        '违反上述任一条款，本站有权立即限制或终止服务、清零全部额度，且不予退款；造成本站或第三方损失的，你应予以全额赔偿。',
      ],
    },
    {
      id: 'tax',
      title: '十二、税务与票据',
      items: [
        '赞助款项性质为无偿资助，本站就赞助款项出具的凭证为“赞助接收证明”，不属于销售发票，不代表任何商品或服务的对价。',
        '如你依据当地税法需要取得票据，可通过工单提交用途说明与主体信息，本站将在合法合规范围内协助处理。',
        '你应自行承担因赞助行为产生的税务义务；本站不承担你方的任何税务责任。',
      ],
    },
    {
      id: 'disclaimer',
      highlight: true,
      title: '十三、免责声明',
      items: [
        '本站按“现状”和“现有可用”提供技术服务，不对服务的及时性、安全性、准确性、完整性、不中断、无错误作出任何明示或默示担保。',
        '本站不保证上游接口、第三方支付、云服务、网络线路的持续可用。因上述环节异常导致的服务中断、数据延迟、额度未及时到账，本站不承担赔偿责任。',
        '因不可抗力（自然灾害、疫情、战争、罢工、电力中断、电信故障）、政府行为、法律法规与监管政策变化、黑客攻击、大规模网络故障导致的服务受阻、数据丢失或额度异常，本站不承担责任。',
        '本站不对你使用服务所获得的任何结果、数据、商业收益、决策结论作出保证。你应自行评估使用风险并独立承担由此产生的后果。',
        '本站不对间接损失、可得利益损失、商誉损失、数据损失、第三方索赔承担责任，无论本站是否已被告知该等损失发生的可能性。',
        '在法律允许的最大范围内，本条不排除或限制依法不能排除或限制的责任；就依法应承担责任的部分，本站的赔偿责任以你实际支付且未获回馈的赞助金额为上限。',
        '你理解并同意：赞助是自愿行为，本站无义务因服务体验不佳、功能变更、策略调整、个人偏好变化、外部评价等原因退款或补偿。',
        '本站已就服务能力、接口稳定性、配额限制作出充分说明。你未阅读公告、文档或本协议而产生的误解，不构成本站的责任。',
      ],
    },
    {
      id: 'liability',
      title: '十四、责任限制',
      items: [
        '在法律允许的最大范围内，本站就本协议及赞助事项对你承担的全部责任累计，不超过你近 12 个月内实际支付且未获回馈的赞助金额。',
        '你因违反本协议或法律法规，导致本站被索赔、被处罚、被起诉或遭受其他损失的，应赔偿本站全部损失，包括合理的律师费、公证费、差旅费、诉讼费。',
        '本条责任限制不适用于本站故意或重大过失造成的人身损害。',
      ],
    },
    {
      id: 'dispute',
      title: '十五、争议解决与适用法律',
      items: [
        '本协议的订立、效力、解释、履行与争议解决，均适用中华人民共和国法律（为本协议之目的，不含香港特别行政区、澳门特别行政区及台湾地区法律）。',
        '因本协议产生的争议，双方应先行友好协商；协商不成的，任一方可向本站运营方所在地有管辖权的人民法院提起诉讼。',
        '争议解决期间，本协议其他条款继续有效，双方应继续履行不受争议影响的义务。',
      ],
    },
    {
      id: 'amendment',
      title: '十六、协议变更与通知',
      items: [
        '本站可根据法律法规、监管要求、运营需要修订本协议，修订后的版本将在站内公告或支付页面提示，并更新版本号与生效日期。',
        '修订生效后你继续提供赞助的，视为你已接受修订内容；不接受修订内容的，应停止赞助。',
        '本站的通知方式包括站内公告、支付页面弹窗、站内信、工单回复。通知自发出之日起视为送达。',
      ],
    },
    {
      id: 'misc',
      title: '十七、其他约定',
      items: [
        '本协议部分条款被认定无效或不可执行的，不影响其他条款的效力，其余条款继续有效。',
        '本站未行使或延迟行使本协议项下的任何权利，不构成对该权利的放弃。',
        '本协议标题仅为阅读方便而设，不影响条款的解释。',
        '本协议以简体中文版本为准；其他语言译本仅供参考，如与中文版本存在歧义，以中文版本为准。',
      ],
    },
    {
      id: 'contact',
      title: '十八、联系方式',
      items: [
        '赞助、退款、票据相关事宜，请通过站内工单提交，并附订单号与支付凭证，我们将在 3 个工作日内回复。',
        '涉及违法违规内容、侵权投诉、司法调证的事项，请通过工单“举报投诉”分类提交，本站将依法配合处理。',
      ],
    },
  ],
};

const enUS: PaymentAgreementDoc = {
  eyebrow: 'Read before paying',
  title: 'Payment and Sponsorship Service Agreement',
  version: 'v1.0',
  effectiveDate: '2026-11-04',
  summary:
    'This Agreement sets out the voluntary nature of your sponsorship support, the rules for using the corresponding service credits, how refunds and fee deductions work, and the limits of liability for both parties. Please read all clauses in full before sponsoring.',
  notice:
    'By ticking this Agreement on the payment page and completing payment, you confirm that you have read, understood and irrevocably accepted all of its terms. If you disagree with any clause, please stop and do not pay.',
  ack:
    'By ticking the box you confirm: I have read and understood all of the above, in particular Clause 3 (Nature of Sponsorship), Clause 8 (Refunds and Fee Deductions), Clause 9 (Non-refundable Cases) and Clause 13 (Disclaimer); I provide this sponsorship voluntarily, I do not require equivalent exchange, and I do not claim any investment return.',
  sections: [
    {
      id: 'parties',
      title: '1. Parties and Scope',
      items: [
        'This Agreement is entered into between you (the "Sponsor") and the operator of this site (the "Site") in respect of sponsorship support, and applies to every paid entry point on the Site, including top-ups, package purchases, point purchases and credit top-ups.',
        'This Agreement, together with the User Service Agreement and the Privacy Policy, forms the complete agreement between the parties. Where they differ on sponsorship and payment matters, this Agreement prevails.',
        'By using the Site you accept this Agreement. If you sponsor on behalf of an organisation or team, you must hold valid authority from that organisation and you bear the corresponding responsibility.',
      ],
    },
    {
      id: 'definitions',
      title: '2. Definitions',
      items: [
        '"Sponsorship support" means the voluntary, unpaid, unilateral financial support you provide to the Site out of recognition for its continued operation. It does not constitute a sale, lease, loan, investment, equity participation, prepaid card issuance or any form of exchange for consideration.',
        '"Service credits" means the virtual usage benefits granted to your account in appreciation of sponsorship, such as API call counts, points and package validity periods. They are a unilateral courtesy determined by the Site, carry no property value, and may not be transferred, cashed out, inherited or divided.',
        '"Sponsorship tier" means the sponsorship amount, duration and convenience content displayed on the payment page. They only distinguish non-capability benefits such as concurrency guarantees and support response times, and do not constitute a product price, service quotation or offer.',
        '"Third-party payment channel" means WeChat Pay, Alipay and their aggregators, and other duly licensed payment institutions.',
      ],
    },
    {
      id: 'nature',
      highlight: true,
      title: '3. Nature of Sponsorship (Core Clause)',
      intro:
        'This clause is the basis for understanding the Agreement. Please confirm you fully understand it before deciding to sponsor.',
      items: [
        'Every payment you make on the Site payment page is a voluntary sponsorship of the Site. It is not a transaction and does not create a sale, service procurement, consumer contract or any exchange for consideration between you and the Site.',
        'The Site does not promise, in any form, that sponsorship will yield equivalent or greater returns. Service credits are a courtesy, not goods; their quantity, scope and validity are determined solely by the Site and may be adjusted according to operating conditions.',
        'The Site does not issue prepaid cards, stored-value cards, tokens, points-based financial products or any instrument with monetary attributes. Account balance may only offset Site service credits; it bears no interest, cannot be withdrawn or transferred, and cannot be used in any payment or settlement scenario.',
        'Sponsorship is not an investment. The Site promises no yield, dividend, rebate, appreciation or return of principal, and you may not assert any claim against the Site on the basis of investment, wealth management, equity, lending or prepayment.',
        'You confirm that you fully understand the above nature, that your sponsorship is entirely voluntary, and that there has been no fraud, coercion, misleading or material misunderstanding.',
      ],
      outro:
        'If you do not accept that "payment is sponsorship, not a transaction", please do not pay.',
    },
    {
      id: 'tiers',
      title: '4. Sponsorship Tiers and Courtesy Credits',
      items: [
        'The top-up amounts, package names, point quantities and validity periods shown on the payment page reflect the courtesy scheme at that moment. The Site may add, adjust or withdraw schemes at any time without affecting already effective entitlements.',
        'Membership packages are counted by calendar time. If not renewed, the corresponding entitlements expire automatically. Conversion rules for upgrades, downgrades and changes are governed by the page description and the live system configuration.',
        'Points and call credits are deducted according to actual usage. Deduction order, concurrency limits and rate limits (per minute, per hour, per day, per month and QPS) are governed by the live system configuration.',
        'Where changes to the quota of your user group alter your available credits, this is an adjustment of the Site operating policy; it does not constitute a breach and does not trigger a refund or compensation.',
      ],
    },
    {
      id: 'voluntary',
      title: '5. Voluntary Principle and Informed Confirmation',
      items: [
        'You make your sponsorship decision with full knowledge and of your own free will. The Site has fully disclosed the nature of sponsorship, the courtesy content, refund restrictions and fee deductions.',
        'The Site displays the entry to this Agreement prominently on the payment page, and the payment QR code cannot be obtained unless you tick your consent. This constitutes performance of the Site\'s duty to inform and explain.',
        'You confirm that you have full civil capacity. If you do not, your guardian must decide on your behalf and bear the corresponding responsibility; a guardian\'s decision on your behalf is deemed to be your informed consent.',
      ],
    },
    {
      id: 'channels',
      title: '6. Payment Channels and Third-Party Services',
      items: [
        'Payments are processed by duly licensed third-party payment institutions. The Site does not access or store your bank card number, payment password, SMS verification code or other sensitive payment information.',
        'Channel service fees and settlement fees incurred during payment are charged by the third party at its published rates; changes to those rates are governed by the third party\'s publication.',
        'The Site is not liable for breach where payment fails or is delayed due to third-party channel outage, limits, risk-control interception or clearing delay, but will assist you in troubleshooting and progressing the matter.',
        'You must pay using a payment account lawfully held by you. Any dispute or loss arising from the use of another person\'s account, an unauthorised account or a stolen account is borne by you.',
      ],
    },
    {
      id: 'effect',
      title: '7. Effectiveness and Credit Delivery',
      items: [
        'After successful payment, courtesy credits are normally delivered automatically within a few minutes. Where the third-party callback is delayed, the Site will credit them after verification.',
        'You should verify delivery within 24 hours of payment. If you raise no objection through a ticket within that period, you are deemed to accept the delivery result.',
        'Unpaid orders close automatically on timeout. Closed orders cannot be paid again and must be re-created. Any price change caused by order closure is governed by the new order page.',
      ],
    },
    {
      id: 'refund',
      highlight: true,
      title: '8. Refunds and Fee Deductions',
      intro:
        'Sponsorship is in principle non-refundable. This clause sets out the limited cases that may be accepted, the application deadline and the fee deduction standards. Please confirm you understand them before paying.',
      items: [
        'Limited refundable cases: (a) payment succeeded but credits were not delivered due to a Site system fault and cannot be credited; (b) duplicate or mistaken payment where the corresponding courtesy credits are entirely unused; (c) other cases where laws or regulations expressly require a refund.',
        'Refund applications must be submitted through an on-site ticket within 7 calendar days of the payment date, together with the order number, payment receipt and reason. Applications beyond that period will not be accepted.',
        'WeChat Pay channel service fee: 0.6% of the actual amount paid (based on WeChat Pay\'s currently published rate; if the official rate increases, the increased rate applies).',
        'Third-party merchant service fee: 2% of the actual amount paid. This fee is charged by the third-party payment provider for order processing, reconciliation and clearing.',
        'Withdrawal and settlement fee: charged at the actual rate of the settlement channel, usually 0.1% of the refund amount with a minimum of CNY 1 per transaction; cross-border or special channels are charged at their actual rates.',
        'Deduction for consumed credits: used call counts, points and elapsed package days are deducted at the unit price derived from the corresponding sponsorship tier, based on the unit price shown on the order page.',
        'Bonus amounts are fully recovered: gifted amounts, bonus points, promotional top-ups and coupon offsets are not converted into cash and are recovered in full upon refund.',
        'Refund calculation: refund amount = actual amount paid − channel service fee − merchant service fee − withdrawal and settlement fee − deduction for consumed credits − bonus amounts. If the result is zero or negative, no refund is payable.',
        'Refunds are returned to the original payment account. Arrival time is determined by the third-party channel (usually 1 to 15 business days); cross-border, interbank or special channels may take longer, and the Site cannot influence third-party processing times.',
        'Upon completion of the refund, the corresponding courtesy credits are immediately frozen and zeroed. The Site is not liable for API interruptions, unavailability of data or business losses caused by such zeroing.',
        'You understand and agree that the fees above are costs actually incurred by third-party channels and settlement processes. They are not liquidated damages, service remuneration or punitive charges levied by the Site.',
      ],
      outro:
        'If you cannot accept these fee deductions, please do not sponsor. Submitting a refund request after sponsoring constitutes your agreement to a refund of the balance after the deductions set out in this clause.',
    },
    {
      id: 'non-refund',
      highlight: true,
      title: '9. Non-refundable Cases',
      items: [
        'Courtesy credits have been fully or partly used and the used portion cannot be restored.',
        'The account has been restricted, suspended, banned or closed for violating the User Service Agreement or this Agreement.',
        'The payment was made for cash-out, money laundering, credit card cash-out, fictitious sponsorship, wash trading, bulk registration, or third-party payment on behalf of others.',
        'More than 7 calendar days have passed since the sponsorship, or no valid order number or payment receipt can be provided.',
        'Credits were obtained through non-official channels, including third-party top-up agents, account sharing, private transfer or purchase through illicit channels.',
        'Duplicate payment was caused by your own device, network environment or operating error and the corresponding credits have been used.',
        'You sponsored with clear knowledge that the service had defects, limitations or was about to be discontinued.',
        'Other cases where laws, regulations, regulatory requirements or judicial authorities expressly refuse a refund.',
      ],
    },
    {
      id: 'changes',
      title: '10. Service Changes, Suspension and Termination',
      items: [
        'The Site may adjust, suspend or terminate part of its service functions for operational, compliance, cost or upstream availability reasons, and will give notice through announcements or on-site prompts before doing so.',
        'If the Site decides to terminate all services, it will announce this at least 30 days in advance. For unconsumed courtesy credits, it will refund after the deductions in Clause 8, or offer an equivalent alternative for you to choose.',
        'The Site is not liable for breach where services are interrupted or terminated due to force majeure, regulatory policy or termination of cooperation by an upstream provider, but will inform you promptly and make reasonable efforts to mitigate the impact.',
      ],
    },
    {
      id: 'prohibited',
      title: '11. Prohibited Conduct',
      items: [
        'You may not use courtesy credits, accounts or API credentials for resale, rental, lending, top-up agency, revenue sharing, rebates or other commercial purposes.',
        'You may not use technical means to bypass quotas, rate limits, authentication or risk controls, or engage in bulk registration, credential stuffing, scraping or automated abuse.',
        'You may not use the Site\'s services for any activity that violates laws or regulations, infringes the lawful rights of others, or endangers cybersecurity.',
        'You may not use sponsorship as a pretext for money laundering, cash-out, fund pooling, fictitious transactions or circumvention of foreign exchange or tax supervision.',
        'If you breach any of the above, the Site may immediately restrict or terminate services and zero all credits without refund; you must fully compensate the Site or any third party for resulting losses.',
      ],
    },
    {
      id: 'tax',
      title: '12. Tax and Receipts',
      items: [
        'Sponsorship funds are gratuitous support in nature. The document issued by the Site for sponsorship funds is a "Sponsorship Receipt Certificate"; it is not a sales invoice and does not represent consideration for any goods or services.',
        'If you need a document under your local tax law, you may submit a ticket stating the purpose and entity details; the Site will assist within the bounds of law and compliance.',
        'You bear your own tax obligations arising from sponsorship; the Site bears no tax liability on your behalf.',
      ],
    },
    {
      id: 'disclaimer',
      highlight: true,
      title: '13. Disclaimer',
      items: [
        'The Site provides technical services on an "as is" and "as available" basis and makes no express or implied warranty as to timeliness, security, accuracy, completeness, uninterrupted operation or freedom from errors.',
        'The Site does not guarantee the continuous availability of upstream APIs, third-party payments, cloud services or network lines. It is not liable for service interruptions, data delays or late credit delivery caused by anomalies in those links.',
        'The Site bears no responsibility for service blockage, data loss or credit anomalies caused by force majeure (natural disasters, epidemics, war, strikes, power outages, telecom failures), government acts, changes in laws, regulations or regulatory policy, hacker attacks or large-scale network failures.',
        'The Site makes no guarantee regarding any results, data, business revenue or decisions you obtain from using the service. You must assess the risks of use yourself and independently bear the consequences.',
        'The Site is not liable for indirect losses, loss of expected profits, loss of goodwill, loss of data or third-party claims, whether or not the Site was advised of the possibility of such losses.',
        'To the maximum extent permitted by law, this clause does not exclude or limit liability that cannot lawfully be excluded or limited; for liability that must be borne by law, the Site\'s liability is capped at the sponsorship amount you actually paid and for which no credits were received.',
        'You understand and agree that sponsorship is voluntary and that the Site has no obligation to refund or compensate due to poor service experience, feature changes, policy adjustments, changes in personal preference or external reviews.',
        'The Site has fully described its service capabilities, API stability and quota limits. Any misunderstanding on your part arising from failing to read announcements, documentation or this Agreement does not create liability for the Site.',
      ],
    },
    {
      id: 'liability',
      title: '14. Limitation of Liability',
      items: [
        'To the maximum extent permitted by law, the Site\'s aggregate liability to you under this Agreement and in respect of sponsorship shall not exceed the sponsorship amount you actually paid and for which no credits were received in the preceding 12 months.',
        'If your breach of this Agreement or of any law causes the Site to be claimed against, penalised, sued or otherwise harmed, you must compensate the Site for all losses, including reasonable legal fees, notarisation fees, travel expenses and litigation costs.',
        'This limitation does not apply to personal injury caused by the Site\'s intentional act or gross negligence.',
      ],
    },
    {
      id: 'dispute',
      title: '15. Governing Law and Dispute Resolution',
      items: [
        'The formation, validity, interpretation, performance and dispute resolution of this Agreement are governed by the laws of the People\'s Republic of China (for the purposes of this Agreement, excluding the laws of the Hong Kong SAR, the Macao SAR and the Taiwan region).',
        'Disputes arising from this Agreement shall first be resolved through friendly negotiation. Failing that, either party may bring a lawsuit before the competent people\'s court at the place where the Site operator is domiciled.',
        'During dispute resolution, the remaining clauses of this Agreement remain in effect and both parties shall continue to perform obligations unaffected by the dispute.',
      ],
    },
    {
      id: 'amendment',
      title: '16. Amendments and Notices',
      items: [
        'The Site may revise this Agreement in response to laws, regulations, regulatory requirements or operational needs. Revised versions will be announced on-site or indicated on the payment page, with an updated version number and effective date.',
        'If you continue to sponsor after a revision takes effect, you are deemed to have accepted it; if you do not accept it, you must stop sponsoring.',
        'Notices may be given by on-site announcement, payment page pop-up, on-site message or ticket reply, and are deemed delivered on the date of dispatch.',
      ],
    },
    {
      id: 'misc',
      title: '17. Miscellaneous',
      items: [
        'If any clause of this Agreement is held invalid or unenforceable, the validity of the remaining clauses is unaffected.',
        'The Site\'s failure or delay in exercising any right under this Agreement does not constitute a waiver of that right.',
        'Headings are for convenience of reading only and do not affect the interpretation of the clauses.',
        'The Simplified Chinese version of this Agreement prevails. Translations into other languages are for reference only; in case of ambiguity, the Chinese version governs.',
      ],
    },
    {
      id: 'contact',
      title: '18. Contact',
      items: [
        'For sponsorship, refund and receipt matters, please submit an on-site ticket with the order number and payment receipt. We will respond within 3 business days.',
        'For illegal content, infringement complaints or judicial requests, please submit a ticket under "Report / Complaint"; the Site will cooperate as required by law.',
      ],
    },
  ],
};

export const PAYMENT_AGREEMENT_DOCS: Record<string, PaymentAgreementDoc> = {
  'en-US': enUS,
  'zh-CN': zhCN,
};

/**
 * 未同意协议时喂给 QRCode 的占位内容。
 *
 * 只靠 CSS blur 拦不住人：开发者工具里删掉 filter 就能看到真码。
 * 所以在未勾选阶段根本不把支付链接交给渲染层——即使有人去掉模糊滤镜，
 * 扫出来的也只是这段文本。勾选后才把真实 order.qrCode 换进去。
 */
export const QR_LOCKED_PLACEHOLDER = 'SPONSORSHIP-AGREEMENT-REQUIRED';

export const DEFAULT_PAYMENT_AGREEMENT = zhCN;

export function resolvePaymentAgreementDoc(
  locale?: string,
): PaymentAgreementDoc {
  if (!locale) {
    return DEFAULT_PAYMENT_AGREEMENT;
  }
  // 允许 en / en-US 这类带地区后缀的写法命中同一份英文正文
  if (locale.toLowerCase().startsWith('en')) {
    return PAYMENT_AGREEMENT_DOCS['en-US'] ?? DEFAULT_PAYMENT_AGREEMENT;
  }
  return (
    PAYMENT_AGREEMENT_DOCS[locale] ??
    PAYMENT_AGREEMENT_DOCS['zh-CN'] ??
    DEFAULT_PAYMENT_AGREEMENT
  );
}

/**
 * S8B-04 (CP1, contract v1.2 §6.8 PA-4) — the Product Owner's L-0 listening (2026-11-01) as a permanent, free regression
 * fixture: for each case the exact text each existing S8B-01 sample spoke, the sample id and sha256, and the verdict. A
 * renderer output byte-identical to a rated text inherits that rating without generating audio. No audio, no notes.
 *
 * Sources (read-only): L-0_samples-manifest.json sha256 9718eed08f1ab191a28cdd059a0413c4e9da250b7b654b556fecd7646bad612e;
 * L-0_ratings_2026-11-01T10-37-29.json sha256 a24a8905badf573d33436ec1e46802009061880c9cda1e3b617e40f9b945f51e.
 * H26: the earlier export's note on arm (b) is unconfirmed by the Product Owner and is NOT encoded here (§6.2a).
 */
export interface L0Arm { readonly sample: string; readonly sha256: string; readonly text: string; readonly verdict: string | null; readonly lessNatural?: string | null }
export interface L0Case { readonly caseId: string; readonly kind: 'PAIR' | 'SINGLE'; readonly group: string; readonly dialect: string; readonly target: string | null; readonly baseline: L0Arm; readonly rendered: L0Arm | null }

export const L0_CASES: readonly L0Case[] = [
  {
    caseId: 'H01',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'العلم',
    baseline: {
      sample: 'C0001',
      sha256: '59ab752eb9737b500637a355d95bb54f3596e546d5f55980d79351d35ec31109',
      text: 'رفعوا العلم فوق المدرسة صباح اليوم.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0031',
      sha256: '687a1fe8f0556b9ed3215ae0fea25de3aa7c7d4e48d513bab0f398f3ff4eee6a',
      text: 'رفعوا العَلَم فوق المدرسة صباح اليوم.',
      verdict: 'CORRECT',
      lessNatural: 'YES'
    }
  },
  {
    caseId: 'H02',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'العلم',
    baseline: {
      sample: 'C0057',
      sha256: '3abea47f6a07b131bbc580e545bfb958f4caf2de76fcf0f4f6431721981767ba',
      text: 'طلب العلم طريق طويل يحتاج إلى صبر.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0087',
      sha256: '04a410b1e499b141abcea825ffee6c84e992da6a162d571cec2253f050541620',
      text: 'طلب العِلْم طريق طويل يحتاج إلى صبر.',
      verdict: 'CORRECT',
      lessNatural: 'YES'
    }
  },
  {
    caseId: 'H03',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'علم',
    baseline: {
      sample: 'C0113',
      sha256: '457c7c400992160fbeb379aa0ead301e3df5ba246448d46149b2f7bacd041cff',
      text: 'علم الخبر متأخرًا فاتصل بأخيه فورًا.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0137',
      sha256: '4f9cba5674ead8bb43df9ec1c5e3d917dc135119c21401ce996028e40e859c13',
      text: 'عَلِمَ الخبر متأخرًا فاتصل بأخيه فورًا.',
      verdict: 'CORRECT',
      lessNatural: 'YES'
    }
  },
  {
    caseId: 'H04',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'كتب',
    baseline: {
      sample: 'C0161',
      sha256: '334505ac8423c5eba2d3fa2d811327eb7a2a0ac1de43ca4b876a33a0dce59615',
      text: 'اشتريت كتب المدرسة الجديدة أمس.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0185',
      sha256: '6600a5325e05999ceb59de6d4f49cd1e829af0a6df9124a56a80819f402d105a',
      text: 'اشتريت كُتُب المدرسة الجديدة أمس.',
      verdict: 'CORRECT',
      lessNatural: 'YES'
    }
  },
  {
    caseId: 'H05',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'كتب',
    baseline: {
      sample: 'C0209',
      sha256: '1c2ed6cbad5b6bfb893615fb91f0789ebac18701941d0827f48067dc2d51d6ea',
      text: 'كتب رسالة طويلة لأمه قبل السفر.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0233',
      sha256: '57daa55cd384057f4aa48aacbadc98533e2f774dc8a2e3bea6baca3cfe765d9e',
      text: 'كَتَبَ رسالة طويلة لأمه قبل السفر.',
      verdict: 'CORRECT',
      lessNatural: 'YES'
    }
  },
  {
    caseId: 'H06',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'الملك',
    baseline: {
      sample: 'C0257',
      sha256: '4356a9b04541c66d33b8a0e1a1487421b074a1727cdf1a3151a3cb1a75305232',
      text: 'استقبل الملك الوفد في القصر.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0281',
      sha256: '79ea3050a87ba27ab642fac4190311f5e796b73ebae9ffd104b35837fd914e1a',
      text: 'استقبل المَلِك الوفد في القصر.',
      verdict: 'CORRECT',
      lessNatural: 'UNSURE'
    }
  },
  {
    caseId: 'H07',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'ملك',
    baseline: {
      sample: 'C0305',
      sha256: '4dd5398021c5caffd72e630070cbb0a69f36b4ae6d48613487ea0ad1aca1d486',
      text: 'هذا البيت ملك أبي منذ زمن.',
      verdict: 'WRONG'
    },
    rendered: {
      sample: 'C0327',
      sha256: '9bd26757e83a9d0520c5930ae4806a8fcf98673b7c05a2a26525391f296ae7c4',
      text: 'هذا البيت مِلْك أبي منذ زمن.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H08',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'الحب',
    baseline: {
      sample: 'C0337',
      sha256: '6e1ae7f0af0002cd607274b32245daa700755a9a4cbb654e462d6e3c8fed2ad8',
      text: 'الحب لا يشترى بالمال.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0351',
      sha256: 'a483ba5ed59c3ae1737137bac20a2de0c269c0f203539de3c2ce2c48d7bd204b',
      text: 'الحُبّ لا يشترى بالمال.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H09',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'الحب',
    baseline: {
      sample: 'C0361',
      sha256: '1888e99e93635b5796ee243836b582b762d0ac0588580d3eb954d04411026c2b',
      text: 'نثر الفلاح الحب في الأرض.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0369',
      sha256: '3a388eadd47b15876b85f52738976dd23c3056c6efcd0c261f9fc911eef0f859',
      text: 'نثر الفلاح الحَبّ في الأرض.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H10',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'القدر',
    baseline: {
      sample: 'C0377',
      sha256: 'f977d3e16979e93826faec3dd935eafc438587126a115fcad07c4561d10ccc6b',
      text: 'طبخت الأرز في القدر الكبير.',
      verdict: 'WRONG'
    },
    rendered: {
      sample: 'C0385',
      sha256: 'fa235107811c6f4c6750e0f61e920c775556815000fe4fa5fabce4e454da985d',
      text: 'طبخت الأرز في القِدْر الكبير.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H11',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'القدر',
    baseline: {
      sample: 'C0393',
      sha256: '4d7a3890a1e96bc7e3f0133431b142b17b1144c6dabdf1bd05b5d8ab2fb4e344',
      text: 'رضي بما كتبه الله له من القدر.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0401',
      sha256: '1d971da6ffda2052c47280d299bae0eef9142175e7ec9bb8e2a641ffd53aecd1',
      text: 'رضي بما كتبه الله له من القَدَر.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H12',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'العقد',
    baseline: {
      sample: 'C0409',
      sha256: 'bb04c49b14afa2f24697f0cbf54942a6c0d73f21172c7f8eb0725986d3e9072d',
      text: 'وقع العقد مع الشركة صباح الأحد.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0417',
      sha256: '74efaa2ac0f8f1eec847778726f5fa50573f4c2c5b5d89b4ee73ac6838b5950a',
      text: 'وقع العَقْد مع الشركة صباح الأحد.',
      verdict: 'CORRECT',
      lessNatural: 'YES'
    }
  },
  {
    caseId: 'H13',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'العقد',
    baseline: {
      sample: 'C0425',
      sha256: '19897a8d7883e9da0f4b59fd2cb43c9516ee45741d2f0f80db1693628d487634',
      text: 'لبست العقد الذي أهدته لها أمها.',
      verdict: 'WRONG'
    },
    rendered: {
      sample: 'C0433',
      sha256: 'ea19696bbc5bb1aaaee0d039926ce1628728ffa26c58d89f121d7e13e027f58a',
      text: 'لبست العِقْد الذي أهدته لها أمها.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H14',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'شعرها',
    baseline: {
      sample: 'C0441',
      sha256: '146a3d06392a08f301ea523d5e1c6f1951cbcfec5e1115dc0e9f4f7ba864c6b9',
      text: 'شعرها طويل وأسود.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0449',
      sha256: '0231ff2a1e101b6b658205491efeff0f1494cca574de1737e471caff0dfaf577',
      text: 'شَعْرُها طويل وأسود.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H15',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'الشعر',
    baseline: {
      sample: 'C0457',
      sha256: '00bc862b0820066a375c04e82abd4d874bbeb512ec56f39a3c08eced7fcf749f',
      text: 'يحب أن يقرأ الشعر القديم في المساء.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0465',
      sha256: '38736dcde0f45b4d7d43fc2f0c1db162ddb8026f1cf77b178db2bb744d62289d',
      text: 'يحب أن يقرأ الشِّعْر القديم في المساء.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H16',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'شعر',
    baseline: {
      sample: 'C0473',
      sha256: 'fe78c7f7167b2b698697284146f0ad08801ec421cd0d4a3372cf101c0754aa62',
      text: 'شعر بالتعب بعد يوم طويل.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0479',
      sha256: '3b6f08e75cb8f7f0b6645005e58d20a8d1bd3390c0426b39b88b7053347d6581',
      text: 'شَعَرَ بالتعب بعد يوم طويل.',
      verdict: 'CORRECT',
      lessNatural: 'YES'
    }
  },
  {
    caseId: 'H17',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'دين',
    baseline: {
      sample: 'C0481',
      sha256: 'aaa12ba9f15ae30d1164603116486667165cc1661812f25f1197489a1b1db7d7',
      text: 'عليه دين كبير للبنك.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0487',
      sha256: '96b10f35446b439f5ef27422655f6f2a680fd63df7ba2b6775b196d8d9e1d15f',
      text: 'عليه دَيْن كبير للبنك.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H18',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'دين',
    baseline: {
      sample: 'C0489',
      sha256: '78a8bd279e2c5a8a43f2eb2f623cfd13ed3c61c02396e0783c71c8ce80ad450a',
      text: 'يحترم الناس دين جاره ولا يتدخل فيه.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0495',
      sha256: '99e7cd71aa487840191852caf1b7182b18b7dcd03fbdfa4b072f92b6887ef1ff',
      text: 'يحترم الناس دِين جاره ولا يتدخل فيه.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H19',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'البر',
    baseline: {
      sample: 'C0497',
      sha256: 'ff2517fd404b93a59949b5e7989809be98e70fb338d124e0fc7b03a5ff2babab',
      text: 'وصلنا إلى البر بعد رحلة طويلة في البحر.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0503',
      sha256: '3636afecdc1fad37a6f41a069f3b79001d518e28c036fc80611cb323f0631e79',
      text: 'وصلنا إلى البَرّ بعد رحلة طويلة في البحر.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H20',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'بر',
    baseline: {
      sample: 'C0505',
      sha256: '0e0b931788f4219a2de6045b39dd1d3557f2895f580c8a38474625f0995617d4',
      text: 'بر الوالدين من أجمل الأخلاق.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0511',
      sha256: '68a3bb191805108be144aa47f96d85383638f0a318a17acf59e41deb3ad48914',
      text: 'بِرّ الوالدين من أجمل الأخلاق.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H21',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'حمل',
    baseline: {
      sample: 'C0513',
      sha256: '476d4d5c71680cef85c6b190a3aea84e141c71e6e9747b0b5c90d9e8bd14ad68',
      text: 'حمل الحقيبة الثقيلة إلى السيارة.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0519',
      sha256: '3f286cc22cc2ce5f0ae68e7c8a955fcd83c453fdc3b21f14e802d48ab289babc',
      text: 'حَمَلَ الحقيبة الثقيلة إلى السيارة.',
      verdict: 'CORRECT',
      lessNatural: 'YES'
    }
  },
  {
    caseId: 'H22',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'الحمل',
    baseline: {
      sample: 'C0521',
      sha256: '96856746eaf114f33365f9f5abc98717e7dd18c658a396ebb1b875390fd99b21',
      text: 'هي في الشهر السابع من الحمل.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0527',
      sha256: '01b1c52c174406846da3886d5bce56404bd70fe97bfc56fa144a684b133c7aa7',
      text: 'هي في الشهر السابع من الحَمْل.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H23',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'الذهب',
    baseline: {
      sample: 'C0529',
      sha256: '3217cf68a7eeeb9d6bf51961e89769d6dd65dc1587d1cdd4d5a1e13db3598209',
      text: 'اشترت سلسلة من الذهب.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0535',
      sha256: 'd879b5c1b4e6acd498d52b01767dd68624539ed7a1f04513d710fbb74202e647',
      text: 'اشترت سلسلة من الذَّهَب.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H24',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'ذهب',
    baseline: {
      sample: 'C0537',
      sha256: '7da61c7aa2181b5b1259d8a08106aa7eab455478383ca8f20f78bdaea4c496f0',
      text: 'ذهب إلى العمل مبكرًا اليوم.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0543',
      sha256: '4b34b097a938e82d1f85882393dc6ce2d33cddd7f177df46e22e8a8e3cf6b67a',
      text: 'ذَهَبَ إلى العمل مبكرًا اليوم.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H25',
    kind: 'PAIR',
    group: 'HOMOGRAPH_MSA',
    dialect: 'MSA',
    target: 'قبل',
    baseline: {
      sample: 'C0545',
      sha256: '547951e97541a04b84ee9876fe8fc6f27c7ee7794527f01045afbd67f4e30b5d',
      text: 'قبل الدعوة بسرعة وشكرهم.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0551',
      sha256: '9d63978634b435195a7fdc865bb620d44d8abdfd088ac8235b6a406293e3658e',
      text: 'قَبِلَ الدعوة بسرعة وشكرهم.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H26',
    kind: 'PAIR',
    group: 'HOMOGRAPH_DIALECT',
    dialect: 'EGYPTIAN',
    target: 'قبل',
    baseline: {
      sample: 'C0553',
      sha256: '983b9fa4b31d46f2963d7941f60dabd0b9136d84828a77982c66265d204e3d24',
      text: 'كلمتك قبل الضهر بس مردتش.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0559',
      sha256: 'd9eeb896942d8d9a6c59cc3bad9afee714d0a8d0bc7d1cc01b9074f94a0578c7',
      text: 'كلمتك قَبْل الضهر بس مردتش.',
      verdict: 'CORRECT',
      lessNatural: 'YES'
    }
  },
  {
    caseId: 'H27',
    kind: 'PAIR',
    group: 'HOMOGRAPH_DIALECT',
    dialect: 'EGYPTIAN',
    target: 'جدي',
    baseline: {
      sample: 'C0561',
      sha256: '066e554874a6edb0d0d160d75d6f1392f6599d2ba08f8743c79fa687eeb6f1cd',
      text: 'جدي عنده تمانين سنة وصحته كويسة.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0567',
      sha256: 'c1f9af929a2c990a6978b2f66bb40c0e13d560e6abe1f3ee3a43cf4805db9533',
      text: 'جِدّي عنده تمانين سنة وصحته كويسة.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H28',
    kind: 'PAIR',
    group: 'HOMOGRAPH_DIALECT',
    dialect: 'EGYPTIAN',
    target: 'جد',
    baseline: {
      sample: 'C0569',
      sha256: '04b8d84f5f6b6d1fdffb12bb967b2ab84df731654fe57c324693425ca524c9e9',
      text: 'الموضوع ده جد مش هزار.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0575',
      sha256: '22e3914bb2d8905c41e3fd03c60b4c9502f1a49d949460a5707d190086009491',
      text: 'الموضوع ده جَدّ مش هزار.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H29',
    kind: 'PAIR',
    group: 'HOMOGRAPH_DIALECT',
    dialect: 'EGYPTIAN',
    target: 'عمري',
    baseline: {
      sample: 'C0577',
      sha256: 'de3b8e10b274ee88be3a1875dc7ee5bc6f65da3033bdd843efdcf84123e0b9ec',
      text: 'عمري تلاتين سنة ولسه بتعلم.',
      verdict: 'WRONG'
    },
    rendered: {
      sample: 'C0583',
      sha256: 'c12fa10e36e505f041a0a9f55443a8541747fbc9e7a3b8c4da25cd1dde7aeae3',
      text: 'عُمْري تلاتين سنة ولسه بتعلم.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'H30',
    kind: 'PAIR',
    group: 'HOMOGRAPH_DIALECT',
    dialect: 'EGYPTIAN',
    target: 'عمر',
    baseline: {
      sample: 'C0585',
      sha256: '5e3d7900b1b2aa827e2d6397ac5e9a7a458cbcbbfac2c7ff451ba620b773697a',
      text: 'عمر صاحبي من أيام الجامعة.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0591',
      sha256: 'a2e6b9a1e79e76c486d8e84589586bf0efae12eeec17305a5117e1a4db605b27',
      text: 'عُمَر صاحبي من أيام الجامعة.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'N01',
    kind: 'PAIR',
    group: 'NAME',
    dialect: 'MSA',
    target: 'هدير',
    baseline: {
      sample: 'C0007',
      sha256: '5b5adb770801c22c3af4c9a7c7347feff17e75f33452d1685fcc8971468160b3',
      text: 'اتصلت بك هدير مساء أمس.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0033',
      sha256: 'b6b7ac93f7be57a4319e46d6f9f9d9544b7f666263b35203a9ada680f2e19527',
      text: 'اتصلت بك هَدِير مساء أمس.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'N02',
    kind: 'PAIR',
    group: 'NAME',
    dialect: 'MSA',
    target: 'أسوان',
    baseline: {
      sample: 'C0063',
      sha256: 'db1819edccf0e434690bc6eeba676e961e28c87d60010515ce09f903e769cfb5',
      text: 'سافر يوسف مع عائلته إلى أسوان.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0089',
      sha256: '2f672d97358c1357fe82764e69e56ff8c82a7b34ae4c2f571b18052ca1eca4f8',
      text: 'سافر يوسف مع عائلته إلى أَسْوان.',
      verdict: 'WRONG',
      lessNatural: 'YES'
    }
  },
  {
    caseId: 'N03',
    kind: 'PAIR',
    group: 'NAME',
    dialect: 'EGYPTIAN',
    target: 'ضحى',
    baseline: {
      sample: 'C0119',
      sha256: 'cc79d2ff652f597ada5a2445127645b1d0d257a322b9b2ec64746612c095a05d',
      text: 'إسراء وضحى جايين معانا بكرة.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0143',
      sha256: 'fdd19ecb1e66352b61cd1b3e783a95a3c580f4d03b09b08cea5de8490d71f18f',
      text: 'إسراء وضُحَى جايين معانا بكرة.',
      verdict: 'CORRECT',
      lessNatural: 'YES'
    }
  },
  {
    caseId: 'N07',
    kind: 'PAIR',
    group: 'NAME',
    dialect: 'GULF',
    target: 'نورة',
    baseline: {
      sample: 'C0239',
      sha256: '8884ff84ad84ed5910f4e9de5d4ec4f0b3dfb9be7d006afb3a796880e3425deb',
      text: 'عبدالعزيز ونورة بيجون الرياض بكرة.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0263',
      sha256: 'd7f6c8db3dde03c69a69538deecfbb29f2360dc475bb0a27165cb16a2bc0cd17',
      text: 'عبدالعزيز ونُورَة بيجون الرياض بكرة.',
      verdict: 'CORRECT',
      lessNatural: 'YES'
    }
  },
  {
    caseId: 'N08',
    kind: 'PAIR',
    group: 'NAME',
    dialect: 'LEVANTINE',
    target: 'حلب',
    baseline: {
      sample: 'C0287',
      sha256: 'f99e9af16d8da2585f8c6fec3f7c49e8f8fe0df23744b16983585d078a474f44',
      text: 'جورج ورامي رح يجو عحلب.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0311',
      sha256: 'c251e77be5ac8b5d5ffb534c0c3f9686063d10c1cc25f1cffd652ce32c78bd17',
      text: 'جورج ورامي رح يجو عحَلَب.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'D01',
    kind: 'PAIR',
    group: 'NUMBER',
    dialect: 'MSA',
    target: null,
    baseline: {
      sample: 'C0009',
      sha256: '2febc893d6d36a795ee34fdf0e892835b8a3c153f6b6499e8688e2873bc85696',
      text: 'الموعد في الساعة 7:30 مساءً.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0039',
      sha256: '349298530e617b7cbb5eddaf9bdf444e3f91d2c753feae9757dfaa9497bc98a5',
      text: 'الموعد في الساعة السابعة والنصف مساءً.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'D02',
    kind: 'PAIR',
    group: 'NUMBER',
    dialect: 'EGYPTIAN',
    target: null,
    baseline: {
      sample: 'C0065',
      sha256: 'f64889c3355067bd2d45f648b6b135e721c850ed1223d634c24021963d14116d',
      text: 'دفعت 2500 جنيه.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0095',
      sha256: '3c2610eccfff5d79399e9d95385c621509a793981b635f886cc60a768f00183d',
      text: 'دفعت ألفين وخمسمية جنيه.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'D03',
    kind: 'PAIR',
    group: 'NUMBER',
    dialect: 'MSA',
    target: null,
    baseline: {
      sample: 'C0121',
      sha256: 'af14f81fc4830faec1b9e943fae388f3f4d52c00ea523df58986da124eb72f5d',
      text: 'ولد في 15/3/1990.',
      verdict: 'WRONG'
    },
    rendered: {
      sample: 'C0145',
      sha256: '66f53e37d907344609d3c9c4c09cca35013b7e7703dc92610698deab1faca2cd',
      text: 'ولد في الخامس عشر من مارس عام ألف وتسعمئة وتسعين.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'D04',
    kind: 'PAIR',
    group: 'NUMBER',
    dialect: 'MSA',
    target: null,
    baseline: {
      sample: 'C0169',
      sha256: 'af3c74bc0b809d425911a59784290fb09d82e32faa40d13571e445c46cce56b4',
      text: 'ارتفع السعر بنسبة 25%.',
      verdict: 'WRONG'
    },
    rendered: {
      sample: 'C0193',
      sha256: '59fab26ab5cb5a1b36f247a40f44d661739cfa3efc4124effa4f9cae23315e66',
      text: 'ارتفع السعر بنسبة خمسة وعشرين في المئة.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'D05',
    kind: 'PAIR',
    group: 'NUMBER',
    dialect: 'EGYPTIAN',
    target: null,
    baseline: {
      sample: 'C0217',
      sha256: 'd59034528257c5872fefe11ab52f815119ca83cf4fefb768abf01d9d9a5871a9',
      text: 'فاضل ٣ أيام على الامتحان.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0241',
      sha256: 'b46d027c17c3b93729924f09ce1759d66b7acc9e9de49f2033d9d44fd3a5f93c',
      text: 'فاضل تلات أيام على الامتحان.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'D06',
    kind: 'PAIR',
    group: 'NUMBER',
    dialect: 'GULF',
    target: null,
    baseline: {
      sample: 'C0265',
      sha256: '48f934e4734188e79082d77efbe4aeca7c05b07d720b2b2dc4301f786686e145',
      text: 'الرحلة الساعة 10:15 الصبح.',
      verdict: 'CORRECT'
    },
    rendered: {
      sample: 'C0289',
      sha256: '69bd060623e336ebf141d4268b4ce24fc9de79d31fd92dc603af753e2d05aa0b',
      text: 'الرحلة الساعة عشر وربع الصبح.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'D07',
    kind: 'PAIR',
    group: 'NUMBER',
    dialect: 'MSA',
    target: null,
    baseline: {
      sample: 'C0313',
      sha256: '8496e807876158ae7267bcee3c8b69b249ee0d2a760eedb9a3c344d36e85e869',
      text: 'المسافة 3.5 كيلومتر.',
      verdict: 'WRONG'
    },
    rendered: {
      sample: 'C0329',
      sha256: 'db972b0bb014e43b32c07b18415ac378d8374dc404a38bc981d4d971b9de3b90',
      text: 'المسافة ثلاثة كيلومترات ونصف.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'D08',
    kind: 'PAIR',
    group: 'NUMBER',
    dialect: 'LEVANTINE',
    target: null,
    baseline: {
      sample: 'C0343',
      sha256: '647d0bb1a256b9bbfcdb32568ae3b8b5e6384f8af88cb8ad9e622422160f6917',
      text: 'عمرها 21 سنة.',
      verdict: 'WRONG'
    },
    rendered: {
      sample: 'C0353',
      sha256: 'e398eabef5583ac98282b80dc6ad711e074d6ee30a30fd906ddf1d8f68d37f7a',
      text: 'عمرها واحد وعشرين سنة.',
      verdict: 'CORRECT',
      lessNatural: 'NO'
    }
  },
  {
    caseId: 'N04',
    kind: 'SINGLE',
    group: 'SINGLE',
    dialect: 'MSA',
    target: 'جان بيير',
    baseline: {
      sample: 'C0167',
      sha256: 'ef8fb1a4f33a2524632541ce50f57ab926a63d55e83c2959ea5c51f0c210d44a',
      text: 'التقيت بجان بيير في مؤتمر باريس.',
      verdict: 'CORRECT'
    },
    rendered: null
  },
  {
    caseId: 'N05',
    kind: 'SINGLE',
    group: 'SINGLE',
    dialect: 'EGYPTIAN',
    target: 'الواتساب',
    baseline: {
      sample: 'C0191',
      sha256: '4ffb011064fa07306574327695c17b596fbb195e07b2acc6bd1e5a440847b5f1',
      text: 'بعتلك اللينك على الواتساب.',
      verdict: 'CORRECT'
    },
    rendered: null
  },
  {
    caseId: 'N06',
    kind: 'SINGLE',
    group: 'SINGLE',
    dialect: 'MSA',
    target: 'مايكروسوفت',
    baseline: {
      sample: 'C0215',
      sha256: 'be796109fd335f145e54bda3571b9518892fef4d57c22c9da77f8fa6b17584b0',
      text: 'تعمل نور في شركة مايكروسوفت.',
      verdict: 'CORRECT'
    },
    rendered: null
  }
];

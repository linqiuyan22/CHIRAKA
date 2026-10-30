/* ==========================================================================
   CHIRAKA · 数据层配置与初始回退快照 (Data Config & Schema Fallback)
   --------------------------------------------------------------------------
   架构说明：
   1. 网站框架代码（HTML / CSS / app.js）与可修改业务数据（data/content-data.json）已彻底分离。
   2. 联网部署时，启动根目录下的 `node server.js`（或挂载你自己的后端 API），
      前端会自动从 `/api/content` 或 `data/content-data.json` 拉取最新数据；
      管理员在线保存时，会自动通过 POST `/api/content` 将修改写回服务器的 `data/content-data.json`。
   ========================================================================== */
window.CHIRAKA_DATA_CONFIG = {
  apiEndpoint: "/api/content",
  jsonPath: "data/content-data.json",
  autoSyncServer: true
};

window.CHIRAKA_DATA = {
  "home": {
    "overline": "A CITY OF STORIES & DESIRE",
    "title": "CHIRAKA",
    "subtitle": "Vice Unity",
    "mottoCn": "混沌中，旋律联结\n罪恶、欲望与爱。",
    "mottoEn": "Where sunset palms meet late-night vinyl & untamed souls.",
    "backdrop": "assets/bg/city-sunset.jpg",
    "folders": [
      {
        "theme": "rose",
        "index": "01",
        "label": "角色档案",
        "english": "Citizens & Connections",
        "kicker": "ARCHIVE 01 // CHARACTER FILES",
        "desc": "人物、身份与关系交织成一座西海岸不夜城。",
        "pills": [
          "核心角色 × 04",
          "配角档案 × 02",
          "外观与故事联动"
        ],
        "photo": "assets/bg/city-sunset.jpg",
        "photoLabel": "Vice Unity · 01",
        "signature": "Chiraka",
        "enterText": "调阅人物卷宗 // DOSSIER",
        "url": "characters.html",
        "view": "characters"
      },
      {
        "theme": "peach",
        "index": "02",
        "label": "城市新闻",
        "english": "Dispatch & Night BBS",
        "kicker": "ARCHIVE 02 // CITY DESK & FORUM",
        "desc": "从官方头版头条到午夜街头匿名论坛，追踪这座城的昼夜脉搏与市民八卦。",
        "pills": [
          "官方头版",
          "街头论坛 BBS",
          "跟帖盖楼",
          "角色联动"
        ],
        "photo": "assets/bg/city-street.jpg",
        "photoLabel": "City Desk · 02",
        "signature": "City Desk",
        "enterText": "潜入新闻与论坛 // CITY BBS",
        "url": "news.html",
        "view": "news"
      },
      {
        "theme": "lilac",
        "index": "03",
        "label": "插画画廊",
        "english": "Art & Memories",
        "kicker": "ARCHIVE 03 // VISUAL GALLERY",
        "desc": "硬朗漫画分镜、角色立绘与每一帧背后的故事注记，与人物卷宗实时联动。",
        "pills": [
          "角色立绘",
          "群像插画",
          "漫画分镜",
          "服装设定"
        ],
        "photo": "assets/bg/city-beach-reference.jpg",
        "photoLabel": "Gallery · 03",
        "signature": "Visuals",
        "enterText": "展开视觉分镜 // GALLERY",
        "url": "gallery.html",
        "view": "gallery"
      },
      {
        "theme": "aqua",
        "index": "04",
        "label": "城市电台",
        "english": "Fabulous Vegas 88.8",
        "kicker": "ARCHIVE 04 // CHIRAKA FM 88.8",
        "desc": "把拉斯维加斯的梦幻夜色收进玻璃黑胶唱机，自由切换多频段电台与角色印象曲。",
        "pills": [
          "多频段电台",
          "黑胶唱机",
          "FM 88.8"
        ],
        "photo": "assets/bg/city-bridge-reference.jpg",
        "photoLabel": "Vegas 88.8 · 04",
        "signature": "Chiraka FM",
        "enterText": "接入午夜电台 // TUNE IN",
        "url": "radio.html",
        "view": "radio"
      }
    ]
  },
  "characters": [
    {
      "id": "ch-01",
      "label": "角色 01",
      "name": "待补充",
      "alias": "待补充",
      "gender": "待补充",
      "birthday": "待补充",
      "zodiac": "待补充",
      "age": "待补充",
      "height": "待补充",
      "category": "core",
      "categoryLabel": "核心角色",
      "status": "待补充",
      "identity": "待补充",
      "faction": "待补充",
      "tone": "pink",
      "image": "",
      "summary": "待补充",
      "appearance": "待补充（可在下方上传或从画廊联动角色外观与服装设定插图）",
      "appearanceImages": [],
      "storylines": [
        {
          "stage": "序章 · 初入灷城",
          "title": "待补充故事标题",
          "content": "待补充角色主线或支线故事记录。"
        }
      ],
      "notes": "待补充",
      "relations": [
        {
          "target": "ch-02",
          "label": "待补充"
        },
        {
          "target": "ch-03",
          "label": "待补充"
        },
        {
          "target": "ch-04",
          "label": "待补充"
        }
      ]
    },
    {
      "id": "ch-02",
      "label": "角色 02",
      "name": "待补充",
      "alias": "待补充",
      "gender": "待补充",
      "birthday": "待补充",
      "zodiac": "待补充",
      "age": "待补充",
      "height": "待补充",
      "category": "core",
      "categoryLabel": "核心角色",
      "status": "待补充",
      "identity": "待补充",
      "faction": "待补充",
      "tone": "cyan",
      "image": "",
      "summary": "待补充",
      "appearance": "待补充",
      "appearanceImages": [],
      "storylines": [
        {
          "stage": "档案记录 01",
          "title": "待补充故事标题",
          "content": "待补充角色故事线内容。"
        }
      ],
      "notes": "待补充",
      "relations": [
        {
          "target": "ch-01",
          "label": "待补充"
        },
        {
          "target": "ch-05",
          "label": "待补充"
        }
      ]
    },
    {
      "id": "ch-03",
      "label": "角色 03",
      "name": "待补充",
      "alias": "待补充",
      "gender": "待补充",
      "birthday": "待补充",
      "zodiac": "待补充",
      "age": "待补充",
      "height": "待补充",
      "category": "core",
      "categoryLabel": "核心角色",
      "status": "待补充",
      "identity": "待补充",
      "faction": "待补充",
      "tone": "violet",
      "image": "",
      "summary": "待补充",
      "appearance": "待补充",
      "appearanceImages": [],
      "storylines": [
        {
          "stage": "档案记录 01",
          "title": "待补充故事标题",
          "content": "待补充角色故事线内容。"
        }
      ],
      "notes": "待补充",
      "relations": [
        {
          "target": "ch-01",
          "label": "待补充"
        },
        {
          "target": "ch-06",
          "label": "待补充"
        }
      ]
    },
    {
      "id": "ch-04",
      "label": "角色 04",
      "name": "待补充",
      "alias": "待补充",
      "gender": "待补充",
      "birthday": "待补充",
      "zodiac": "待补充",
      "age": "待补充",
      "height": "待补充",
      "category": "core",
      "categoryLabel": "核心角色",
      "status": "待补充",
      "identity": "待补充",
      "faction": "待补充",
      "tone": "orange",
      "image": "",
      "summary": "待补充",
      "appearance": "待补充",
      "appearanceImages": [],
      "storylines": [
        {
          "stage": "档案记录 01",
          "title": "待补充故事标题",
          "content": "待补充角色故事线内容。"
        }
      ],
      "notes": "待补充",
      "relations": [
        {
          "target": "ch-01",
          "label": "待补充"
        },
        {
          "target": "ch-06",
          "label": "待补充"
        }
      ]
    },
    {
      "id": "ch-05",
      "label": "角色 05",
      "name": "待补充",
      "alias": "待补充",
      "gender": "待补充",
      "birthday": "待补充",
      "zodiac": "待补充",
      "age": "待补充",
      "height": "待补充",
      "category": "side",
      "categoryLabel": "配角",
      "status": "待补充",
      "identity": "待补充",
      "faction": "待补充",
      "tone": "mint",
      "image": "",
      "summary": "待补充",
      "appearance": "待补充",
      "appearanceImages": [],
      "storylines": [],
      "notes": "待补充",
      "relations": [
        {
          "target": "ch-02",
          "label": "待补充"
        }
      ]
    },
    {
      "id": "ch-06",
      "label": "角色 06",
      "name": "待补充",
      "alias": "待补充",
      "gender": "待补充",
      "birthday": "待补充",
      "zodiac": "待补充",
      "age": "待补充",
      "height": "待补充",
      "category": "side",
      "categoryLabel": "配角",
      "status": "待补充",
      "identity": "待补充",
      "faction": "待补充",
      "tone": "gold",
      "image": "",
      "summary": "待补充",
      "appearance": "待补充",
      "appearanceImages": [],
      "storylines": [],
      "notes": "待补充",
      "relations": [
        {
          "target": "ch-03",
          "label": "待补充"
        },
        {
          "target": "ch-04",
          "label": "待补充"
        }
      ]
    }
  ],
  "news": [
    {
      "id": "n-01",
      "postType": "news",
      "category": "头版",
      "tone": "pink",
      "title": "待补充（头版头条标题）",
      "summary": "待补充（头版报道导语摘要，支持关联角色与下方市民跟帖讨论）",
      "date": "10-29 22:15",
      "author": "CHIRAKA 晚报编辑部",
      "authorRole": "官方记者",
      "views": 1280,
      "likes": 46,
      "image": "assets/bg/city-street.jpg",
      "relatedCharacters": [
        "ch-01",
        "ch-02"
      ],
      "body": [
        "待补充正文段落：可在管理员模式下点击编辑，替换成正式的城市大事件报道或世界观纪事。",
        "报道下方已开启西海岸市民匿名跟帖区，可随时盖楼互动。"
      ],
      "comments": [
        {
          "id": "c-101",
          "author": "夜班出租车司机",
          "role": "匿名市民",
          "charId": "",
          "time": "10分钟前",
          "likes": 12,
          "content": "昨晚路过落日大道的时候看到警车封锁了整条街，果然出事了……"
        },
        {
          "id": "c-102",
          "author": "角色 01",
          "role": "当事人",
          "charId": "ch-01",
          "time": "3分钟前",
          "likes": 29,
          "content": "待补充角色专属回帖（管理员可自由编辑或新增角色盖楼）"
        }
      ]
    },
    {
      "id": "n-02",
      "postType": "forum",
      "category": "街头论坛",
      "tone": "cyan",
      "title": "【树洞/八卦】最近棕榈海岸夜店街那几个人到底是什么来头？",
      "summary": "待补充（街头匿名论坛热帖，点击进入查看市民盖楼与角色互动）",
      "date": "10-29 23:40",
      "author": "不愿透露姓名的调酒师",
      "authorRole": "Night BBS 楼主",
      "views": 892,
      "likes": 64,
      "image": "",
      "relatedCharacters": [
        "ch-01",
        "ch-03"
      ],
      "body": [
        "如题，最近每天凌晨都能在 FM 88.8 听到他们的点歌暗号，有没有知情人士扒一扒？",
        "（待补充更多主帖内容）"
      ],
      "comments": [
        {
          "id": "c-201",
          "author": "吃瓜路人A",
          "role": "论坛常客",
          "charId": "",
          "time": "1小时前",
          "likes": 8,
          "content": "前排火钳刘明，小心被删帖！"
        }
      ]
    },
    {
      "id": "n-03",
      "postType": "forum",
      "category": "夜生活",
      "tone": "violet",
      "title": "待补充（夜生活或街头悬赏帖标题）",
      "summary": "待补充",
      "date": "待补充",
      "author": "匿名市民",
      "authorRole": "街头线人",
      "views": 340,
      "likes": 19,
      "image": "",
      "relatedCharacters": [
        "ch-04"
      ],
      "body": [
        "待补充"
      ],
      "comments": []
    },
    {
      "id": "n-04",
      "postType": "news",
      "category": "公告",
      "tone": "orange",
      "title": "待补充（市政或电台公告标题）",
      "summary": "待补充",
      "date": "待补充",
      "author": "WCPD 市政厅",
      "authorRole": "官方公告",
      "views": 510,
      "likes": 15,
      "image": "",
      "relatedCharacters": [],
      "body": [
        "待补充"
      ],
      "comments": []
    },
    {
      "id": "n-05",
      "postType": "forum",
      "category": "文化",
      "tone": "mint",
      "title": "待补充（黑胶乐评或城市文化讨论帖）",
      "summary": "待补充",
      "date": "待补充",
      "author": "FM 88.8 听众",
      "authorRole": "黑胶藏家",
      "views": 420,
      "likes": 27,
      "image": "",
      "relatedCharacters": [
        "ch-02"
      ],
      "body": [
        "待补充"
      ],
      "comments": []
    }
  ],
  "gallery": [
    {
      "id": "g-01",
      "category": "character",
      "title": "角色插画 01",
      "characterId": "ch-01",
      "story": "待补充（记录这幅插画背后的小故事或场景设定，会自动同步到对应角色的档案中）",
      "src": "",
      "tone": "pink",
      "span": "wide"
    },
    {
      "id": "g-02",
      "category": "character",
      "title": "角色插画 02",
      "characterId": "ch-02",
      "story": "待补充",
      "src": "",
      "tone": "cyan",
      "span": "tall"
    },
    {
      "id": "g-03",
      "category": "character",
      "title": "角色插画 03",
      "characterId": "ch-03",
      "story": "待补充",
      "src": "",
      "tone": "violet",
      "span": "normal"
    },
    {
      "id": "g-04",
      "category": "group",
      "title": "群像 01",
      "characterId": "ch-01",
      "story": "待补充",
      "src": "",
      "tone": "orange",
      "span": "normal"
    },
    {
      "id": "g-05",
      "category": "character",
      "title": "角色插画 04",
      "characterId": "ch-04",
      "story": "待补充",
      "src": "",
      "tone": "mint",
      "span": "normal"
    },
    {
      "id": "g-06",
      "category": "comic",
      "title": "漫画分镜 01",
      "characterId": "ch-01",
      "story": "待补充",
      "src": "",
      "tone": "gold",
      "span": "normal"
    },
    {
      "id": "g-07",
      "category": "costume",
      "title": "服装设定 01",
      "characterId": "ch-01",
      "story": "待补充（分类为「服装设定」或「角色立绘」并绑定角色后，会自动联动展示在该角色的【02 外观与服装设定】中）",
      "src": "",
      "tone": "pink",
      "span": "normal"
    },
    {
      "id": "g-08",
      "category": "group",
      "title": "群像 02",
      "characterId": "ch-02",
      "story": "待补充",
      "src": "",
      "tone": "cyan",
      "span": "wide"
    },
    {
      "id": "g-09",
      "category": "comic",
      "title": "漫画分镜 02",
      "characterId": "ch-03",
      "story": "待补充",
      "src": "",
      "tone": "violet",
      "span": "normal"
    },
    {
      "id": "g-10",
      "category": "costume",
      "title": "服装设定 02",
      "characterId": "ch-02",
      "story": "待补充",
      "src": "",
      "tone": "mint",
      "span": "tall"
    },
    {
      "id": "g-11",
      "category": "character",
      "title": "角色插画 05",
      "characterId": "ch-05",
      "story": "待补充",
      "src": "",
      "tone": "orange",
      "span": "normal"
    },
    {
      "id": "g-12",
      "category": "group",
      "title": "群像 03",
      "characterId": "",
      "story": "待补充",
      "src": "",
      "tone": "gold",
      "span": "normal"
    },
    {
      "id": "g-13",
      "category": "comic",
      "title": "漫画分镜 03",
      "characterId": "ch-04",
      "story": "待补充",
      "src": "",
      "tone": "pink",
      "span": "wide"
    },
    {
      "id": "g-14",
      "category": "costume",
      "title": "服装设定 03",
      "characterId": "ch-03",
      "story": "待补充",
      "src": "",
      "tone": "cyan",
      "span": "normal"
    },
    {
      "id": "g-15",
      "category": "character",
      "title": "角色插画 06",
      "characterId": "ch-06",
      "story": "待补充",
      "src": "",
      "tone": "violet",
      "span": "normal"
    },
    {
      "id": "g-16",
      "category": "costume",
      "title": "服装设定 04",
      "characterId": "ch-04",
      "story": "待补充",
      "src": "",
      "tone": "orange",
      "span": "normal"
    },
    {
      "id": "g-17",
      "category": "character",
      "title": "角色插画 07",
      "characterId": "ch-01",
      "story": "待补充",
      "src": "",
      "tone": "gold",
      "span": "normal"
    },
    {
      "id": "g-18",
      "category": "group",
      "title": "群像 04",
      "characterId": "",
      "story": "待补充",
      "src": "",
      "tone": "mint",
      "span": "normal"
    },
    {
      "id": "g-19",
      "category": "costume",
      "title": "服装设定 05",
      "characterId": "ch-05",
      "story": "待补充",
      "src": "",
      "tone": "violet",
      "span": "normal"
    }
  ],
  "stations": [
    {
      "id": "vice-unity",
      "name": "Vice Unity",
      "suit": "♥",
      "freq": "FM 88.8",
      "host": "DJ Vesper",
      "desc": "西海岸落日合成器与不夜城主频段"
    },
    {
      "id": "sunset-coast",
      "name": "Sunset Coast",
      "suit": "♦",
      "freq": "FM 92.4",
      "host": "Coast Line",
      "desc": "棕榈大道与海风巡航慢摇"
    },
    {
      "id": "late-night",
      "name": "Late Night",
      "suit": "♣",
      "freq": "FM 104.6",
      "host": "Noir Club",
      "desc": "午夜酒廊、迷幻爵士与暗巷电波"
    }
  ],
  "tracks": [
    {
      "id": "t-01",
      "title": "曲目 01",
      "artist": "CHIRAKA FM",
      "src": "",
      "duration": "03:42",
      "scene": "Sunset Blvd",
      "station": "vice-unity",
      "characterId": "ch-01",
      "suit": "♥",
      "rank": "A",
      "cover": "assets/bg/city-sunset.jpg",
      "tone": "pink",
      "bpm": "92 BPM · WEST COAST SYNTH"
    },
    {
      "id": "t-02",
      "title": "曲目 02",
      "artist": "CHIRAKA FM",
      "src": "",
      "duration": "04:15",
      "scene": "Key Bridge",
      "station": "sunset-coast",
      "characterId": "ch-02",
      "suit": "♠",
      "rank": "K",
      "cover": "assets/bg/city-bridge-reference.jpg",
      "tone": "cyan",
      "bpm": "86 BPM · OCEAN DRIVE"
    },
    {
      "id": "t-03",
      "title": "曲目 03",
      "artist": "CHIRAKA FM",
      "src": "",
      "duration": "03:28",
      "scene": "Lifeguard Tower",
      "station": "sunset-coast",
      "characterId": "ch-03",
      "suit": "♦",
      "rank": "Q",
      "cover": "assets/bg/city-beach-reference.jpg",
      "tone": "orange",
      "bpm": "98 BPM · SUMMER BREEZE"
    },
    {
      "id": "t-04",
      "title": "曲目 04",
      "artist": "CHIRAKA FM",
      "src": "",
      "duration": "04:50",
      "scene": "Midnight Diner",
      "station": "late-night",
      "characterId": "ch-04",
      "suit": "♣",
      "rank": "J",
      "cover": "assets/bg/city-street.jpg",
      "tone": "violet",
      "bpm": "78 BPM · AFTER HOURS"
    }
  ]
};

window.PLATFORM_DATA = {
  "id": "tcf",
  "title": "公平待客暨金融友善週報",
  "brand": "公平待客週報",
  "icon": "book",
  "authAppName": null,
  "queue": true,
  "requiresFacts": false,
  "requiresUpgrade": false,
  "summaryLimit": 1400,
  "maxPerRun": 12,
  "defaults": {
    "dailyLimit": 20,
    "maxPerRun": 6
  },
  "collections": {
    "articles": "articles",
    "reports": "weeklyReports",
    "status": "publicStatus",
    "sources": "sources",
    "settings": "settings",
    "runs": "runs",
    "quotas": null,
    "knowledge": "knowledge",
    "feedback": "feedback"
  },
  "functions": {
    "initialize": "upgradePlatform",
    "seed": "initializeSources",
    "collect": "refreshSources",
    "weekly": "generateWeeklyReport",
    "pipeline": "setPipeline",
    "source": "saveSource",
    "ingest": "ingestArticle",
    "edit": "editArticle",
    "visibility": "setArticleReview",
    "feedback": "saveSource",
    "permanentDelete": "setArticleReview",
    "compact": "generateWeeklyReport"
  },
  "topics": [
    "數位無障礙",
    "高齡友善",
    "身心障礙服務",
    "申訴保障",
    "防詐與金融安全",
    "治理與評核",
    "溝通協助",
    "實體設施"
  ],
  "principles": [
    "訂約公平誠信",
    "注意與忠實義務",
    "廣告招攬真實",
    "商品或服務適合度",
    "告知與揭露",
    "酬金與業績衡平",
    "申訴保障",
    "業務人員專業性",
    "友善服務",
    "落實誠信經營"
  ],
  "sourceTypes": [
    "主管機關",
    "同業公告",
    "相關機構",
    "新聞媒體"
  ],
  "knowledgeSeeds": [
    {
      "term": "公平待客原則",
      "aliases": [
        "金融服務業公平待客原則"
      ],
      "definition": "金融服務業在商品設計、銷售、服務與爭議處理等過程公平對待客戶的行為原則。",
      "bankRelevance": "可用來理解銀行治理與服務流程中的金融消費者保護要求。",
      "source": "金融監督管理委員會",
      "url": "https://law.fsc.gov.tw/LawContent.aspx?id=GL001766",
      "topics": [
        "治理與評核"
      ],
      "id": "d70d02c8427f4e11b1a0edfed9ba62502bddfff3371712bc3f5ddc8225a3b063",
      "articleIds": [],
      "published": true,
      "englishTerm": "Treating Customers Fairly",
      "abbreviation": "TCF",
      "translation": "公平待客原則"
    },
    {
      "term": "友善服務",
      "aliases": [
        "友善服務原則"
      ],
      "definition": "重視不同客群使用金融服務的需求，並在服務流程、資訊溝通與使用環境中提供適當協助。",
      "bankRelevance": "可作為理解高齡與身心障礙客群金融服務措施的入門背景。",
      "source": "金融監督管理委員會",
      "url": "https://law.fsc.gov.tw/LawContent.aspx?id=GL001766",
      "topics": [
        "身心障礙服務"
      ],
      "id": "a89c8be5aef07d6e0c662480ae15870842ffdd3700a809f7c4334855143ae0ec",
      "articleIds": [],
      "published": true,
      "englishTerm": "",
      "abbreviation": "",
      "translation": ""
    },
    {
      "term": "易受損害消費者",
      "aliases": [
        "Vulnerable customer",
        "脆弱消費者"
      ],
      "definition": "依英國 FCA 的說明，因個人處境而特別容易受到損害的消費者，尤其在金融機構未給予適當照顧時。此為國外監理概念，非直接等同臺灣法定分類。",
      "bankRelevance": "協助從健康、生活事件、財務韌性及理解能力等面向思考服務需求，避免只依年齡分類。",
      "source": "英國金融行為監理總署（FCA）",
      "url": "https://www.fca.org.uk/news/press-releases/fca-launches-guidance-firms-fair-treatment-vulnerable-customers",
      "topics": [
        "高齡友善",
        "溝通協助"
      ],
      "id": "57129dcc13d224307652264be0e38c299b776625d19f5f3c20d1cd4663a49e99",
      "articleIds": [],
      "published": true,
      "englishTerm": "Vulnerable customers",
      "abbreviation": "",
      "translation": "易受損害消費者"
    },
    {
      "term": "網頁無障礙",
      "aliases": [
        "Web accessibility",
        "數位無障礙"
      ],
      "definition": "讓身心障礙者能感知、理解、瀏覽並操作網站與數位工具的設計與開發方式，也涵蓋與輔助科技的配合。",
      "bankRelevance": "可用於檢視網路銀行、線上申辦與公開資訊是否能由不同使用者操作。",
      "source": "全球資訊網協會（W3C）",
      "url": "https://www.w3.org/WAI/fundamentals/accessibility-intro/",
      "topics": [
        "數位無障礙",
        "身心障礙服務"
      ],
      "id": "4a41ee70de864438245402ece5bf8c6d0f551693e1c3d8655c5c690361af776f",
      "articleIds": [],
      "published": true,
      "englishTerm": "Web accessibility",
      "abbreviation": "",
      "translation": "網頁無障礙"
    }
  ],
  "allowedHosts": [
    "www.fsc.gov.tw",
    "www.banking.gov.tw",
    "law.fsc.gov.tw",
    "tcf.sfi.org.tw",
    "www.cna.com.tw",
    "www.ctee.com.tw",
    "www.finextra.com",
    "www.fca.org.uk"
  ]
};

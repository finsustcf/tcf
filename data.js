/* Platform identity and backend mapping. Shared UI files are identical in both repositories. */
window.PLATFORM_DATA = {
  "id": "tcf",
  "title": "公平待客暨金融友善週報",
  "brand": "公平待客週報",
  "icon": "book",
  "authAppName": null,
  "queue": false,
  "requiresFacts": true,
  "requiresUpgrade": true,
  "summaryLimit": 1200,
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
    "quotas": null
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
    "visibility": "setArticleReview"
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
  ]
};

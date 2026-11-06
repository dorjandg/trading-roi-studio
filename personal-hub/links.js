/* Edit only this file to add, remove, or reorganize links.
   Public repository: never put passwords, tokens, or private information here. */
window.PERSONAL_HUB_DATA = {
  version: "1.0.0",
  updated: "2026-11-06",
  title: "Personal Hub",
  subtitle: "My websites, learning, dashboards and useful links.",
  categories: [
    { id: "workspaces", name: "My Websites", icon: "grid", description: "Projects and sites I am building", order: 1 },
    { id: "learning", name: "Learning & Study", icon: "book", description: "Courses, research, tutorials and study resources", order: 2 },
    { id: "trading", name: "Trading & Finance", icon: "chart", description: "Trading platforms, analytics and financial tools", order: 3 },
    { id: "media", name: "Videos & Channels", icon: "play", description: "Saved channels, videos and playlists", order: 4 },
    { id: "documents", name: "Sheets & Documents", icon: "file", description: "Spreadsheets, documents and shared files", order: 5 },
    { id: "wellbeing", name: "Health & Lifestyle", icon: "heart", description: "Wellness, fitness and everyday tools", order: 6 },
    { id: "services", name: "Tools & Services", icon: "layers", description: "Online services, reference sites and other links", order: 7 }
  ],
  links: [
    {
      id: "trading-roi-studio",
      title: "Trading ROI Studio",
      url: "https://trading-roi-studio.pages.dev/",
      description: "Trading account planning, prop-firm strategies, scenario comparisons and simulations.",
      category: "workspaces", type: "My website", symbol: "TR",
      accent: "blue", featured: true,
      tags: ["trading studio", "ROI", "prop firms", "FTMO", "Hola Prime", "Topstep", "simulation", "risk"]
    },
    {
      id: "jj-simon-knowledge",
      title: "JJ Simon Knowledge Hub",
      url: "https://jj-simon-knowledge.pages.dev/",
      description: "Organized course research, lessons, risk management, important concepts and searchable findings.",
      category: "workspaces", type: "My website", symbol: "JJ",
      accent: "purple", featured: true,
      tags: ["JJ Simon", "JJ", "study", "course", "EV", "risk of ruin", "prop firms", "lessons"]
    },
    {
      id: "whoop",
      title: "WHOOP",
      url: "https://app.whoop.com/",
      description: "Open the WHOOP web dashboard for recovery, sleep and activity insights.",
      category: "wellbeing", type: "Dashboard", symbol: "W",
      accent: "green",
      tags: ["health", "fitness", "recovery", "sleep", "strain", "wearable"]
    },
    {
      id: "google-sheets",
      title: "Google Sheets",
      url: "https://sheets.google.com/",
      description: "Open Google Sheets. Individual spreadsheets can be linked here when added.",
      category: "documents", type: "Service", symbol: "S",
      accent: "emerald",
      tags: ["spreadsheets", "Google", "tables", "documents"]
    },
    {
      id: "youtube",
      title: "YouTube",
      url: "https://www.youtube.com/",
      description: "Open YouTube. Favorite videos and channels will get their own entries.",
      category: "media", type: "Service", symbol: "▶",
      accent: "red",
      tags: ["videos", "channels", "playlists", "study"]
    }
  ]
};
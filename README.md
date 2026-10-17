# CamCompare

Camera specs side by side, and the lowest new and used price across US
retailers. Next.js 14, static pages, no database. Data lives in `data/`.

```
npm install
npm run dev               # http://localhost:3000
npm run catalog:check     # validate data/cameras
npm run thumbs:fetch      # thumbnails from Wikimedia Commons
npm run import:prices     # daily price import (needs the keys in .env.example)
npm test
```

- Why it's built this way: `docs/FEASIBILITY.md`, `DECISIONS.md`
- What to set up: `docs/OWNER-CHECKLIST.md`
- Retailers, feeds, matching: `docs/retailers.md`
- Images: `docs/images.md`

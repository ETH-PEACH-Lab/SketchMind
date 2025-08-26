1. **Build and run with Docker Compose**
```bash
docker-compose up --build
```

2. **Or build and run manually**
```bash
# Build image
docker build -t sketchmind .

# Run container
docker run -p 3000:3000 -p 4000:4000 --env-file .\.env sketchmind `
  /bin/bash -lc "node /app/backend/index.js & cd /app/frontend && npm run dev -- -p 3000"
```

## Project Structure

```
SketchMind/
├── frontend/                 # Next.js frontend application
│   ├── components/          # React components
│   ├── pages/              # Next.js pages
│   ├── utils/              # Utility functions
│   └── package.json
├── backend/                 # Node.js backend API
│   ├── routes/             # API routes
│   ├── middleware/         # Express middleware
│   └── package.json
├── .env                     # Environment variables
├── Dockerfile              # Docker configuration
├── docker-compose.yml      # Docker Compose configuration
└── README.md
```

## API Endpoints

- `POST /api/validate` - Validate drawing against step requirements
- `POST /api/analyze` - Analyze drawing and provide AI feedback

## Development

### Frontend
- Built with Next.js 15
- Uses Excalidraw for drawing functionality
- Material-UI components for UI
- TypeScript for type safety

### Backend  
- Express.js server
- CORS enabled for cross-origin requests
- Google Gemini AI integration
- File upload support

## Production Deployment

### Create docker-compose.yml on server

Create `docker-compose.yml` in `/opt/containers/sketchmind/` directory:

```yaml
# docker-compose up

version: '3'
services:
  sketchmind:
    container_name: sketchmind
    # Docker will pull the image from GitHub Container Registry (GHCR)
    image: 'ghcr.io/eth-peach-lab/sketchmind/sketchmind-server:latest'
    restart: always
    ports: []
    env_file:
      - .env
    # Specifies the network mode created by the ISG group
    network_mode: 'default-isg'
    # External storage should be placed in `/var/lib/peachlab/data`
    volumes:
      - /var/lib/peachlab/data/sketchmind/uploads:/app/backend/uploads
    # VIRTUAL_HOST and VIRTUAL_PORT map your port to the subdomain
    # Let's Encrypt ensures HTTPS for your deployment
    environment:
      VIRTUAL_HOST: 'stage.peachlab-cntr1.inf.ethz.ch'
      VIRTUAL_PORT: '5090'
      LETSENCRYPT_HOST: 'stage.peachlab-cntr1.inf.ethz.ch'
      LETSENCRYPT_EMAIL: 'wangjun@ethz.ch'
    # Watchtower label enables automatic updates after new images are pushed to GHCR
    labels:
      - com.centurylinklabs.watchtower.enable=true
```

### Start Service

```bash
docker-compose up -d
```



<!-- 
## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.
 -->

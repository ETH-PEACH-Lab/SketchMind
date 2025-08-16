### Create docker-compose.yml on server

Create `docker-compose.yml` in `/opt/containers/sketchmind/` directory:

```yaml
# docker-compose up

version: '3'
services:
  sketchmind:
    container_name: sketchmind
    # Docker will pull the image from GitHub Container Registry (GHCR)
    image: 'ghcr.io/eth-peach-lab/sketchmind:latest'
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
      VIRTUAL_PORT: '3000'
      LETSENCRYPT_HOST: 'stage.peachlab-cntr1.inf.ethz.ch'
      LETSENCRYPT_EMAIL: 'yangwu@ethz.ch'
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

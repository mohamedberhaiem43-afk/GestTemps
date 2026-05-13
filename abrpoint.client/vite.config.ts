import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import { env } from 'process';

let httpsConfig: { key: Buffer; cert: Buffer } | undefined = undefined;
const isDockerBuild = env.DOCKER_BUILD === "true";

if (!isDockerBuild) {
    // Only create certificates for local dev
    const baseFolder =
        env.APPDATA !== undefined && env.APPDATA !== ''
            ? `${env.APPDATA}/ASP.NET/https`
            : `${env.HOME}/.aspnet/https`;

    const certificateName = "abrpoint.client";
    const certFilePath = path.join(baseFolder, `${certificateName}.pem`);
    const keyFilePath = path.join(baseFolder, `${certificateName}.key`);

    if (!fs.existsSync(certFilePath) || !fs.existsSync(keyFilePath)) {
        if (0 !== child_process.spawnSync('dotnet', [
            'dev-certs',
            'https',
            '--export-path',
            certFilePath,
            '--format',
            'Pem',
            '--no-password',
        ], { stdio: 'inherit' }).status) {
            throw new Error("Could not create certificate.");
        }
    }

    httpsConfig = {
        key: fs.readFileSync(keyFilePath),
        cert: fs.readFileSync(certFilePath),
    };
}
// Determine API target
const target = env.ASPNETCORE_HTTPS_PORT
    ? `https://localhost:${env.ASPNETCORE_HTTPS_PORT}`
    : env.ASPNETCORE_URLS
        ? env.ASPNETCORE_URLS.split(';')[0]
        : 'https://localhost:7189';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    },
    // PERF — Optimisations du build de prod :
    //   - sourcemap: false explicite (évite la fuite du code source en prod et
    //     allège le bundle livré).
    //   - manualChunks : sépare les grosses libs en chunks dédiés. Le navigateur
    //     met en cache chaque chunk indépendamment, ce qui :
    //       1) réduit le code rejoué à chaque mise en prod (le hash d'app change
    //          mais les chunks MUI/charts/etc. restent stables tant qu'on ne les
    //          met pas à jour) ;
    //       2) parallélise mieux les téléchargements (HTTP/2 multiplexing) ;
    //       3) évite que `jspdf`/`xlsx`/`exceljs` (lourds, usage ponctuel) ne
    //          plombent le chunk principal.
    //   - esbuild.drop : retire console.log/debugger en prod, économise du KB et
    //     supprime des fuites d'info via la console (cf. audit perf front #12).
    build: {
        sourcemap: false,
        chunkSizeWarningLimit: 1500,
        rollupOptions: {
            output: {
                manualChunks: {
                    'mui-core': ['@mui/material', '@emotion/react', '@emotion/styled'],
                    'mui-x': ['@mui/x-data-grid', '@mui/x-date-pickers', '@mui/x-charts'],
                    'pdf': ['jspdf', 'jspdf-autotable'],
                    'spreadsheet': ['xlsx', 'exceljs'],
                    'docx': ['mammoth'],
                    'calendar': [
                        '@fullcalendar/core',
                        '@fullcalendar/daygrid',
                        '@fullcalendar/timegrid',
                        '@fullcalendar/interaction',
                        '@fullcalendar/react',
                    ],
                    'charts': ['recharts'],
                },
            },
        },
    },
    esbuild: {
        drop: env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    },
    server: {
        proxy: {
            '^/weatherforecast': {
                target,
                secure: false
            }
        },
        port: 5173,
        https: httpsConfig // undefined for Docker, object for dev
    }
});

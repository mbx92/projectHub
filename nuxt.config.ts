import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  typescript: {
    strict: true,
  },
  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'OCN Project Hub',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'robots', content: 'noindex' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap' },
      ],
    },
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    sessionSecret: '',
    fileSecret: '',
    appUrl: 'http://localhost:3000',
    storageDir: './storage',
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPass: '',
    smtpFrom: 'OCN Project Hub <no-reply@ocn.dev>',
  },
  nitro: {
    externals: {
      external: ['pdfmake', 'exceljs', 'pg', 'bcryptjs', 'nodemailer'],
    },
  },
})

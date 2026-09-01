const fs = require('fs');
const en = JSON.parse(fs.readFileSync('src/i18n/locales/en.json', 'utf8'));

en.homepage = {
  heroTag: 'The Complete Next.js SaaS Starter Kit',
  heroTitle: 'Ship your next SaaS in days, not months',
  heroSubtitle: 'Everything you need to build a modern SaaS: Authentication, Stripe & Midtrans payments, internationalization, dark mode, dashboard, and more. Ready to deploy.',
  ctaPrimary: 'Start Building',
  ctaSecondary: 'View Dashboard',
  stats: {
    downloads: '10K+',
    downloadsLabel: 'Developers',
    rating: '4.9/5',
    ratingLabel: 'Reviews',
    uptime: '99.9%',
    uptimeLabel: 'Uptime'
  },
  trustedBy: 'TRUSTED BY INNOVATIVE TEAMS WORLDWIDE',
  demo: {
    revenue: 'Total Revenue',
    orders: 'Total Orders',
    customers: 'Total Customers',
    products: 'Total Products'
  },
  demoOrders: {
    title: 'Recent Orders',
    desc: 'You received 24 orders today',
    customer: 'Customer',
    status: 'Status',
    amount: 'Amount',
    statusCompleted: 'Completed',
    statusProcessing: 'Processing',
    statusFailed: 'Failed'
  },
  featuresTitle: 'Everything you need to scale',
  featuresSubtitle: 'Stop building the same boilerplate over and over. Get straight to your business logic with our pre-built modules.',
  auth: {
    title: 'Secure Authentication',
    desc: 'Email/password, social logins, and multi-factor authentication built-in.'
  },
  payments: {
    title: 'Global Payments',
    desc: 'Accept credit cards via Stripe and local payment methods via Midtrans.'
  },
  i18n: {
    title: 'Internationalization',
    desc: 'Built-in support for multiple languages with Next-Intl.'
  },
  components: {
    title: 'UI Components',
    desc: 'Beautiful, accessible components built with Radix UI and Tailwind CSS.'
  },
  theme: {
    title: 'Dark Mode',
    desc: 'First-class dark mode support with next-themes.'
  },
  dashboard: {
    title: 'Admin Dashboard',
    desc: 'Comprehensive admin dashboard with charts, tables, and metrics.'
  },
  security: {
    title: 'Enterprise Security',
    desc: 'Role-based access control, session management, and API route protection.'
  },
  performance: {
    title: 'High Performance',
    desc: 'Optimized for Core Web Vitals with Next.js App Router and React Server Components.'
  },
  socialProof: {
    title: 'Loved by developers',
    subtitle: 'See what our community has to say about Next Dashboard.',
    seeMore: 'Read all reviews'
  }
};

en.featuresPage = {
  heroTag: 'Powerful Capabilities',
  heroTitle: 'Everything you need to build a global product',
  heroSubtitle: 'Stop wasting weeks on boilerplate. Next Dashboard gives you production-ready features for authentication, payments, internationalization, and robust security—out of the box.',
  cta: 'Start Building Now',
  mainFeatures: {
    auth: {
      title: 'Enterprise-grade Authentication',
      desc: 'Complete identity management with support for traditional credentials, magic links, social logins, and mandatory 2FA. Built on NextAuth.js for maximum security and flexibility.'
    },
    payments: {
      title: 'Global Payment Processing',
      desc: 'Process subscriptions and one-off payments worldwide. Integrated with Stripe for international cards and Midtrans for Southeast Asian local payment methods (GoPay, QRIS, Virtual Accounts).'
    },
    i18n: {
      title: 'First-class Internationalization',
      desc: 'Ship to global markets instantly. Fully localized routing, date/time formatting, and dictionary management powered by next-intl. Support for RTL languages and deep SEO optimization.'
    },
    dashboard: {
      title: 'Beautiful Admin Dashboards',
      desc: 'Pre-built, responsive admin interfaces with customizable data tables, interactive charts, metric cards, and advanced filtering. Ready for your business logic.'
    }
  },
  grid: {
    title: 'More powerful features',
    subtitle: "We've thought of everything so you don't have to.",
    items: [
      {
        title: 'Dark Mode Support',
        desc: 'Flawless dark mode out of the box with system-preference detection.'
      },
      {
        title: 'Role-Based Access',
        desc: 'Fine-grained permissions for users, admins, and custom roles.'
      },
      {
        title: 'API Routes',
        desc: 'Secure, rate-limited API endpoints ready for your mobile apps.'
      },
      {
        title: 'Email Templates',
        desc: 'Beautiful, responsive transactional emails built with React Email.'
      },
      {
        title: 'SEO Optimized',
        desc: 'Dynamic sitemaps, robots.txt, and optimized meta tags.'
      },
      {
        title: 'Type Safe',
        desc: 'End-to-end type safety with TypeScript, Prisma, and Zod.'
      }
    ]
  },
  ctaTitle: 'Ready to ship faster?',
  ctaDesc: 'Join thousands of developers building the next generation of web applications.',
  ctaButton: 'Get Started Today'
};

en.integrationsPage = {
  heroTag: 'Seamless Connections',
  heroTitle: 'Connect with your favorite tools',
  heroSubtitle: "Next Dashboard comes pre-configured with the industry's best tools and platforms. Extend your application's capabilities with zero configuration.",
  cta: 'Explore Documentation',
  categoriesTitle: 'Browse by category',
  categoriesSubtitle: 'Find the perfect integration for your specific needs.',
  allIntegrations: 'All Integrations',
  popularTag: 'Popular',
  ctaTitle: 'Build your own integration',
  ctaDesc: 'Need something specific? Use our robust API to build custom connections to any platform.',
  ctaButton: 'View API Docs'
};

en.pricingPage = {
  heroTag: 'Simple Pricing',
  heroTitle: 'Pricing that scales with you',
  heroSubtitle: 'Start for free, upgrade when you need to. No hidden fees or surprise charges.',
  monthly: 'Monthly',
  yearly: 'Yearly',
  yearlyDiscount: 'Save 20%',
  featuresIncluded: 'Everything included:',
  mostPopular: 'Most Popular',
  getStarted: 'Get Started',
  contactSales: 'Contact Sales',
  faqTitle: 'Frequently Asked Questions',
  faqSubtitle: 'Everything you need to know about our pricing and billing.',
  ctaTitle: 'Ready to start building?',
  ctaDesc: 'Join thousands of developers shipping faster with Next Dashboard.',
  ctaButton: 'Start your free trial'
};

en.changelogPage.entries = [
  {
    version: '2.5.0',
    date: 'August 15, 2026',
    tag: 'Latest Release',
    items: [
      { type: 'feature', text: 'Added comprehensive multi-language support (English & Indonesian).' },
      { type: 'feature', text: 'Integrated Midtrans payment gateway alongside Stripe.' },
      { type: 'improvement', text: 'Refactored marketing pages to use standard bento-box layouts.' },
      { type: 'fix', text: 'Resolved hydration mismatch on the language toggle component.' }
    ]
  },
  {
    version: '2.4.1',
    date: 'July 28, 2026',
    tag: 'Improvement',
    items: [
      { type: 'improvement', text: 'Upgraded to Next.js 15 RC and React 19.' },
      { type: 'improvement', text: 'Improved animation performance across all dashboard charts.' },
      { type: 'fix', text: 'Fixed a race condition in the auth middleware.' }
    ]
  },
  {
    version: '2.3.0',
    date: 'June 10, 2026',
    tag: 'Feature Release',
    items: [
      { type: 'feature', text: 'Introduced the new interactive Analytics Dashboard.' },
      { type: 'feature', text: 'Added customizable Date Range Picker for reports.' },
      { type: 'improvement', text: 'Optimized server-side rendering for data-heavy tables.' }
    ]
  }
];

fs.writeFileSync('src/i18n/locales/en.json', JSON.stringify(en, null, 2));

const id = JSON.parse(fs.readFileSync('src/i18n/locales/id.json', 'utf8'));

id.homepage = {
  heroTag: 'Starter Kit SaaS Next.js Terlengkap',
  heroTitle: 'Rilis SaaS Anda dalam hitungan hari, bukan bulan',
  heroSubtitle: 'Semua yang Anda butuhkan untuk membangun SaaS modern: Autentikasi, pembayaran Stripe & Midtrans, multi-bahasa, mode gelap, dasbor, dan banyak lagi. Siap untuk digunakan.',
  ctaPrimary: 'Mulai Membangun',
  ctaSecondary: 'Lihat Dasbor',
  stats: {
    downloads: '10R+',
    downloadsLabel: 'Pengembang',
    rating: '4.9/5',
    ratingLabel: 'Ulasan',
    uptime: '99.9%',
    uptimeLabel: 'Waktu Aktif'
  },
  trustedBy: 'DIPERCAYA OLEH TIM INOVATIF DI SELURUH DUNIA',
  demo: {
    revenue: 'Total Pendapatan',
    orders: 'Total Pesanan',
    customers: 'Total Pelanggan',
    products: 'Total Produk'
  },
  demoOrders: {
    title: 'Pesanan Terbaru',
    desc: 'Anda menerima 24 pesanan hari ini',
    customer: 'Pelanggan',
    status: 'Status',
    amount: 'Jumlah',
    statusCompleted: 'Selesai',
    statusProcessing: 'Diproses',
    statusFailed: 'Gagal'
  },
  featuresTitle: 'Semua yang Anda butuhkan untuk berkembang',
  featuresSubtitle: 'Berhenti membangun kode dasar yang sama berulang kali. Langsung fokus ke logika bisnis Anda dengan modul bawaan kami.',
  auth: {
    title: 'Autentikasi Aman',
    desc: 'Email/password, login sosial, dan autentikasi multi-faktor terpasang.'
  },
  payments: {
    title: 'Pembayaran Global',
    desc: 'Terima kartu kredit via Stripe dan metode pembayaran lokal via Midtrans.'
  },
  i18n: {
    title: 'Multi-bahasa',
    desc: 'Dukungan bawaan untuk berbagai bahasa dengan Next-Intl.'
  },
  components: {
    title: 'Komponen UI',
    desc: 'Komponen yang indah dan dapat diakses, dibangun dengan Radix UI dan Tailwind CSS.'
  },
  theme: {
    title: 'Mode Gelap',
    desc: 'Dukungan mode gelap kelas satu dengan next-themes.'
  },
  dashboard: {
    title: 'Dasbor Admin',
    desc: 'Dasbor admin komprehensif dengan grafik, tabel, dan metrik.'
  },
  security: {
    title: 'Keamanan Perusahaan',
    desc: 'Kontrol akses berbasis peran, manajemen sesi, dan perlindungan rute API.'
  },
  performance: {
    title: 'Kinerja Tinggi',
    desc: 'Dioptimalkan untuk Core Web Vitals dengan Next.js App Router dan React Server Components.'
  },
  socialProof: {
    title: 'Disukai oleh pengembang',
    subtitle: 'Lihat apa yang komunitas katakan tentang Next Dashboard.',
    seeMore: 'Baca semua ulasan'
  }
};

id.featuresPage = {
  heroTag: 'Kemampuan Canggih',
  heroTitle: 'Semua yang Anda butuhkan untuk produk global',
  heroSubtitle: 'Berhenti membuang waktu berminggu-minggu untuk kode dasar. Next Dashboard memberi Anda fitur siap produksi untuk autentikasi, pembayaran, multi-bahasa, dan keamanan tinggi.',
  cta: 'Mulai Membangun Sekarang',
  mainFeatures: {
    auth: {
      title: 'Autentikasi Tingkat Perusahaan',
      desc: 'Manajemen identitas lengkap dengan dukungan kredensial, tautan ajaib, login sosial, dan 2FA. Dibangun di atas NextAuth.js.'
    },
    payments: {
      title: 'Pemrosesan Pembayaran Global',
      desc: 'Proses langganan dan pembayaran sekali jalan di seluruh dunia dengan Stripe dan Midtrans.'
    },
    i18n: {
      title: 'Multi-bahasa Kelas Satu',
      desc: 'Rilis ke pasar global secara instan. Perutean lokal, format tanggal/waktu, dan manajemen kamus dengan next-intl.'
    },
    dashboard: {
      title: 'Dasbor Admin yang Indah',
      desc: 'Antarmuka admin bawaan dengan tabel data, grafik interaktif, dan pemfilteran tingkat lanjut.'
    }
  },
  grid: {
    title: 'Fitur canggih lainnya',
    subtitle: "Kami telah memikirkan semuanya agar Anda tidak perlu repot.",
    items: [
      {
        title: 'Dukungan Mode Gelap',
        desc: 'Mode gelap sempurna dengan deteksi preferensi sistem.'
      },
      {
        title: 'Akses Berbasis Peran',
        desc: 'Izin terperinci untuk pengguna, admin, dan peran kustom.'
      },
      {
        title: 'Rute API',
        desc: 'Titik akhir API yang aman dan terbatas siap untuk aplikasi seluler Anda.'
      },
      {
        title: 'Templat Email',
        desc: 'Email transaksional yang indah dibangun dengan React Email.'
      },
      {
        title: 'SEO Dioptimalkan',
        desc: 'Peta situs dinamis, robots.txt, dan tag meta yang dioptimalkan.'
      },
      {
        title: 'Aman dengan Tipe Data',
        desc: 'Keamanan tipe data penuh dengan TypeScript, Prisma, dan Zod.'
      }
    ]
  },
  ctaTitle: 'Siap untuk merilis lebih cepat?',
  ctaDesc: 'Bergabunglah dengan ribuan pengembang yang membangun aplikasi web generasi berikutnya.',
  ctaButton: 'Mulai Hari Ini'
};

id.integrationsPage = {
  heroTag: 'Koneksi Mulus',
  heroTitle: 'Terhubung dengan alat favorit Anda',
  heroSubtitle: "Next Dashboard hadir dengan alat dan platform terbaik di industri. Perluas kemampuan aplikasi Anda tanpa konfigurasi.",
  cta: 'Jelajahi Dokumentasi',
  categoriesTitle: 'Telusuri berdasarkan kategori',
  categoriesSubtitle: 'Temukan integrasi yang sempurna untuk kebutuhan spesifik Anda.',
  allIntegrations: 'Semua Integrasi',
  popularTag: 'Populer',
  ctaTitle: 'Bangun integrasi Anda sendiri',
  ctaDesc: 'Butuh sesuatu yang spesifik? Gunakan API kami yang kuat untuk membangun koneksi kustom ke platform apa pun.',
  ctaButton: 'Lihat Dokumentasi API'
};

id.pricingPage = {
  heroTag: 'Harga Sederhana',
  heroTitle: 'Harga yang berkembang bersama Anda',
  heroSubtitle: 'Mulai gratis, tingkatkan saat Anda butuh. Tidak ada biaya tersembunyi.',
  monthly: 'Bulanan',
  yearly: 'Tahunan',
  yearlyDiscount: 'Hemat 20%',
  featuresIncluded: 'Semua termasuk:',
  mostPopular: 'Paling Populer',
  getStarted: 'Mulai',
  contactSales: 'Hubungi Sales',
  faqTitle: 'Pertanyaan yang Sering Diajukan',
  faqSubtitle: 'Segala hal yang perlu Anda ketahui tentang harga dan penagihan kami.',
  ctaTitle: 'Siap untuk mulai membangun?',
  ctaDesc: 'Bergabunglah dengan ribuan pengembang yang merilis lebih cepat dengan Next Dashboard.',
  ctaButton: 'Mulai uji coba gratis Anda'
};

id.changelogPage.entries = [
  {
    version: '2.5.0',
    date: '15 Agustus 2026',
    tag: 'Rilis Terbaru',
    items: [
      { type: 'feature', text: 'Menambahkan dukungan multi-bahasa komprehensif (Inggris & Indonesia).' },
      { type: 'feature', text: 'Mengintegrasikan gerbang pembayaran Midtrans bersama Stripe.' },
      { type: 'improvement', text: 'Memfaktorkan ulang halaman pemasaran untuk menggunakan tata letak bento-box.' },
      { type: 'fix', text: 'Memperbaiki ketidaksesuaian hidrasi pada komponen pemilih bahasa.' }
    ]
  },
  {
    version: '2.4.1',
    date: '28 Juli 2026',
    tag: 'Peningkatan',
    items: [
      { type: 'improvement', text: 'Pembaruan ke Next.js 15 RC dan React 19.' },
      { type: 'improvement', text: 'Meningkatkan kinerja animasi di seluruh grafik dasbor.' },
      { type: 'fix', text: 'Memperbaiki kondisi balapan dalam middleware autentikasi.' }
    ]
  },
  {
    version: '2.3.0',
    date: '10 Juni 2026',
    tag: 'Rilis Fitur',
    items: [
      { type: 'feature', text: 'Memperkenalkan Dasbor Analitik interaktif baru.' },
      { type: 'feature', text: 'Menambahkan Pemilih Rentang Tanggal kustom untuk laporan.' },
      { type: 'improvement', text: 'Mengoptimalkan rendering sisi server untuk tabel dengan data berat.' }
    ]
  }
];

fs.writeFileSync('src/i18n/locales/id.json', JSON.stringify(id, null, 2));
console.log('Translations updated successfully.');

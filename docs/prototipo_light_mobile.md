<!DOCTYPE html>

<html class="light" lang="es"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&amp;family=JetBrains+Mono:wght@400;700&amp;family=Space+Grotesk:wght@400;500&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script id="tailwind-config">
      tailwind.config = {
        darkMode: "class",
        theme: {
          extend: {
            colors: {
              "on-primary-container": "#ffffff",
              "surface-tint": "#1a1c1c",
              "tertiary-fixed-dim": "#10B981",
              "on-tertiary": "#ffffff",
              "on-surface": "#111111",
              "secondary": "#464747",
              "background": "#FAFAFA",
              "on-surface-variant": "#474747",
              "on-secondary": "#ffffff",
              "surface-container-low": "#f3f4f6",
              "secondary-fixed": "#464747",
              "secondary-fixed-dim": "#3b3b3c",
              "primary-fixed-dim": "#d4d4d4",
              "on-error": "#ffffff",
              "on-error-container": "#410002",
              "on-secondary-container": "#1b1c1c",
              "surface-variant": "#e1e2e1",
              "primary-fixed": "#1a1c1c",
              "tertiary": "#10B981",
              "on-tertiary-container": "#ffffff",
              "inverse-surface": "#303030",
              "surface-dim": "#dedada",
              "on-surface-variant": "#474747",
              "on-secondary-fixed": "#ffffff",
              "surface-bright": "#f9f9f9",
              "secondary-container": "#e3e2e2",
              "on-background": "#111111",
              "surface-container-lowest": "#ffffff",
              "tertiary-container": "#10B981",
              "inverse-primary": "#c6c6c7",
              "outline": "#777777",
              "on-tertiary-fixed": "#000000",
              "surface-container": "#f3f4f6",
              "surface": "#FAFAFA",
              "error": "#ba1a1a",
              "error-container": "#ffdad6",
              "surface-container-high": "#e9e9e9",
              "on-tertiary-fixed-variant": "#10B981",
              "surface-container-highest": "#e2e2e2",
              "on-primary-fixed-variant": "#303030",
              "inverse-on-surface": "#f2f0f0",
              "tertiary-fixed": "#10B981",
              "on-secondary-fixed-variant": "#e3e2e2",
              "primary": "#111111",
              "on-primary": "#ffffff",
              "primary-container": "#2a2a2a",
              "outline-variant": "#E5E7EB",
              "on-primary-fixed": "#000000"
            },
            fontFamily: {
              "headline": ["Inter"],
              "body": ["Inter"],
              "label": ["Space Grotesk"],
              "mono": ["JetBrains Mono"]
            },
            borderRadius: {"DEFAULT": "0px", "lg": "0px", "xl": "0px", "full": "9999px"},
          },
        },
      }
    </script>
<style>
      .material-symbols-outlined {
        font-variation-settings: 'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 24;
      }
      .ghost-border {
        outline: 1px solid #E5E7EB;
      }
      body {
        background-color: #FAFAFA;
        color: #111111;
        font-family: 'Inter', sans-serif;
      }
      ::-webkit-scrollbar {
        width: 4px;
      }
      ::-webkit-scrollbar-track {
        background: #FAFAFA;
      }
      ::-webkit-scrollbar-thumb {
        background: #E5E7EB;
      }
    </style>
<style>
    body {
      min-height: max(884px, 100dvh);
    }
  </style>
</head>
<body class="min-h-screen">
<!-- TopAppBar -->
<header class="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 h-16 bg-[#FAFAFA] border-b border-outline-variant/50">
<div class="flex items-center gap-3">
<span class="material-symbols-outlined text-[#111111]">terminal</span>
<span class="text-xl font-bold tracking-tighter text-[#111111]">BuscaEmpleos</span>
</div>
<div class="h-8 w-8 bg-surface-container rounded-full overflow-hidden border border-outline-variant">
<img alt="User Profile Avatar" data-alt="close-up portrait of a professional minimalist avatar on a dark textured background with dramatic lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCRRifT-uzKsg05-cLNwKcCBqMwjjPNPEBhsjmzy1jFrDc9Qux1H3lCPpPckUAqlXogHaBZuqlb9T_K_4CBn0h8x8hbOPE6dl45pSa2Ok70nbvozQyEFmtdHe9oplIxW7Mz6uih1Z7ktOxhczL5n-TloCvNQtByDU52Elu5kdVJz5A0BDeShqq7Q9BWg0gDlxeNsKVlXoQ4-78ieJFtpad8LMC2y5-Xru8qIWQciXePEUoKTau5YB7tlxiKbcoYIAF5nni2oXE8-xx8"/>
</div>
</header>
<main class="pt-24 pb-12 px-6 max-w-lg mx-auto">
<!-- Metric Header -->
<section class="mb-12">
<div class="grid grid-cols-2 gap-4">
<div class="p-6 bg-surface-container-lowest ghost-border">
<div class="font-mono text-[10px] tracking-widest text-on-surface-variant mb-2">PENDIENTES</div>
<div class="text-4xl font-extrabold tracking-tighter text-primary">45</div>
</div>
<div class="p-6 bg-surface-container-lowest ghost-border">
<div class="font-mono text-[10px] tracking-widest text-on-surface-variant mb-2">APROBADAS</div>
<div class="text-4xl font-extrabold tracking-tighter text-primary">12</div>
</div>
</div>
</section>
<!-- Section Title -->
<div class="flex items-center justify-between mb-8">
<h2 class="font-mono text-[10px] tracking-widest text-on-surface-variant uppercase">Oportunidades Recientes</h2>
<div class="w-12 h-px bg-outline-variant"></div>
</div>
<!-- Job Grid -->
<div class="space-y-12">
<!-- Job Card 1 -->
<article class="relative">
<header class="mb-4">
<h3 class="text-xl font-bold tracking-tight text-primary leading-tight">Senior Frontend Engineer</h3>
<div class="text-sm text-on-surface-variant mt-1">Vercel, Remote</div>
</header>
<div class="bg-surface-container-low p-5 mb-4 ghost-border border-l-2 border-l-primary/10">
<div class="flex items-center gap-2 mb-3">
<span class="font-mono text-[10px] font-bold text-tertiary tracking-wider uppercase">Match: 85%</span>
<div class="flex-1 h-[1px] bg-tertiary/10"></div>
</div>
<p class="font-mono text-xs leading-relaxed text-on-surface-variant">
                        Match with React, Tailwind and UI/UX background. Java skipped.
                    </p>
</div>
<div class="flex items-center justify-between">
<div class="flex gap-4">
<span class="font-mono text-[10px] text-on-surface-variant uppercase tracking-tighter">Hace 2h</span>
<span class="font-mono text-[10px] text-on-surface-variant uppercase tracking-tighter">Remoto</span>
</div>
<div class="flex gap-1">
<button class="w-10 h-10 flex items-center justify-center border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-primary hover:text-on-primary transition-colors duration-50">
<span class="material-symbols-outlined text-lg" data-icon="north_east">north_east</span>
</button>
<button class="w-10 h-10 flex items-center justify-center border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-primary hover:text-on-primary transition-colors duration-50">
<span class="material-symbols-outlined text-lg" data-icon="check">check</span>
</button>
<button class="w-10 h-10 flex items-center justify-center border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-error hover:text-on-error transition-colors duration-50">
<span class="material-symbols-outlined text-lg" data-icon="delete">delete</span>
</button>
</div>
</div>
</article>
<!-- Job Card 2 -->
<article class="relative">
<header class="mb-4">
<h3 class="text-xl font-bold tracking-tight text-primary leading-tight">Product Designer (Design Systems)</h3>
<div class="text-sm text-on-surface-variant mt-1">Stripe, San Francisco</div>
</header>
<div class="bg-surface-container-low p-5 mb-4 ghost-border border-l-2 border-l-primary/10">
<div class="flex items-center gap-2 mb-3">
<span class="font-mono text-[10px] font-bold text-tertiary tracking-wider uppercase">Match: 92%</span>
<div class="flex-1 h-[1px] bg-tertiary/10"></div>
</div>
<p class="font-mono text-xs leading-relaxed text-on-surface-variant">
                        Strong alignment with Material Design &amp; Tailwind CSS. Figma mastery detected.
                    </p>
</div>
<div class="flex items-center justify-between">
<div class="flex gap-4">
<span class="font-mono text-[10px] text-on-surface-variant uppercase tracking-tighter">Hace 5h</span>
<span class="font-mono text-[10px] text-on-surface-variant uppercase tracking-tighter">Híbrido</span>
</div>
<div class="flex gap-1">
<button class="w-10 h-10 flex items-center justify-center border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-primary hover:text-on-primary transition-colors duration-50">
<span class="material-symbols-outlined text-lg" data-icon="north_east">north_east</span>
</button>
<button class="w-10 h-10 flex items-center justify-center border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-primary hover:text-on-primary transition-colors duration-50">
<span class="material-symbols-outlined text-lg" data-icon="check">check</span>
</button>
<button class="w-10 h-10 flex items-center justify-center border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-error hover:text-on-error transition-colors duration-50">
<span class="material-symbols-outlined text-lg" data-icon="delete">delete</span>
</button>
</div>
</div>
</article>
<!-- Job Card 3 -->
<article class="relative">
<header class="mb-4">
<h3 class="text-xl font-bold tracking-tight text-primary leading-tight">Full Stack Developer</h3>
<div class="text-sm text-on-surface-variant mt-1">Linear, Remote</div>
</header>
<div class="bg-surface-container-low p-5 mb-4 ghost-border border-l-2 border-l-primary/10">
<div class="flex items-center gap-2 mb-3">
<span class="font-mono text-[10px] font-bold text-tertiary tracking-wider uppercase">Match: 78%</span>
<div class="flex-1 h-[1px] bg-tertiary/10"></div>
</div>
<p class="font-mono text-xs leading-relaxed text-on-surface-variant">
                        Node.js &amp; TypeScript proficiency high. Next.js App Router experience required.
                    </p>
</div>
<div class="flex items-center justify-between">
<div class="flex gap-4">
<span class="font-mono text-[10px] text-on-surface-variant uppercase tracking-tighter">Hace 1d</span>
<span class="font-mono text-[10px] text-on-surface-variant uppercase tracking-tighter">Remoto</span>
</div>
<div class="flex gap-1">
<button class="w-10 h-10 flex items-center justify-center border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-primary hover:text-on-primary transition-colors duration-50">
<span class="material-symbols-outlined text-lg" data-icon="north_east">north_east</span>
</button>
<button class="w-10 h-10 flex items-center justify-center border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-primary hover:text-on-primary transition-colors duration-50">
<span class="material-symbols-outlined text-lg" data-icon="check">check</span>
</button>
<button class="w-10 h-10 flex items-center justify-center border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-error hover:text-on-error transition-colors duration-50">
<span class="material-symbols-outlined text-lg" data-icon="delete">delete</span>
</button>
</div>
</div>
</article>
<!-- Job Card 4 -->
<article class="relative">
<header class="mb-4">
<h3 class="text-xl font-bold tracking-tight text-primary leading-tight">Staff UI Engineer</h3>
<div class="text-sm text-on-surface-variant mt-1">AirBnB, Remote</div>
</header>
<div class="bg-surface-container-low p-5 mb-4 ghost-border border-l-2 border-l-primary/10">
<div class="flex items-center gap-2 mb-3">
<span class="font-mono text-[10px] font-bold text-tertiary tracking-wider uppercase">Match: 81%</span>
<div class="flex-1 h-[1px] bg-tertiary/10"></div>
</div>
<p class="font-mono text-xs leading-relaxed text-on-surface-variant">
                        High fidelity CSS &amp; Framer Motion detected. Backend Ruby requirements skipped.
                    </p>
</div>
<div class="flex items-center justify-between">
<div class="flex gap-4">
<span class="font-mono text-[10px] text-on-surface-variant uppercase tracking-tighter">Hace 2d</span>
<span class="font-mono text-[10px] text-on-surface-variant uppercase tracking-tighter">Remoto</span>
</div>
<div class="flex gap-1">
<button class="w-10 h-10 flex items-center justify-center border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-primary hover:text-on-primary transition-colors duration-50">
<span class="material-symbols-outlined text-lg" data-icon="north_east">north_east</span>
</button>
<button class="w-10 h-10 flex items-center justify-center border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-primary hover:text-on-primary transition-colors duration-50">
<span class="material-symbols-outlined text-lg" data-icon="check">check</span>
</button>
<button class="w-10 h-10 flex items-center justify-center border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-error hover:text-on-error transition-colors duration-50">
<span class="material-symbols-outlined text-lg" data-icon="delete">delete</span>
</button>
</div>
</div>
</article>
</div>
</main>
<!-- Bottom Navigation (Mobile Only) -->
<nav class="fixed bottom-0 left-0 w-full bg-[#FAFAFA] h-16 flex items-center justify-around px-4 border-t border-outline-variant md:hidden z-50">
<button class="flex flex-col items-center gap-1 text-primary">
<span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">dashboard</span>
<span class="font-mono text-[9px] uppercase tracking-widest">Dash</span>
</button>
<button class="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary transition-colors">
<span class="material-symbols-outlined">explore</span>
<span class="font-mono text-[9px] uppercase tracking-widest">Explore</span>
</button>
<button class="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary transition-colors">
<span class="material-symbols-outlined">history</span>
<span class="font-mono text-[9px] uppercase tracking-widest">Match</span>
</button>
<button class="flex flex-col items-center gap-1 text-on-surface-variant hover:text-primary transition-colors">
<span class="material-symbols-outlined">settings</span>
<span class="font-mono text-[9px] uppercase tracking-widest">Prefs</span>
</button>
</nav>
<!-- Floating Action Button -->
<button class="fixed bottom-24 right-6 w-14 h-14 bg-primary text-on-primary shadow-2xl flex items-center justify-center z-40 border border-primary/20">
<span class="material-symbols-outlined" style="font-variation-settings: 'wght' 400;">add</span>
</button>
</body></html>
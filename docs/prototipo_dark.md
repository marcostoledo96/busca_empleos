<!DOCTYPE html>

<html class="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>AI Job Hunt - Technical Table View</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600&amp;family=JetBrains+Mono:wght@400;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "tertiary-container": "#8b9199",
                        "tertiary": "#dde3eb",
                        "on-primary-fixed": "#ffffff",
                        "on-tertiary-fixed-variant": "#dde3eb",
                        "on-tertiary-fixed": "#ffffff",
                        "surface-container-lowest": "#0e0e0e",
                        "surface-variant": "#353535",
                        "surface-container": "#1f1f1f",
                        "inverse-primary": "#5c5f61",
                        "primary-fixed-dim": "#444749",
                        "inverse-on-surface": "#303030",
                        "on-secondary-fixed-variant": "#313c4f",
                        "surface-container-low": "#1b1b1b",
                        "outline": "#919191",
                        "primary-fixed": "#5c5f61",
                        "surface-dim": "#131313",
                        "on-primary": "#191c1e",
                        "on-background": "#e2e2e2",
                        "on-surface-variant": "#c6c6c6",
                        "secondary": "#bcc7de",
                        "on-surface": "#e2e2e2",
                        "on-secondary-fixed": "#111c2d",
                        "error": "#ffb4ab",
                        "surface-tint": "#c4c7c9",
                        "on-primary-container": "#000000",
                        "secondary-fixed": "#bcc7de",
                        "background": "#131313",
                        "on-secondary": "#111c2d",
                        "surface-container-high": "#2a2a2a",
                        "on-secondary-container": "#d8e3fb",
                        "secondary-container": "#3c475a",
                        "primary-container": "#d2d5d7",
                        "inverse-surface": "#e2e2e2",
                        "on-error": "#690005",
                        "secondary-fixed-dim": "#a0acc2",
                        "surface-container-highest": "#353535",
                        "on-tertiary-container": "#000000",
                        "on-primary-fixed-variant": "#e0e3e5",
                        "surface-bright": "#393939",
                        "outline-variant": "#474747",
                        "on-error-container": "#ffdad6",
                        "tertiary-fixed-dim": "#41474e",
                        "error-container": "#93000a",
                        "tertiary-fixed": "#595f66",
                        "surface": "#131313",
                        "on-tertiary": "#161c22",
                        "primary": "#ffffff"
                    },
                    fontFamily: {
                        "headline": ["Inter"],
                        "body": ["Inter"],
                        "label": ["JetBrains Mono"]
                    },
                    borderRadius: { "DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem" },
                },
            },
        }
    </script>
<style>
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20;
        }
        body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #353535; }
    </style>
</head>
<body class="bg-surface text-on-surface selection:bg-primary-container selection:text-on-primary-container">
<!-- SideNavBar (from JSON) -->
<nav class="fixed left-0 top-0 h-full flex flex-col z-50 h-screen w-64 border-r border-slate-200 dark:border-[#353535] bg-white dark:bg-[#131313]">
<div class="p-8">
<span class="text-lg font-bold tracking-tighter text-slate-950 dark:text-white font-sans">AI Job Hunt</span>
<p class="font-mono text-[10px] uppercase tracking-widest text-slate-400 mt-1">v1.0.4</p>
</div>
<div class="flex-1">
<a class="flex items-center gap-3 px-6 py-3 text-slate-900 dark:text-white bg-slate-100 dark:bg-[#353535] border-r-2 border-slate-900 dark:border-white font-mono text-xs uppercase tracking-widest transition-all duration-150 ease-out" href="#">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
                Dashboard
            </a>
<a class="flex items-center gap-3 px-6 py-3 text-slate-400 dark:text-slate-500 font-mono text-xs uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-[#353535]/50 transition-colors transition-all duration-150 ease-out" href="#">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
                Preferences
            </a>
</div>
<div class="p-6 mt-auto">
<div class="flex items-center gap-3">
<img alt="User profile" class="w-8 h-8 rounded bg-surface-container-high" data-alt="close-up portrait of a professional individual in a minimalist office setting with soft natural lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDWZzsoCT7esDm0y_CFtGDneGPVkLeGPqV3lzF6itAECstRhqeiGeLOhvQsj5UYMmrffpu7yN1ydBFGF2Tw-ZSRhvslqbe2Jp6qb87CHCTWhfQXjasqgESpxjvx4lSAEC_rmhksNipFDuKeuCgXQ2rgZtvnG8k3UUG-v4r_jdietrvUyhl7vBYJZWqN9PuPpLFVrt88zNWd1AVX9DjcAJcxAwZcc3RRZASQdTsLNvhm3qb2yP4F2HxZpSMxOBpAA6zDS7LycxeuUNas"/>
<div class="flex flex-col">
<span class="text-xs font-medium">User profile</span>
<span class="text-[10px] font-mono text-slate-500">PRO PLAN</span>
</div>
</div>
</div>
</nav>
<!-- TopNavBar (from JSON) -->
<nav class="fixed top-0 right-0 left-64 h-16 flex items-center justify-between px-8 z-40 bg-white/90 dark:bg-[#131313]/90 backdrop-blur-xl border-b border-slate-200 dark:border-[#353535]">
<div class="flex items-center gap-8">
<span class="hidden">Metrics</span> <!-- style_brand_logo: hidden -->
<div class="flex gap-6">
<a class="text-slate-400 dark:text-slate-500 font-mono text-[10px] uppercase font-bold tracking-widest hover:text-slate-950 dark:hover:text-white transition-opacity" href="#">Grid</a>
<a class="text-slate-950 dark:text-white border-b-2 border-slate-950 dark:border-white pb-1 font-mono text-[10px] uppercase font-bold tracking-widest" href="#">Table</a>
</div>
</div>
<div class="flex items-center gap-6">
<div class="relative">
<span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-sm" data-icon="search">search</span>
<input class="bg-transparent border-none border-b border-outline-variant/30 focus:ring-0 focus:border-primary text-[10px] font-mono uppercase tracking-widest pl-10 w-64 text-on-surface" placeholder="SEARCH JOBS..." type="text"/>
</div>
<div class="flex gap-4">
<span class="material-symbols-outlined text-slate-400 cursor-pointer hover:text-primary transition-colors" data-icon="notifications">notifications</span>
<span class="material-symbols-outlined text-slate-400 cursor-pointer hover:text-primary transition-colors" data-icon="account_circle">account_circle</span>
</div>
</div>
</nav>
<!-- Main Content -->
<main class="ml-64 pt-24 px-8 pb-12">
<!-- Header Section -->
<header class="mb-12 flex justify-between items-end">
<div>
<h1 class="font-headline font-light text-5xl tracking-tighter text-on-surface">Technical <span class="font-medium">Matrix</span></h1>
<p class="font-mono text-[10px] text-on-surface-variant uppercase tracking-[0.2em] mt-2">Active pipeline: 342 High-probability matches detected</p>
</div>
<div class="flex gap-2">
<button class="px-4 py-2 bg-surface-container-low border border-outline-variant/20 text-[10px] font-mono uppercase tracking-widest hover:bg-surface-container-high transition-colors">Filter</button>
<button class="px-4 py-2 bg-primary text-on-primary text-[10px] font-mono uppercase tracking-widest font-bold">Refresh Intelligence</button>
</div>
</header>
<!-- Technical Table Container -->
<div class="bg-surface-container-low/50 overflow-hidden border border-outline-variant/10">
<table class="w-full text-left border-collapse">
<thead>
<tr class="bg-surface-container-low border-b border-outline-variant/20">
<th class="px-6 py-4 font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Match</th>
<th class="px-6 py-4 font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Job Title</th>
<th class="px-6 py-4 font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Company</th>
<th class="px-6 py-4 font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Location</th>
<th class="px-6 py-4 font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">IA Reasoning</th>
<th class="px-6 py-4 font-label text-[10px] uppercase tracking-widest text-on-surface-variant font-bold text-right">Actions</th>
</tr>
</thead>
<tbody class="divide-y divide-outline-variant/10">
<!-- Row 1 -->
<tr class="hover:bg-surface-container-highest/30 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-secondary">98.4%</td>
<td class="px-6 py-3 text-sm font-medium text-on-surface">Principal Systems Architect</td>
<td class="px-6 py-3 text-sm text-on-surface-variant">Lumina Systems</td>
<td class="px-6 py-3 text-[11px] font-mono text-on-surface-variant/70 uppercase">Remote / SF</td>
<td class="px-6 py-3 text-xs font-mono text-on-surface-variant/80 max-w-xs truncate">Strong alignment with Rust/WASM expertise; fits 4/5 core stacks.</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<!-- Row 2 -->
<tr class="hover:bg-surface-container-highest/30 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-secondary">96.1%</td>
<td class="px-6 py-3 text-sm font-medium text-on-surface">Senior Machine Learning Engineer</td>
<td class="px-6 py-3 text-sm text-on-surface-variant">NeuralPath AI</td>
<td class="px-6 py-3 text-[11px] font-mono text-on-surface-variant/70 uppercase">Palo Alto, CA</td>
<td class="px-6 py-3 text-xs font-mono text-on-surface-variant/80 max-w-xs truncate">Previous experience with LLM orchestration layers is decisive.</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<!-- Row 3 -->
<tr class="hover:bg-surface-container-highest/30 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-secondary">94.8%</td>
<td class="px-6 py-3 text-sm font-medium text-on-surface">Staff Frontend Engineer</td>
<td class="px-6 py-3 text-sm text-on-surface-variant">Vercel Inc.</td>
<td class="px-6 py-3 text-[11px] font-mono text-on-surface-variant/70 uppercase">Global Remote</td>
<td class="px-6 py-3 text-xs font-mono text-on-surface-variant/80 max-w-xs truncate">Next.js contribution history matches high-priority requirements.</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<!-- More rows for high density look -->
<tr class="hover:bg-surface-container-highest/30 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-secondary">92.2%</td>
<td class="px-6 py-3 text-sm font-medium text-on-surface">Director of Engineering</td>
<td class="px-6 py-3 text-sm text-on-surface-variant">CloudFlare</td>
<td class="px-6 py-3 text-[11px] font-mono text-on-surface-variant/70 uppercase">Austin, TX</td>
<td class="px-6 py-3 text-xs font-mono text-on-surface-variant/80 max-w-xs truncate">Scalability lead experience aligns with 3-year roadmap goals.</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<!-- Generic Repeated Rows to simulate 15-20 jobs -->
<tr class="hover:bg-surface-container-highest/30 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-on-surface-variant/50">89.5%</td>
<td class="px-6 py-3 text-sm font-medium text-on-surface">Platform Engineer</td>
<td class="px-6 py-3 text-sm text-on-surface-variant">Kubecorp</td>
<td class="px-6 py-3 text-[11px] font-mono text-on-surface-variant/70 uppercase">Seattle, WA</td>
<td class="px-6 py-3 text-xs font-mono text-on-surface-variant/80 max-w-xs truncate">Matches infrastructure as code keywords (Terraform/K8s).</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<tr class="hover:bg-surface-container-highest/30 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-on-surface-variant/50">88.1%</td>
<td class="px-6 py-3 text-sm font-medium text-on-surface">Data Scientist</td>
<td class="px-6 py-3 text-sm text-on-surface-variant">GraphBase</td>
<td class="px-6 py-3 text-[11px] font-mono text-on-surface-variant/70 uppercase">New York, NY</td>
<td class="px-6 py-3 text-xs font-mono text-on-surface-variant/80 max-w-xs truncate">Strong match for vector database background.</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<tr class="hover:bg-surface-container-highest/30 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-on-surface-variant/50">87.4%</td>
<td class="px-6 py-3 text-sm font-medium text-on-surface">Fullstack Developer</td>
<td class="px-6 py-3 text-sm text-on-surface-variant">OpenStack</td>
<td class="px-6 py-3 text-[11px] font-mono text-on-surface-variant/70 uppercase">Remote</td>
<td class="px-6 py-3 text-xs font-mono text-on-surface-variant/80 max-w-xs truncate">Required: Node.js/Postgres. Match: 100%. Soft skills: Neutral.</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<tr class="hover:bg-surface-container-highest/30 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-on-surface-variant/50">86.9%</td>
<td class="px-6 py-3 text-sm font-medium text-on-surface">Security Engineer</td>
<td class="px-6 py-3 text-sm text-on-surface-variant">SafePass</td>
<td class="px-6 py-3 text-[11px] font-mono text-on-surface-variant/70 uppercase">London, UK</td>
<td class="px-6 py-3 text-xs font-mono text-on-surface-variant/80 max-w-xs truncate">Identity management focus aligns with past projects.</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<!-- Row repetition for density -->
<tr class="hover:bg-surface-container-highest/30 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-on-surface-variant/50">85.0%</td>
<td class="px-6 py-3 text-sm font-medium text-on-surface">Backend Specialist</td>
<td class="px-6 py-3 text-sm text-on-surface-variant">StreamFlow</td>
<td class="px-6 py-3 text-[11px] font-mono text-on-surface-variant/70 uppercase">Berlin, DE</td>
<td class="px-6 py-3 text-xs font-mono text-on-surface-variant/80 max-w-xs truncate">Golang/Kafka stack matches exactly with recent work.</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<tr class="hover:bg-surface-container-highest/30 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-on-surface-variant/50">84.2%</td>
<td class="px-6 py-3 text-sm font-medium text-on-surface">DevOps Architect</td>
<td class="px-6 py-3 text-sm text-on-surface-variant">ScaleUp</td>
<td class="px-6 py-3 text-[11px] font-mono text-on-surface-variant/70 uppercase">Remote</td>
<td class="px-6 py-3 text-xs font-mono text-on-surface-variant/80 max-w-xs truncate">AWS/GCP migration experience highly valued here.</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<tr class="hover:bg-surface-container-highest/30 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-on-surface-variant/50">82.1%</td>
<td class="px-6 py-3 text-sm font-medium text-on-surface">UI/UX Developer</td>
<td class="px-6 py-3 text-sm text-on-surface-variant">DesignDoc</td>
<td class="px-6 py-3 text-[11px] font-mono text-on-surface-variant/70 uppercase">Brooklyn, NY</td>
<td class="px-6 py-3 text-xs font-mono text-on-surface-variant/80 max-w-xs truncate">Strong design systems focus. Tailored for specialists.</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<tr class="hover:bg-surface-container-highest/30 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-on-surface-variant/50">81.5%</td>
<td class="px-6 py-3 text-sm font-medium text-on-surface">Product Manager (Tech)</td>
<td class="px-6 py-3 text-sm text-on-surface-variant">FinEdge</td>
<td class="px-6 py-3 text-[11px] font-mono text-on-surface-variant/70 uppercase">Chicago, IL</td>
<td class="px-6 py-3 text-xs font-mono text-on-surface-variant/80 max-w-xs truncate">Technical PM requirements met by CS background.</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<tr class="hover:bg-surface-container-highest/30 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-on-surface-variant/50">80.2%</td>
<td class="px-6 py-3 text-sm font-medium text-on-surface">Data Engineer</td>
<td class="px-6 py-3 text-sm text-on-surface-variant">WarehouseIO</td>
<td class="px-6 py-3 text-[11px] font-mono text-on-surface-variant/70 uppercase">Remote</td>
<td class="px-6 py-3 text-xs font-mono text-on-surface-variant/80 max-w-xs truncate">ETL pipeline experience is the primary driver here.</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-primary" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
</tbody>
</table>
</div>
<!-- Pagination (Same as Grid View, per requirements) -->
<footer class="mt-12 flex justify-between items-center">
<div class="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
                Showing 13 of 342 records
            </div>
<div class="flex gap-1">
<button class="w-8 h-8 flex items-center justify-center border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
<span class="material-symbols-outlined text-sm" data-icon="chevron_left">chevron_left</span>
</button>
<button class="w-8 h-8 flex items-center justify-center bg-primary text-on-primary font-mono text-[10px]">01</button>
<button class="w-8 h-8 flex items-center justify-center border border-outline-variant/30 text-on-surface hover:bg-surface-container-high font-mono text-[10px]">02</button>
<button class="w-8 h-8 flex items-center justify-center border border-outline-variant/30 text-on-surface hover:bg-surface-container-high font-mono text-[10px]">03</button>
<button class="w-8 h-8 flex items-center justify-center border border-outline-variant/30 text-on-surface hover:bg-surface-container-high font-mono text-[10px]">...</button>
<button class="w-8 h-8 flex items-center justify-center border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors">
<span class="material-symbols-outlined text-sm" data-icon="chevron_right">chevron_right</span>
</button>
</div>
<div class="flex gap-4">
<span class="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest cursor-pointer hover:text-primary">Download CSV</span>
<span class="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest cursor-pointer hover:text-primary">API Endpoint</span>
</div>
</footer>
</main>
<!-- Contextual Terminal Overlay (Ollama-inspired touch) -->
<div class="fixed bottom-6 right-6 p-4 bg-surface-container-high border border-outline-variant/30 shadow-xl max-w-sm backdrop-blur-xl z-[60]">
<div class="flex items-center gap-2 mb-2">
<span class="w-2 h-2 bg-secondary rounded-full animate-pulse"></span>
<span class="font-mono text-[10px] uppercase tracking-widest text-secondary font-bold">AI Processor Active</span>
</div>
<p class="font-mono text-[11px] text-on-surface-variant leading-relaxed">
            Scanning job boards for "Senior Systems Architect" matches. Detected 4 new listings in last 120s. Correlation confidence: 0.98.
        </p>
</div>
</body></html>
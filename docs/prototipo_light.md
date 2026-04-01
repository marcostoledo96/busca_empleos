<!DOCTYPE html>

<html class="light" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>AI Job Hunt - Technical Table View</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600&amp;family=JetBrains+Mono:wght@400;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "tertiary-container": "#f1f5f9",
                        "tertiary": "#64748b",
                        "on-primary-fixed": "#000000",
                        "on-tertiary-fixed-variant": "#475569",
                        "on-tertiary-fixed": "#000000",
                        "surface-container-lowest": "#ffffff",
                        "surface-variant": "#f8fafc",
                        "surface-container": "#f1f5f9",
                        "inverse-primary": "#000000",
                        "primary-fixed-dim": "#e2e8f0",
                        "inverse-on-surface": "#ffffff",
                        "on-secondary-fixed-variant": "#334155",
                        "surface-container-low": "#f8fafc",
                        "outline": "#cbd5e1",
                        "primary-fixed": "#0f172a",
                        "surface-dim": "#f1f5f9",
                        "on-primary": "#ffffff",
                        "on-background": "#0f172a",
                        "on-surface-variant": "#64748b",
                        "secondary": "#334155",
                        "on-surface": "#0f172a",
                        "on-secondary-fixed": "#0f172a",
                        "error": "#b91c1c",
                        "surface-tint": "#0f172a",
                        "on-primary-container": "#ffffff",
                        "secondary-fixed": "#f1f5f9",
                        "background": "#ffffff",
                        "on-secondary": "#ffffff",
                        "surface-container-high": "#e2e8f0",
                        "on-secondary-container": "#0f172a",
                        "secondary-container": "#f1f5f9",
                        "primary-container": "#0f172a",
                        "inverse-surface": "#0f172a",
                        "on-error": "#ffffff",
                        "secondary-fixed-dim": "#cbd5e1",
                        "surface-container-highest": "#cbd5e1",
                        "on-tertiary-container": "#ffffff",
                        "on-primary-fixed-variant": "#334155",
                        "surface-bright": "#ffffff",
                        "outline-variant": "#e2e8f0",
                        "on-error-container": "#ffffff",
                        "tertiary-fixed-dim": "#94a3b8",
                        "error-container": "#fecaca",
                        "tertiary-fixed": "#64748b",
                        "surface": "#ffffff",
                        "on-tertiary": "#ffffff",
                        "primary": "#000000"
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
        ::-webkit-scrollbar-thumb { background: #e2e8f0; }
    </style>
</head>
<body class="bg-white text-on-surface selection:bg-slate-900 selection:text-white">
<!-- SideNavBar -->
<nav class="fixed left-0 top-0 h-full flex flex-col z-50 w-64 border-r border-slate-200 bg-white">
<div class="p-8">
<span class="text-lg font-bold tracking-tighter text-slate-950 font-sans">AI Job Hunt</span>
<p class="font-mono text-[10px] uppercase tracking-widest text-slate-400 mt-1">v1.0.4</p>
</div>
<div class="flex-1">
<a class="flex items-center gap-3 px-6 py-3 text-slate-950 bg-slate-100 border-r-2 border-slate-950 font-mono text-xs uppercase tracking-widest transition-all duration-150 ease-out" href="#">
<span class="material-symbols-outlined" data-icon="dashboard">dashboard</span>
            Dashboard
        </a>
<a class="flex items-center gap-3 px-6 py-3 text-slate-400 font-mono text-xs uppercase tracking-widest hover:bg-slate-50 transition-all duration-150 ease-out" href="#">
<span class="material-symbols-outlined" data-icon="settings">settings</span>
            Preferences
        </a>
</div>
<div class="p-6 mt-auto">
<div class="flex items-center gap-3">
<img alt="User profile" class="w-8 h-8 rounded bg-slate-100" data-alt="close-up portrait of a professional individual in a minimalist office setting with soft natural lighting" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDWZzsoCT7esDm0y_CFtGDneGPVkLeGPqV3lzF6itAECstRhqeiGeLOhvQsj5UYMmrffpu7yN1ydBFGF2Tw-ZSRhvslqbe2Jp6qb87CHCTWhfQXjasqgESpxjvx4lSAEC_rmhksNipFDuKeuCgXQ2rgZtvnG8k3UUG-v4r_jdietrvUyhl7vBYJZWqN9PuPpLFVrt88zNWd1AVX9DjcAJcxAwZcc3RRZASQdTsLNvhm3qb2yP4F2HxZpSMxOBpAA6zDS7LycxeuUNas"/>
<div class="flex flex-col">
<span class="text-xs font-medium text-slate-900">User profile</span>
<span class="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">PRO PLAN</span>
</div>
</div>
</div>
</nav>
<!-- TopNavBar -->
<nav class="fixed top-0 right-0 left-64 h-16 flex items-center justify-between px-8 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200">
<div class="flex items-center gap-8">
<span class="hidden">Metrics</span>
<div class="flex gap-6">
<a class="text-slate-400 font-mono text-[10px] uppercase font-bold tracking-widest hover:text-slate-950 transition-opacity" href="#">Grid</a>
<a class="text-slate-950 border-b-2 border-slate-950 pb-1 font-mono text-[10px] uppercase font-bold tracking-widest" href="#">Table</a>
</div>
</div>
<div class="flex items-center gap-6">
<div class="relative">
<span class="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-sm" data-icon="search">search</span>
<input class="bg-transparent border-none border-b border-slate-200 focus:ring-0 focus:border-slate-950 text-[10px] font-mono uppercase tracking-widest pl-10 w-64 text-on-surface placeholder:text-slate-300" placeholder="SEARCH JOBS..." type="text"/>
</div>
<div class="flex gap-4">
<span class="material-symbols-outlined text-slate-400 cursor-pointer hover:text-slate-950 transition-colors" data-icon="notifications">notifications</span>
<span class="material-symbols-outlined text-slate-400 cursor-pointer hover:text-slate-950 transition-colors" data-icon="account_circle">account_circle</span>
</div>
</div>
</nav>
<!-- Main Content -->
<main class="ml-64 pt-24 px-8 pb-12">
<!-- Header Section -->
<header class="mb-12 flex justify-between items-end">
<div>
<h1 class="font-headline font-light text-5xl tracking-tighter text-slate-950">Technical <span class="font-medium">Matrix</span></h1>
<p class="font-mono text-[10px] text-slate-500 uppercase tracking-[0.2em] mt-2">Active pipeline: 342 High-probability matches detected</p>
</div>
<div class="flex gap-2">
<button class="px-4 py-2 bg-white border border-slate-200 text-[10px] font-mono uppercase tracking-widest hover:bg-slate-50 transition-colors text-slate-950">Filter</button>
<button class="px-4 py-2 bg-slate-950 text-white text-[10px] font-mono uppercase tracking-widest font-bold hover:bg-slate-800 transition-colors">Refresh Intelligence</button>
</div>
</header>
<!-- Technical Table Container -->
<div class="bg-white overflow-hidden border border-slate-200">
<table class="w-full text-left border-collapse">
<thead>
<tr class="bg-slate-50 border-b border-slate-200">
<th class="px-6 py-4 font-label text-[10px] uppercase tracking-widest text-slate-500 font-bold">Match</th>
<th class="px-6 py-4 font-label text-[10px] uppercase tracking-widest text-slate-500 font-bold">Job Title</th>
<th class="px-6 py-4 font-label text-[10px] uppercase tracking-widest text-slate-500 font-bold">Company</th>
<th class="px-6 py-4 font-label text-[10px] uppercase tracking-widest text-slate-500 font-bold">Location</th>
<th class="px-6 py-4 font-label text-[10px] uppercase tracking-widest text-slate-500 font-bold">IA Reasoning</th>
<th class="px-6 py-4 font-label text-[10px] uppercase tracking-widest text-slate-500 font-bold text-right">Actions</th>
</tr>
</thead>
<tbody class="divide-y divide-slate-200">
<!-- Row 1 -->
<tr class="hover:bg-slate-50 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-slate-950">98.4%</td>
<td class="px-6 py-3 text-sm font-medium text-slate-950">Principal Systems Architect</td>
<td class="px-6 py-3 text-sm text-slate-500">Lumina Systems</td>
<td class="px-6 py-3 text-[11px] font-mono text-slate-400 uppercase">Remote / SF</td>
<td class="px-6 py-3">
<div class="bg-[#F1F5F9] px-3 py-1.5 text-[11px] font-mono text-slate-600 max-w-xs truncate border border-slate-200/50">
                            Strong alignment with Rust/WASM expertise; fits 4/5 core stacks.
                        </div>
</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<!-- Row 2 -->
<tr class="hover:bg-slate-50 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-slate-950">96.1%</td>
<td class="px-6 py-3 text-sm font-medium text-slate-950">Senior Machine Learning Engineer</td>
<td class="px-6 py-3 text-sm text-slate-500">NeuralPath AI</td>
<td class="px-6 py-3 text-[11px] font-mono text-slate-400 uppercase">Palo Alto, CA</td>
<td class="px-6 py-3">
<div class="bg-[#F1F5F9] px-3 py-1.5 text-[11px] font-mono text-slate-600 max-w-xs truncate border border-slate-200/50">
                            Previous experience with LLM orchestration layers is decisive.
                        </div>
</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<!-- Row 3 -->
<tr class="hover:bg-slate-50 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-slate-950">94.8%</td>
<td class="px-6 py-3 text-sm font-medium text-slate-950">Staff Frontend Engineer</td>
<td class="px-6 py-3 text-sm text-slate-500">Vercel Inc.</td>
<td class="px-6 py-3 text-[11px] font-mono text-slate-400 uppercase">Global Remote</td>
<td class="px-6 py-3">
<div class="bg-[#F1F5F9] px-3 py-1.5 text-[11px] font-mono text-slate-600 max-w-xs truncate border border-slate-200/50">
                            Next.js contribution history matches high-priority requirements.
                        </div>
</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<!-- More Rows -->
<tr class="hover:bg-slate-50 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-slate-950">92.2%</td>
<td class="px-6 py-3 text-sm font-medium text-slate-950">Director of Engineering</td>
<td class="px-6 py-3 text-sm text-slate-500">CloudFlare</td>
<td class="px-6 py-3 text-[11px] font-mono text-slate-400 uppercase">Austin, TX</td>
<td class="px-6 py-3">
<div class="bg-[#F1F5F9] px-3 py-1.5 text-[11px] font-mono text-slate-600 max-w-xs truncate border border-slate-200/50">
                            Scalability lead experience aligns with 3-year roadmap goals.
                        </div>
</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<tr class="hover:bg-slate-50 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-slate-400">89.5%</td>
<td class="px-6 py-3 text-sm font-medium text-slate-950">Platform Engineer</td>
<td class="px-6 py-3 text-sm text-slate-500">Kubecorp</td>
<td class="px-6 py-3 text-[11px] font-mono text-slate-400 uppercase">Seattle, WA</td>
<td class="px-6 py-3">
<div class="bg-[#F1F5F9] px-3 py-1.5 text-[11px] font-mono text-slate-600 max-w-xs truncate border border-slate-200/50">
                            Matches infrastructure as code keywords (Terraform/K8s).
                        </div>
</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
<tr class="hover:bg-slate-50 transition-colors group">
<td class="px-6 py-3 font-label text-sm font-bold text-slate-400">88.1%</td>
<td class="px-6 py-3 text-sm font-medium text-slate-950">Data Scientist</td>
<td class="px-6 py-3 text-sm text-slate-500">GraphBase</td>
<td class="px-6 py-3 text-[11px] font-mono text-slate-400 uppercase">New York, NY</td>
<td class="px-6 py-3">
<div class="bg-[#F1F5F9] px-3 py-1.5 text-[11px] font-mono text-slate-600 max-w-xs truncate border border-slate-200/50">
                            Strong match for vector database background.
                        </div>
</td>
<td class="px-6 py-3 text-right">
<div class="flex justify-end gap-3 opacity-30 group-hover:opacity-100 transition-opacity">
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="visibility">visibility</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="bookmark">bookmark</span>
<span class="material-symbols-outlined text-sm cursor-pointer hover:text-slate-950" data-icon="more_vert">more_vert</span>
</div>
</td>
</tr>
</tbody>
</table>
</div>
<!-- Pagination -->
<footer class="mt-12 flex justify-between items-center">
<div class="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
            Showing 6 of 342 records
        </div>
<div class="flex gap-1">
<button class="w-8 h-8 flex items-center justify-center border border-slate-200 text-slate-400 hover:bg-slate-50 transition-colors">
<span class="material-symbols-outlined text-sm" data-icon="chevron_left">chevron_left</span>
</button>
<button class="w-8 h-8 flex items-center justify-center bg-slate-950 text-white font-mono text-[10px]">01</button>
<button class="w-8 h-8 flex items-center justify-center border border-slate-200 text-slate-950 hover:bg-slate-50 font-mono text-[10px]">02</button>
<button class="w-8 h-8 flex items-center justify-center border border-slate-200 text-slate-950 hover:bg-slate-50 font-mono text-[10px]">03</button>
<button class="w-8 h-8 flex items-center justify-center border border-slate-200 text-slate-950 hover:bg-slate-50 font-mono text-[10px]">...</button>
<button class="w-8 h-8 flex items-center justify-center border border-slate-200 text-slate-400 hover:bg-slate-50 transition-colors">
<span class="material-symbols-outlined text-sm" data-icon="chevron_right">chevron_right</span>
</button>
</div>
<div class="flex gap-4">
<span class="font-mono text-[10px] text-slate-500 uppercase tracking-widest cursor-pointer hover:text-slate-950">Download CSV</span>
<span class="font-mono text-[10px] text-slate-500 uppercase tracking-widest cursor-pointer hover:text-slate-950">API Endpoint</span>
</div>
</footer>
</main>
<!-- Contextual Terminal Overlay -->
<div class="fixed bottom-6 right-6 p-4 bg-white border border-slate-200 shadow-2xl max-w-sm backdrop-blur-xl z-[60]">
<div class="flex items-center gap-2 mb-2">
<span class="w-2 h-2 bg-slate-950 rounded-full animate-pulse"></span>
<span class="font-mono text-[10px] uppercase tracking-widest text-slate-950 font-bold">AI Processor Active</span>
</div>
<p class="font-mono text-[11px] text-slate-500 leading-relaxed">
        Scanning job boards for "Senior Systems Architect" matches. Detected 4 new listings in last 120s. Correlation confidence: 0.98.
    </p>
</div>
</body></html>